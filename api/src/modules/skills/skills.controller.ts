import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import type { Actor } from '../bots/bots.service';
import { SetBotSkillsDto } from '../bots/dto/bot.dto';
import { SkillsService } from './skills.service';
import { AssignSkillDto, CreateSkillDto, ImportSkillDto, ShareSkillDto, SkillFileDto, SkillQuery, SkillQuerySchema, UpdateSkillDto } from './dto/skill.dto';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

@ApiTags('Skills')
@ApiBearerAuth()
@Controller('skills')
@UseGuards(JwtGuard, OrgGuard)
export class SkillsController {
    constructor(private readonly skills: SkillsService) { }

    @Get()
    list(@CurrentMembership() m: OrgMembership, @Query(new ZodValidationPipe(SkillQuerySchema)) q: SkillQuery) {
        return this.skills.list(actor(m), q);
    }

    @Post()
    create(@CurrentMembership() m: OrgMembership, @Body() dto: CreateSkillDto) {
        return this.skills.create(actor(m), dto);
    }

    @Post('import')
    import(@CurrentMembership() m: OrgMembership, @Body() dto: ImportSkillDto) {
        return this.skills.import(actor(m), dto.skill);
    }

    @Put('bot/:botId')
    setBotSkills(@CurrentMembership() m: OrgMembership, @Param('botId', ParseUUIDPipe) botId: string, @Body() dto: SetBotSkillsDto) {
        return this.skills.setBotSkills(actor(m), botId, dto.skill_ids);
    }

    @Get(':id')
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.skills.get(actor(m), id);
    }

    @Patch(':id')
    update(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSkillDto) {
        return this.skills.update(actor(m), id, dto);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.skills.remove(actor(m), id);
    }

    @Post(':id/restore')
    restore(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.skills.restore(actor(m), id);
    }

    @Post(':id/versions/:version/restore')
    restoreVersion(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Param('version', ParseIntPipe) version: number) {
        return this.skills.restoreVersion(actor(m), id, version);
    }

    @Put(':id/sharing')
    share(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareSkillDto) {
        return this.skills.share(actor(m), id, dto);
    }

    @Put(':id/bots')
    bots(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignSkillDto) {
        return this.skills.setBots(actor(m), id, dto.bot_ids);
    }

    @Post(':id/add-starter')
    addStarter(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.skills.addStarter(actor(m), id);
    }

    @Post(':id/files')
    addFile(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SkillFileDto) {
        return this.skills.addFile(actor(m), id, dto.file_id);
    }

    @Delete(':id/files/:fileId')
    removeFile(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Param('fileId', ParseUUIDPipe) fileId: string) {
        return this.skills.removeFile(actor(m), id, fileId);
    }

    @Get(':id/export')
    export(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.skills.export(actor(m), id);
    }
}
