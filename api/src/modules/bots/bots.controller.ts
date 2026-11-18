import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import { BotsService, Actor } from './bots.service';
import { CreateBotDto, DraftBotDto, SetApprovalRulesDto, SetBotConnectionsDto, UpdateBotDto, UpdateMemoryDto } from './dto/bot.dto';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

@ApiTags('Bots')
@ApiBearerAuth()
@Controller('bots')
@UseGuards(JwtGuard, OrgGuard)
export class BotsController {
    constructor(private readonly bots: BotsService) { }

    @Get()
    @ApiOperation({ summary: 'Bots I can use (my private bots and organisation bots)' })
    list(@CurrentMembership() m: OrgMembership, @Query('search') search?: string) {
        return this.bots.list(actor(m), search);
    }

    @Post()
    create(@CurrentMembership() m: OrgMembership, @Body() dto: CreateBotDto) {
        return this.bots.create(actor(m), dto);
    }

    @Post('draft')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @ApiOperation({ summary: 'Draft a bot from a plain-language description (§6.1)' })
    draft(@CurrentMembership() m: OrgMembership, @Body() dto: DraftBotDto) {
        return this.bots.draftFromDescription(actor(m), dto.description);
    }

    @Get('org-memory')
    orgMemory(@CurrentMembership('organization_id') orgId: string) {
        return this.bots.listOrgMemories(orgId);
    }

    @Post('org-memory')
    addOrgMemory(@CurrentMembership() m: OrgMembership, @Body() dto: UpdateMemoryDto) {
        return this.bots.addOrgMemory(actor(m), dto.content);
    }

    @Patch('memories/:memoryId')
    updateMemory(@CurrentMembership() m: OrgMembership, @Param('memoryId', ParseUUIDPipe) id: string, @Body() dto: UpdateMemoryDto) {
        return this.bots.updateMemory(actor(m), id, dto.content);
    }

    @Delete('memories/:memoryId')
    deleteMemory(@CurrentMembership() m: OrgMembership, @Param('memoryId', ParseUUIDPipe) id: string) {
        return this.bots.deleteMemory(actor(m), id);
    }

    @Delete('memories')
    clearAll(@CurrentMembership() m: OrgMembership) {
        return this.bots.clearMyMemories(actor(m));
    }

    @Get(':id')
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.bots.get(actor(m), id);
    }

    @Patch(':id')
    update(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBotDto) {
        return this.bots.update(actor(m), id, dto);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.bots.remove(actor(m), id);
    }

    @Post(':id/duplicate')
    duplicate(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.bots.duplicate(actor(m), id);
    }

    @Put(':id/approval-rules')
    approvalRules(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetApprovalRulesDto) {
        return this.bots.setApprovalRules(actor(m), id, dto);
    }

    @Put(':id/connections')
    connections(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetBotConnectionsDto) {
        return this.bots.setConnections(actor(m), id, dto);
    }

    @Get(':id/memories')
    memories(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.bots.listMemories(actor(m), id);
    }

    @Delete(':id/memories')
    clearBotMemories(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.bots.clearMyMemories(actor(m), id);
    }
}
