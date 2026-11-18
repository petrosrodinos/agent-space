import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional } from 'class-validator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import type { Actor } from '../bots/bots.service';
import { ApprovalsService } from './approvals.service';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

class ResolveApprovalDto {
    @ApiProperty({ enum: ['approve', 'reject'] }) @IsIn(['approve', 'reject']) decision: 'approve' | 'reject';
    @ApiPropertyOptional({ description: 'Edited tool input (Edit → Approve)' }) @IsOptional() @IsObject() edited_input?: Record<string, unknown>;
}

@ApiTags('Approvals')
@ApiBearerAuth()
@Controller('approvals')
@UseGuards(JwtGuard, OrgGuard)
export class ApprovalsController {
    constructor(private readonly approvals: ApprovalsService) { }

    @Get()
    list(@CurrentMembership() m: OrgMembership, @Query('status') status?: 'pending' | 'all') {
        return this.approvals.list(actor(m), status === 'all' ? 'all' : 'pending');
    }

    @Get(':id')
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.approvals.get(actor(m), id);
    }

    @Post(':id/resolve')
    resolve(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveApprovalDto) {
        return this.approvals.resolve(actor(m), id, dto.decision, dto.edited_input);
    }
}
