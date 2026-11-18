import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import type { Actor } from '../bots/bots.service';
import { VoiceService } from './voice.service';

class StartVoiceDto {
    @ApiProperty() @IsUUID() conversation_id: string;
    @ApiPropertyOptional({ description: 'Which bot to talk to in a group (lead bot by default)' }) @IsOptional() @IsUUID() bot_id?: string;
    @ApiProperty({ description: 'WebRTC offer SDP from the browser' }) @IsString() @MinLength(20) @MaxLength(20_000) sdp: string;
    @ApiPropertyOptional({ enum: ['HANDS_FREE', 'PUSH_TO_TALK'] }) @IsOptional() @IsIn(['HANDS_FREE', 'PUSH_TO_TALK']) input_mode?: 'HANDS_FREE' | 'PUSH_TO_TALK';
}

class VoiceTextDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(8000) text: string;
}

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

/** §7.6 Voice mode. */
@ApiTags('Voice')
@ApiBearerAuth()
@Controller('voice')
@UseGuards(JwtGuard, OrgGuard)
export class VoiceController {
    constructor(private readonly voice: VoiceService) { }

    @Get('voices')
    voices() {
        return this.voice.voices();
    }

    @Get('voices/:voice/sample')
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    async sample(@Param('voice') voice: string, @Res() res: Response) {
        const audio = await this.voice.sample(voice);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.send(audio);
    }

    @Post('sessions')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    start(@CurrentMembership() m: OrgMembership, @Body() dto: StartVoiceDto) {
        return this.voice.start(actor(m), dto);
    }

    @Get('sessions/:id')
    status(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.voice.status(actor(m), id);
    }

    @Post('sessions/:id/text')
    text(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VoiceTextDto) {
        return this.voice.text(actor(m), id, dto.text);
    }

    @Delete('sessions/:id')
    end(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.voice.end(actor(m), id);
    }
}
