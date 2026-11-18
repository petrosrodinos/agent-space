import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import type { Actor } from '../bots/bots.service';
import { KnowledgeService } from './knowledge.service';
import { AddKnowledgeDto, UpdateKnowledgeDto } from './dto/knowledge.dto';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

@ApiTags('Knowledge')
@ApiBearerAuth()
@Controller('knowledge')
@UseGuards(JwtGuard, OrgGuard)
export class KnowledgeController {
    constructor(private readonly knowledge: KnowledgeService) { }

    /** Organisation knowledge library. */
    @Get()
    listOrg(@CurrentMembership() m: OrgMembership) {
        return this.knowledge.list(actor(m), null);
    }

    @Post()
    addOrg(@CurrentMembership() m: OrgMembership, @Body() dto: AddKnowledgeDto) {
        return this.knowledge.add(actor(m), null, dto);
    }

    @Get('bot/:botId')
    listBot(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string) {
        return this.knowledge.list(actor(m), botId);
    }

    @Post('bot/:botId')
    addBot(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string, @Body() dto: AddKnowledgeDto) {
        return this.knowledge.add(actor(m), botId, dto);
    }

    /** One item with its full text, for the editor. */
    @Get(':id')
    one(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.knowledge.one(actor(m), id);
    }

    @Patch(':id')
    update(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKnowledgeDto) {
        return this.knowledge.update(actor(m), id, dto);
    }

    /** Reads the source again and re-indexes (retry after a failure). */
    @Post(':id/reindex')
    reindex(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.knowledge.reindex(actor(m), id);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.knowledge.remove(actor(m), id);
    }
}
