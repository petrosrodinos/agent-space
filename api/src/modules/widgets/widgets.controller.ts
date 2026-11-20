import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import type { Actor } from '../bots/bots.service';
import { CreateWidgetDto, UpdateWidgetDto } from './dto/widget.dto';
import { WidgetsService } from './widgets.service';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

/** Saved widgets (§7.4): interactive replies kept for reuse, refreshed with fresh data when opened. */
@ApiTags('Widgets')
@ApiBearerAuth()
@Controller('widgets')
@UseGuards(JwtGuard, OrgGuard)
export class WidgetsController {
    constructor(private readonly widgets: WidgetsService) { }

    @Get()
    @ApiOperation({ summary: 'My saved widgets in this organisation' })
    list(@CurrentMembership() m: OrgMembership) {
        return this.widgets.list(actor(m));
    }

    @Post()
    @ApiOperation({ summary: 'Save an interactive reply as a widget' })
    create(@CurrentMembership() m: OrgMembership, @Body() dto: CreateWidgetDto) {
        return this.widgets.create(actor(m), dto);
    }

    @Get(':id')
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.widgets.get(actor(m), id);
    }

    @Patch(':id')
    update(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWidgetDto) {
        return this.widgets.update(actor(m), id, dto);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.widgets.remove(actor(m), id);
    }

    @Post(':id/refresh')
    @ApiOperation({ summary: 'Ask the bot for fresh data and rebuild the widget' })
    refresh(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.widgets.refresh(actor(m), id);
    }
}
