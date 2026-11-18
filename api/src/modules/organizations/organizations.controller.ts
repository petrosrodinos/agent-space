import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership, OrgRoles } from '@/shared/decorators/org-roles.decorator';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';
import {
    CreateInviteLinkDto, CreateOrganizationDto, InviteMembersDto, TransferOwnershipDto, UpdateMemberRoleDto,
    UpdateOrganizationDto, UpdateOrganizationSettingsDto,
} from './dto/organization.dto';

@ApiTags('Organisations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(JwtGuard)
export class OrganizationsController {
    constructor(private readonly orgs: OrganizationsService) { }

    @Get()
    @ApiOperation({ summary: 'Organisations I belong to (for the switcher)' })
    listMine(@CurrentUser('id') userId: string) {
        return this.orgs.listMine(userId);
    }

    @Post()
    @ApiOperation({ summary: 'Create an organisation (creator becomes Owner)' })
    async create(@CurrentUser('id') userId: string, @Body() dto: CreateOrganizationDto) {
        return this.orgs.create(userId, dto);
    }

    @Get('current')
    @UseGuards(OrgGuard)
    @ApiOperation({ summary: 'The selected organisation with its settings' })
    current(@CurrentMembership() m: OrgMembership) {
        return this.orgs.get(m.organization_id).then((o) => ({ ...o, my_role: m.role }));
    }

    @Patch('current')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER', 'ADMIN')
    update(@CurrentMembership() m: OrgMembership, @Body() dto: UpdateOrganizationDto) {
        return this.orgs.update(m.organization_id, m.user_id, dto);
    }

    @Patch('current/settings')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER', 'ADMIN')
    @ApiOperation({ summary: 'Update organisation settings (§13.4)' })
    updateSettings(@CurrentMembership() m: OrgMembership, @Body() dto: UpdateOrganizationSettingsDto) {
        return this.orgs.updateSettings(m.organization_id, m.user_id, dto);
    }

    @Delete('current')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER')
    @ApiOperation({ summary: 'Delete the organisation (Owners only; restorable for 30 days)' })
    remove(@CurrentMembership() m: OrgMembership) {
        return this.orgs.softDelete(m.organization_id, m.user_id);
    }

    @Post('current/transfer-ownership')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER')
    transfer(@CurrentMembership() m: OrgMembership, @Body() dto: TransferOwnershipDto) {
        return this.orgs.transferOwnership(m.organization_id, m.user_id, dto.user_id);
    }

    @Post('current/leave')
    @UseGuards(OrgGuard)
    leave(@CurrentMembership() m: OrgMembership) {
        return this.orgs.leave(m.organization_id, m.user_id);
    }

    // ---- Members ----

    @Get('current/members')
    @UseGuards(OrgGuard)
    members(@CurrentMembership('organization_id') orgId: string) {
        return this.orgs.listMembers(orgId);
    }

    @Patch('current/members/:userId')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER', 'ADMIN')
    updateRole(@CurrentMembership() m: OrgMembership, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: UpdateMemberRoleDto) {
        return this.orgs.updateMemberRole(m.organization_id, m, userId, dto.role);
    }

    @Delete('current/members/:userId')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER', 'ADMIN')
    removeMember(@CurrentMembership() m: OrgMembership, @Param('userId', ParseUUIDPipe) userId: string) {
        return this.orgs.removeMember(m.organization_id, m, userId);
    }

    // ---- Invitations ----

    @Get('current/invitations')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER', 'ADMIN')
    invitations(@CurrentMembership('organization_id') orgId: string) {
        return this.orgs.listInvitations(orgId);
    }

    @Post('current/invitations')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER', 'ADMIN')
    @Throttle({ default: { limit: 20, ttl: 60_000 } })
    invite(@CurrentMembership() m: OrgMembership, @Body() dto: InviteMembersDto) {
        return this.orgs.invite(m.organization_id, m, dto.emails, dto.role);
    }

    @Post('current/invitations/link')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER', 'ADMIN')
    inviteLink(@CurrentMembership() m: OrgMembership, @Body() dto: CreateInviteLinkDto) {
        return this.orgs.createInviteLink(m.organization_id, m, dto.role);
    }

    @Post('current/invitations/:id/resend')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER', 'ADMIN')
    resend(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.orgs.resendInvitation(m.organization_id, m, id);
    }

    @Delete('current/invitations/:id')
    @UseGuards(OrgGuard)
    @OrgRoles('OWNER', 'ADMIN')
    cancel(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.orgs.cancelInvitation(m.organization_id, m.user_id, id);
    }
}

/** Invitation acceptance — preview is public so people without an account can see who invited them. */
@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
    constructor(private readonly orgs: OrganizationsService) { }

    @Get(':token')
    @Throttle({ default: { limit: 30, ttl: 60_000 } })
    preview(@Param('token') token: string) {
        return this.orgs.previewInvitation(token);
    }

    @Post(':token/accept')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    accept(@Param('token') token: string, @CurrentUser('id') userId: string) {
        return this.orgs.acceptInvitation(token, userId);
    }
}
