import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import type { Actor } from '../bots/bots.service';
import { ComputersService } from './computers.service';
import { CleanupTargets, type CleanupTarget } from './computer-resources.scripts';

class PathDto {
    @ApiProperty() @IsString() @MaxLength(1000) path: string;
}
class ShareDto extends PathDto {
    @ApiProperty() @IsUUID() conversation_id: string;
}
class ImportDto {
    @ApiProperty({ description: 'A file uploaded with purpose "chat" or "knowledge"' }) @IsUUID() file_id: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) folder?: string;
}

class CleanupDto {
    @ApiProperty({ enum: Object.values(CleanupTargets), isArray: true })
    @IsArray() @ArrayNotEmpty() @ArrayMaxSize(10) @IsIn(Object.values(CleanupTargets), { each: true })
    targets: CleanupTarget[];
}

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

/** §9 — the bot's cloud computer: status, live view, take control, files and signed-in websites. */
@ApiTags('Cloud computers')
@ApiBearerAuth()
@Controller('computers/bot/:botId')
@UseGuards(JwtGuard, OrgGuard)
export class ComputersController {
    constructor(private readonly computers: ComputersService) { }

    @Get()
    view(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.view(actor(m), botId);
    }

    @Post('start')
    start(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.turnOn(actor(m), botId);
    }

    @Post('pause')
    pause(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.pause(actor(m), botId);
    }

    @Post('reset')
    reset(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.reset(actor(m), botId);
    }

    @Post('live-view')
    liveView(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.liveView(actor(m), botId);
    }

    @Post('take-control')
    takeControl(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.takeControl(actor(m), botId);
    }

    @Post('hand-back')
    handBack(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.handBack(actor(m), botId);
    }

    @Get('resources')
    resources(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.resources(actor(m), botId);
    }

    @Post('cleanup')
    cleanup(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string, @Body() dto: CleanupDto) {
        return this.computers.cleanup(actor(m), botId, dto.targets);
    }

    @Get('sessions')
    sessions(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.sessions(actor(m), botId);
    }

    @Get('sessions/:sessionId/frames')
    frames(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
        return this.computers.frames(actor(m), botId, sessionId);
    }

    @Get('files')
    files(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string, @Query('path') path?: string) {
        return this.computers.listFiles(actor(m), botId, path);
    }

    @Get('files/download')
    async download(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string, @Query('path') path: string, @Res() res: Response) {
        const { data, filename } = await this.computers.download(actor(m), botId, path);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(data);
    }

    @Post('files/import')
    importFile(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string, @Body() dto: ImportDto) {
        return this.computers.importStoredFile(actor(m), botId, dto.file_id, dto.folder);
    }

    @Post('files/share')
    share(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string, @Body() dto: ShareDto) {
        return this.computers.shareToChat(actor(m), botId, dto.path, dto.conversation_id);
    }

    @Post('files/delete')
    deleteFile(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string, @Body() dto: PathDto) {
        return this.computers.deleteFile(actor(m), botId, dto.path);
    }

    @Get('websites')
    websites(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.signedInSites(actor(m), botId);
    }

    @Delete('websites')
    signOutAll(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.computers.signOut(actor(m), botId, null);
    }

    @Delete('websites/:domain')
    signOut(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string, @Param('domain') domain: string) {
        return this.computers.signOut(actor(m), botId, domain);
    }
}
