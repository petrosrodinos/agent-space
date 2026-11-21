import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import type { Actor } from '../../bots/bots.service';
import { ToolServersService } from './tool-servers.service';
import { CreateToolServerDto, ToolServerSignInDto, ToolServerTokenDto, UpdateToolServerDto } from './tool-server.dto';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

@ApiTags('Tool servers')
@ApiBearerAuth()
@Controller('tool-servers')
@UseGuards(JwtGuard, OrgGuard)
export class ToolServersController {
    constructor(private readonly servers: ToolServersService) { }

    @Get()
    @ApiOperation({ summary: 'Custom tool servers I can use: my own and shared ones (§8.4)' })
    list(@CurrentMembership() m: OrgMembership) {
        return this.servers.list(actor(m));
    }

    @Post()
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @ApiOperation({ summary: 'Add an MCP tool server (registered with Composio); returns authorization_url when it uses its own sign-in' })
    create(@CurrentMembership() m: OrgMembership, @Body() dto: CreateToolServerDto) {
        return this.servers.create(actor(m), dto);
    }

    @Get(':id')
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.servers.get(actor(m), id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Rename, share or limit to bots. The address and sign-in type cannot change.' })
    update(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateToolServerDto) {
        return this.servers.update(actor(m), id, dto);
    }

    @Put(':id/token')
    @ApiOperation({ summary: 'Replace the access token (handed to Composio, never stored or returned)' })
    setToken(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ToolServerTokenDto) {
        return this.servers.setToken(actor(m), id, dto.token);
    }

    @Post(':id/sign-in')
    @ApiOperation({ summary: 'Start (or redo) the server\'s own sign-in; returns authorization_url (finishes on /connections/callback)' })
    signIn(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ToolServerSignInDto) {
        return this.servers.startSignIn(actor(m), id, dto?.return_url);
    }

    @Post(':id/test')
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    @ApiOperation({ summary: 'Test connection: check the sign-in and reload the tools' })
    test(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.servers.test(actor(m), id);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.servers.remove(actor(m), id);
    }
}
