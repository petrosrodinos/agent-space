import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import type { Actor } from '../bots/bots.service';
import { MeetingAssistantService } from './meeting-assistant.service';

class MeetingAssistantDto {
    @ApiProperty() @IsUUID() bot_id: string;
    @ApiProperty({ description: 'Google Calendar or Outlook connection' }) @IsUUID() calendar_connection_id: string;
    @ApiPropertyOptional({ description: 'Gmail or Outlook connection for follow-up drafts and email history' }) @IsOptional() @IsUUID() email_connection_id?: string | null;
    @ApiProperty({ description: 'Briefs before meetings' }) @IsBoolean() briefs: boolean;
    @ApiProperty({ description: 'Follow-up drafts after meetings' }) @IsBoolean() follow_ups: boolean;
}

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

/** §16 Meeting assistant: briefs before meetings, follow-up drafts after. */
@ApiTags('Automations')
@ApiBearerAuth()
@Controller('meeting-assistant')
@UseGuards(JwtGuard, OrgGuard)
export class MeetingAssistantController {
    constructor(private readonly assistant: MeetingAssistantService) { }

    @Get()
    get(@CurrentMembership() m: OrgMembership) {
        return this.assistant.get(actor(m));
    }

    @Put()
    @ApiOperation({ summary: 'Turn on or change the meeting assistant (creates its two automations)' })
    set(@CurrentMembership() m: OrgMembership, @Body() dto: MeetingAssistantDto) {
        return this.assistant.set(actor(m), dto);
    }

    @Delete()
    disable(@CurrentMembership() m: OrgMembership) {
        return this.assistant.disable(actor(m));
    }
}
