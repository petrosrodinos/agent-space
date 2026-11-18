import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, Res, UseGuards, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import type { Request, Response } from 'express';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import { StorageService } from '@/integrations/storage/storage.service';
import type { Actor } from '../bots/bots.service';
import { FilesService, UploadPurpose } from './files.service';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

class CreateUploadDto {
    @ApiProperty() @IsString() @MaxLength(255) filename: string;
    @ApiProperty() @IsString() @MaxLength(120) mimetype: string;
    @ApiProperty() @IsInt() @Min(1) size: number;
    @ApiProperty({ enum: ['chat', 'knowledge', 'avatar', 'logo', 'bot_image', 'skill'] }) @IsIn(['chat', 'knowledge', 'avatar', 'logo', 'bot_image', 'skill']) purpose: UploadPurpose;
    @ApiPropertyOptional() @IsOptional() @IsUUID() conversation_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() bot_id?: string;
}

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
    constructor(
        private readonly files: FilesService,
        private readonly storage: StorageService,
    ) { }

    @Post('uploads')
    @UseGuards(JwtGuard, OrgGuard)
    createUpload(@CurrentMembership() m: OrgMembership, @Body() dto: CreateUploadDto) {
        return this.files.createUpload(actor(m), dto);
    }

    @Post(':id/confirm')
    @UseGuards(JwtGuard, OrgGuard)
    confirm(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.files.confirm(actor(m), id);
    }

    @Get(':id')
    @UseGuards(JwtGuard, OrgGuard)
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.files.get(actor(m), id);
    }

    @Get(':id/url')
    @UseGuards(JwtGuard, OrgGuard)
    url(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Query('inline') inline?: string) {
        return this.files.downloadUrl(actor(m), id, inline === 'true' || inline === '1');
    }

    // ---- STORAGE_DRIVER=local: short-lived signed links served by the API (development only) ----

    @Put('local/:token')
    @SkipThrottle()
    async localUpload(@Param('token') token: string, @Req() req: Request) {
        const t = await this.storage.verifyLocalToken(token);
        if (t.typ !== 'local-upload') throw new BadRequestException('Invalid link');
        const body = req.body as Buffer;
        if (!Buffer.isBuffer(body)) throw new BadRequestException('Expected a binary body');
        if (t.max && body.length > t.max) throw new PayloadTooLargeException('File is larger than declared');
        await this.storage.write(t.b as any, t.p, body, String(req.headers['content-type'] || t.ct || 'application/octet-stream'));
        return { ok: true };
    }

    @Get('local/:token')
    @SkipThrottle()
    async localDownload(@Param('token') token: string, @Res() res: Response) {
        const t = await this.storage.verifyLocalToken(token);
        if (t.typ !== 'local-download') throw new BadRequestException('Invalid link');
        const p = this.storage.localFilePath(t.b, t.p);
        const ct = await fs.readFile(p + '.ct', 'utf8').catch(() => 'application/octet-stream');
        res.setHeader('Content-Type', ct);
        res.setHeader('Content-Disposition', `${t.disp ?? 'attachment'}; filename="${path.basename(t.fn ?? 'file')}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        createReadStream(p).on('error', () => res.status(404).end()).pipe(res);
    }
}
