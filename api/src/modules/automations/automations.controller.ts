import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import type { Actor } from '../bots/bots.service';
import { AutomationsService } from './automations.service';
import { AutomationTriggersService } from './automation-triggers.service';
import { AutomationTriggerTypesQuery, AutomationTriggerTypesQuerySchema, AutomationListQuery, AutomationListQuerySchema, AutomationRunsQuery, AutomationRunsQuerySchema, CreateAutomationDto, UpdateAutomationDto, UpdateAutomationMemoryDto } from './dto/automation.dto';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

/** Automations the user owns (§10.2): schedule, run history, memory and pre-approvals. */
@ApiTags('Automations')
@ApiBearerAuth()
@Controller('automations')
@UseGuards(JwtGuard, OrgGuard)
export class AutomationsController {
    constructor(
        private readonly automations: AutomationsService,
        private readonly triggers: AutomationTriggersService,
    ) { }

    @Get()
    list(@CurrentMembership() m: OrgMembership, @Query(new ZodValidationPipe(AutomationListQuerySchema)) q: AutomationListQuery) {
        return this.automations.list(actor(m), q);
    }

    @Get('triggers')
    @ApiOperation({ summary: 'Events a connected account can start an automation with (§10.2)' })
    triggerTypes(@CurrentMembership() m: OrgMembership, @Query(new ZodValidationPipe(AutomationTriggerTypesQuerySchema)) q: AutomationTriggerTypesQuery) {
        return this.triggers.typesFor(actor(m), q.connection_id);
    }

    @Post()
    create(@CurrentMembership() m: OrgMembership, @Body() dto: CreateAutomationDto) {
        return this.automations.create(actor(m), dto);
    }

    @Get(':id')
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.automations.get(actor(m), id);
    }

    @Patch(':id')
    update(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAutomationDto) {
        return this.automations.update(actor(m), id, dto);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.automations.remove(actor(m), id);
    }

    @Post(':id/pause')
    @HttpCode(200)
    pause(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.automations.pause(actor(m), id);
    }

    @Post(':id/resume')
    @HttpCode(200)
    resume(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.automations.resume(actor(m), id);
    }

    @Post(':id/run')
    @HttpCode(200)
    @ApiOperation({ summary: 'Run now (skipped while another run is still going)' })
    runNow(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.automations.runNow(actor(m), id);
    }

    @Post(':id/duplicate')
    duplicate(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.automations.duplicate(actor(m), id);
    }

    @Get(':id/runs')
    runs(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(AutomationRunsQuerySchema)) q: AutomationRunsQuery) {
        return this.automations.listRuns(actor(m), id, q);
    }

    @Get(':id/runs/:runId')
    run(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Param('runId', ParseUUIDPipe) runId: string) {
        return this.automations.getRun(actor(m), id, runId);
    }

    @Get(':id/memory')
    memory(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.automations.getMemory(actor(m), id);
    }

    @Put(':id/memory')
    setMemory(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAutomationMemoryDto) {
        return this.automations.setMemory(actor(m), id, dto.notes);
    }

    @Delete(':id/memory')
    resetMemory(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.automations.resetMemory(actor(m), id);
    }

    @Post(':id/pre-approvals/confirm')
    @HttpCode(200)
    confirmPreApprovals(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.automations.confirmPreApprovals(actor(m), id);
    }

    @Delete(':id/pre-approvals/:preApprovalId')
    removePreApproval(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Param('preApprovalId', ParseUUIDPipe) preApprovalId: string) {
        return this.automations.removePreApproval(actor(m), id, preApprovalId);
    }
}
