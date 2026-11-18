import { BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InvitationExpiry, OrganizationRole, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { Jobs, Queues } from '@/core/queues/queues.constants';
import { EventsService, UserEvents } from '@/core/realtime/events.service';
import { MailService } from '@/integrations/mail/mail.service';
import { MailTemplates } from '@/integrations/mail/mail.templates';
import { randomToken, sha256, shortSuffix, slugify } from '@/shared/utils/security/crypto.utils';
import { ActivityService } from '../activity/activity.service';
import { isAdminRole } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrganizationDto, UpdateOrganizationDto, UpdateOrganizationSettingsDto } from './dto/organization.dto';

const EXPIRY_DAYS: Record<InvitationExpiry, number> = { DAY_1: 1, DAY_3: 3, DAY_7: 7, DAY_30: 30 };
const ROLE_LABEL: Record<OrganizationRole, string> = { OWNER: 'Owner', ADMIN: 'Admin', MEMBER: 'Member' };

@Injectable()
export class OrganizationsService {
    private readonly logger = new Logger(OrganizationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly mail: MailService,
        private readonly activity: ActivityService,
        private readonly notifications: NotificationsService,
        private readonly events: EventsService,
        @InjectQueue(Queues.CONNECTIONS) private readonly connectionsQueue: Queue,
    ) { }

    private appUrl(path: string) {
        return `${(this.config.get<string>('APP_URL') || 'http://localhost:5173').replace(/\/$/, '')}${path}`;
    }

    async uniqueSlug(name: string) {
        const base = slugify(name, 40);
        const exists = await this.prisma.organization.findUnique({ where: { slug: base } });
        return exists ? `${base}-${shortSuffix()}` : base;
    }

    /** Creates an organisation with its creator as Owner (§5.1). Used for personal orgs at sign-up too. */
    async create(userId: string, dto: CreateOrganizationDto, isPersonal = false, tx: Prisma.TransactionClient = this.prisma) {
        const org = await tx.organization.create({
            data: {
                name: dto.name.trim(),
                slug: await this.uniqueSlug(dto.name),
                brand_color: dto.brand_color,
                is_personal: isPersonal,
                created_by_id: userId,
                settings: { create: {} },
                subscription: { create: { plan: 'FREE', status: 'ACTIVE', seats: 1 } },
                members: { create: { user_id: userId, role: 'OWNER' } },
            },
        });
        if (tx === this.prisma) {
            await this.activity.log({ organization_id: org.id, actor_user_id: userId, action: 'organization.created', target_type: 'organization', target_id: org.id });
        }
        return org;
    }

    async listMine(userId: string) {
        const rows = await this.prisma.organizationMember.findMany({
            where: { user_id: userId, organization: { deleted_at: null } },
            include: { organization: { include: { _count: { select: { members: true } } } } },
            orderBy: { joined_at: 'asc' },
        });
        return rows.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            brand_color: m.organization.brand_color,
            logo_file_id: m.organization.logo_file_id,
            is_personal: m.organization.is_personal,
            role: m.role,
            member_count: m.organization._count.members,
        }));
    }

    async get(orgId: string) {
        const org = await this.prisma.organization.findFirst({
            where: { id: orgId, deleted_at: null },
            include: { settings: true, subscription: true, allowed_models: true, _count: { select: { members: true, bots: true } } },
        });
        if (!org) throw new NotFoundException('Organisation not found');
        const { allowed_models, ...rest } = org;
        return { ...rest, allowed_model_ids: allowed_models.map((m) => m.model_id) };
    }

    async update(orgId: string, userId: string, dto: UpdateOrganizationDto) {
        const org = await this.prisma.organization.update({
            where: { id: orgId },
            data: { name: dto.name?.trim(), brand_color: dto.brand_color, logo_file_id: dto.logo_file_id },
        });
        await this.activity.log({ organization_id: orgId, actor_user_id: userId, action: 'organization.updated', target_type: 'organization', target_id: orgId, metadata: { fields: Object.keys(dto) } });
        return org;
    }

    async updateSettings(orgId: string, userId: string, dto: UpdateOrganizationSettingsDto) {
        const { allowed_model_ids, ...settings } = dto;
        if (settings.default_model_id) {
            const model = await this.prisma.aiModel.findUnique({ where: { id: settings.default_model_id } });
            if (!model) throw new BadRequestException('Unknown model');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.organizationSettings.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId, ...settings }, update: settings });
            if (allowed_model_ids) {
                await tx.organizationAllowedModel.deleteMany({ where: { organization_id: orgId } });
                if (allowed_model_ids.length) {
                    await tx.organizationAllowedModel.createMany({ data: allowed_model_ids.map((model_id) => ({ organization_id: orgId, model_id })), skipDuplicates: true });
                }
            }
        });
        // §6.4: bots on a model removed from the approved list switch to the org default and their owners are notified.
        if (dto.model_policy === 'APPROVED_LIST' || allowed_model_ids) await this.enforceModelPolicy(orgId);
        await this.activity.log({ organization_id: orgId, actor_user_id: userId, action: 'organization.settings_updated', target_type: 'organization', target_id: orgId, metadata: { fields: Object.keys(dto) } });
        return this.get(orgId);
    }

    private async enforceModelPolicy(orgId: string) {
        const settings = await this.prisma.organizationSettings.findUnique({ where: { organization_id: orgId } });
        if (settings?.model_policy !== 'APPROVED_LIST') return;
        const allowed = (await this.prisma.organizationAllowedModel.findMany({ where: { organization_id: orgId } })).map((a) => a.model_id);
        const bots = await this.prisma.bot.findMany({ where: { organization_id: orgId, deleted_at: null, model_id: { notIn: allowed, not: null } } });
        for (const bot of bots) {
            await this.prisma.bot.update({ where: { id: bot.id }, data: { model_id: settings.default_model_id } });
            if (bot.created_by_id) {
                await this.notifications.notify({
                    user_id: bot.created_by_id,
                    organization_id: orgId,
                    event: 'MODEL_CHANGED',
                    title: `${bot.name} switched to the organisation default model`,
                    body: 'Its previous model is no longer on the approved list.',
                    link_path: `/bots/${bot.id}`,
                });
            }
        }
    }

    // ---------- Members ----------

    async listMembers(orgId: string) {
        const rows = await this.prisma.organizationMember.findMany({
            where: { organization_id: orgId },
            include: { user: { select: { id: true, email: true, name: true, avatar_file_id: true, job_title: true, last_active_at: true } } },
            orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
        });
        return rows.map((m) => ({ id: m.id, role: m.role, joined_at: m.joined_at, user: m.user }));
    }

    private async ownerCount(orgId: string) {
        return this.prisma.organizationMember.count({ where: { organization_id: orgId, role: 'OWNER' } });
    }

    /** §5.3: Owners change any role; Admins change roles up to Admin and never touch Owners. */
    async updateMemberRole(orgId: string, actor: { user_id: string; role: OrganizationRole }, memberUserId: string, role: OrganizationRole) {
        const target = await this.prisma.organizationMember.findUnique({ where: { organization_id_user_id: { organization_id: orgId, user_id: memberUserId } } });
        if (!target) throw new NotFoundException('Member not found');
        if (actor.role === 'ADMIN' && (target.role === 'OWNER' || role === 'OWNER')) {
            throw new ForbiddenException('Admins can only change roles up to Admin');
        }
        if (target.role === 'OWNER' && role !== 'OWNER' && (await this.ownerCount(orgId)) <= 1) {
            throw new BadRequestException('An organisation always needs at least one Owner');
        }
        const updated = await this.prisma.organizationMember.update({ where: { id: target.id }, data: { role } });
        await this.activity.log({ organization_id: orgId, actor_user_id: actor.user_id, action: 'member.role_changed', target_type: 'user', target_id: memberUserId, metadata: { from: target.role, to: role } });
        return updated;
    }

    async removeMember(orgId: string, actor: { user_id: string; role: OrganizationRole }, memberUserId: string) {
        const target = await this.prisma.organizationMember.findUnique({ where: { organization_id_user_id: { organization_id: orgId, user_id: memberUserId } } });
        if (!target) throw new NotFoundException('Member not found');
        if (actor.role === 'ADMIN' && target.role === 'OWNER') throw new ForbiddenException('Admins cannot remove Owners');
        if (target.role === 'OWNER' && (await this.ownerCount(orgId)) <= 1) throw new BadRequestException('The last Owner cannot be removed');
        await this.detachMember(orgId, memberUserId);
        await this.activity.log({ organization_id: orgId, actor_user_id: actor.user_id, action: 'member.removed', target_type: 'user', target_id: memberUserId });
        return { ok: true };
    }

    async leave(orgId: string, userId: string) {
        const me = await this.prisma.organizationMember.findUnique({ where: { organization_id_user_id: { organization_id: orgId, user_id: userId } } });
        if (!me) throw new NotFoundException('Not a member');
        if (me.role === 'OWNER' && (await this.ownerCount(orgId)) <= 1) {
            throw new BadRequestException('Hand over ownership before leaving — the last Owner cannot leave');
        }
        await this.detachMember(orgId, userId);
        await this.activity.log({ organization_id: orgId, actor_user_id: userId, action: 'member.left', target_type: 'user', target_id: userId });
        return { ok: true };
    }

    /**
     * Member removal (§5, §6.7, §7.5, §8.7): skills and artifacts pass to an organisation Owner, the member leaves every
     * conversation, and their private connections and keys are deleted by a retrying background job.
     */
    private async detachMember(orgId: string, userId: string) {
        const owner = await this.prisma.organizationMember.findFirst({ where: { organization_id: orgId, role: 'OWNER', user_id: { not: userId } }, orderBy: { joined_at: 'asc' } });
        await this.prisma.$transaction(async (tx) => {
            await tx.organizationMember.delete({ where: { organization_id_user_id: { organization_id: orgId, user_id: userId } } });
            if (owner) {
                await tx.skill.updateMany({ where: { organization_id: orgId, owner_id: userId }, data: { owner_id: owner.user_id } });
                await tx.artifact.updateMany({ where: { organization_id: orgId, owner_id: userId }, data: { owner_id: owner.user_id } });
                await tx.bot.updateMany({ where: { organization_id: orgId, created_by_id: userId, visibility: 'ORGANIZATION' }, data: { created_by_id: owner.user_id } });
            }
            await tx.conversationParticipant.updateMany({ where: { user_id: userId, conversation: { organization_id: orgId } }, data: { left_at: new Date() } });
            await tx.automation.updateMany({ where: { organization_id: orgId, owner_id: userId }, data: { status: 'PAUSED', status_reason: 'Owner left the organisation' } });
        });
        await this.connectionsQueue.add(
            Jobs.connections.REVOKE_AND_DELETE,
            { organization_id: orgId, user_id: userId },
            { attempts: 5, backoff: { type: 'exponential', delay: 60_000 } },
        );
        await this.events.toUser(userId, UserEvents.CONVERSATIONS_CHANGED, { organization_id: orgId });
    }

    async transferOwnership(orgId: string, fromUserId: string, toUserId: string) {
        const target = await this.prisma.organizationMember.findUnique({ where: { organization_id_user_id: { organization_id: orgId, user_id: toUserId } } });
        if (!target) throw new NotFoundException('That person is not a member');
        if (toUserId === fromUserId) throw new BadRequestException('You already own this organisation');
        await this.prisma.$transaction([
            this.prisma.organizationMember.update({ where: { id: target.id }, data: { role: 'OWNER' } }),
            this.prisma.organizationMember.update({ where: { organization_id_user_id: { organization_id: orgId, user_id: fromUserId } }, data: { role: 'ADMIN' } }),
        ]);
        await this.activity.log({ organization_id: orgId, actor_user_id: fromUserId, action: 'organization.ownership_transferred', target_type: 'user', target_id: toUserId });
        return { ok: true };
    }

    async softDelete(orgId: string, userId: string) {
        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) throw new NotFoundException();
        const memberships = await this.prisma.organizationMember.count({ where: { user_id: userId, organization: { deleted_at: null } } });
        if (memberships <= 1) throw new BadRequestException('You need at least one other organisation before deleting this one');
        await this.prisma.organization.update({ where: { id: orgId }, data: { deleted_at: new Date(), purge_after: new Date(Date.now() + 30 * 86400_000) } });
        await this.activity.log({ organization_id: orgId, actor_user_id: userId, action: 'organization.deleted', target_type: 'organization', target_id: orgId });
        return { ok: true };
    }

    // ---------- Invitations (§5.2) ----------

    private async expiryFor(orgId: string) {
        const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: orgId } });
        const days = EXPIRY_DAYS[s?.invitation_expiry ?? 'DAY_7'];
        return { days, expires_at: new Date(Date.now() + days * 86400_000) };
    }

    async invite(orgId: string, actor: { user_id: string; role: OrganizationRole }, emails: string[], role: OrganizationRole) {
        if (actor.role === 'ADMIN' && role === 'OWNER') throw new ForbiddenException('Admins cannot invite Owners');
        const [org, inviter] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
            this.prisma.user.findUniqueOrThrow({ where: { id: actor.user_id } }),
        ]);
        const { days, expires_at } = await this.expiryFor(orgId);
        const results: { email: string; status: 'invited' | 'already_member' }[] = [];

        for (const raw of [...new Set(emails.map((e) => e.trim().toLowerCase()))]) {
            const existingMember = await this.prisma.organizationMember.findFirst({ where: { organization_id: orgId, user: { email: raw } } });
            if (existingMember) {
                results.push({ email: raw, status: 'already_member' });
                continue;
            }
            await this.prisma.invitation.updateMany({ where: { organization_id: orgId, email: raw, status: 'PENDING' }, data: { status: 'CANCELLED' } });
            const token = randomToken();
            const inv = await this.prisma.invitation.create({
                data: { organization_id: orgId, email: raw, role, token_hash: sha256(token), invited_by_id: actor.user_id, expires_at },
            });
            await this.sendInvitationEmail(raw, token, inviter.name || inviter.email, org.name, role, days);
            const invitedUser = await this.prisma.user.findUnique({ where: { email: raw } });
            if (invitedUser) {
                await this.notifications.notify({
                    user_id: invitedUser.id,
                    organization_id: null,
                    event: 'INVITATION_RECEIVED',
                    title: `${inviter.name || inviter.email} invited you to ${org.name}`,
                    body: `Role offered: ${ROLE_LABEL[role]}`,
                    link_path: `/invite/${token}`,
                    data: { invitation_id: inv.id },
                });
            }
            await this.activity.log({ organization_id: orgId, actor_user_id: actor.user_id, action: 'member.invited', target_type: 'invitation', target_id: inv.id, metadata: { email: raw, role } });
            results.push({ email: raw, status: 'invited' });
        }
        return { results };
    }

    private async sendInvitationEmail(email: string, token: string, inviterName: string, orgName: string, role: OrganizationRole, days: number) {
        const tpl = MailTemplates.invitation({ inviterName, orgName, role: ROLE_LABEL[role], url: this.appUrl(`/invite/${token}`), expiresInDays: days });
        try {
            await this.mail.send({ to: email, ...tpl });
        } catch (e) {
            this.logger.error(`Invitation email to ${email} failed: ${(e as Error).message}`);
            throw new BadRequestException(`Could not send the invitation email to ${email}`);
        }
    }

    async createInviteLink(orgId: string, actor: { user_id: string; role: OrganizationRole }, role: OrganizationRole) {
        const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: orgId } });
        if (s && !s.invite_links_enabled) throw new ForbiddenException('Invite links are turned off for this organisation');
        const token = randomToken();
        const { expires_at } = await this.expiryFor(orgId);
        const inv = await this.prisma.invitation.create({
            data: { organization_id: orgId, is_link: true, role, token_hash: sha256(token), invited_by_id: actor.user_id, expires_at },
        });
        await this.activity.log({ organization_id: orgId, actor_user_id: actor.user_id, action: 'member.invite_link_created', target_type: 'invitation', target_id: inv.id });
        return { id: inv.id, url: this.appUrl(`/invite/${token}`), role, expires_at };
    }

    async listInvitations(orgId: string) {
        await this.prisma.invitation.updateMany({ where: { organization_id: orgId, status: 'PENDING', expires_at: { lt: new Date() } }, data: { status: 'EXPIRED' } });
        return this.prisma.invitation.findMany({
            where: { organization_id: orgId, status: 'PENDING' },
            select: { id: true, email: true, is_link: true, role: true, status: true, expires_at: true, created_at: true, invited_by: { select: { id: true, name: true, email: true } } },
            orderBy: { created_at: 'desc' },
        });
    }

    async cancelInvitation(orgId: string, userId: string, id: string) {
        const res = await this.prisma.invitation.updateMany({ where: { id, organization_id: orgId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
        if (!res.count) throw new NotFoundException('Invitation not found');
        await this.activity.log({ organization_id: orgId, actor_user_id: userId, action: 'member.invitation_cancelled', target_type: 'invitation', target_id: id });
        return { ok: true };
    }

    /** Re-send issues a fresh token and expiry (the old link stops working). */
    async resendInvitation(orgId: string, actor: { user_id: string; role: OrganizationRole }, id: string) {
        const inv = await this.prisma.invitation.findFirst({ where: { id, organization_id: orgId, status: { in: ['PENDING', 'EXPIRED'] }, is_link: false } });
        if (!inv?.email) throw new NotFoundException('Invitation not found');
        const token = randomToken();
        const { days, expires_at } = await this.expiryFor(orgId);
        await this.prisma.invitation.update({ where: { id }, data: { token_hash: sha256(token), expires_at, status: 'PENDING' } });
        const [org, inviter] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
            this.prisma.user.findUniqueOrThrow({ where: { id: actor.user_id } }),
        ]);
        await this.sendInvitationEmail(inv.email, token, inviter.name || inviter.email, org.name, inv.role, days);
        return { ok: true };
    }

    /** Public preview shown before accepting: who invited, the organisation and the role (§5.2). */
    async previewInvitation(token: string) {
        const inv = await this.prisma.invitation.findUnique({
            where: { token_hash: sha256(token) },
            include: { organization: { select: { id: true, name: true, brand_color: true, deleted_at: true } }, invited_by: { select: { name: true, email: true } } },
        });
        if (!inv || inv.organization.deleted_at) throw new NotFoundException('Invitation not found');
        if (inv.status !== 'PENDING') throw new GoneException({ message: `This invitation is ${inv.status.toLowerCase()}`, code: 'invitation_not_pending' });
        if (inv.expires_at < new Date()) throw new GoneException({ message: 'This invitation has expired', code: 'invitation_expired' });
        return {
            organization: { id: inv.organization.id, name: inv.organization.name, brand_color: inv.organization.brand_color },
            role: inv.role,
            email: inv.email,
            is_link: inv.is_link,
            invited_by: inv.invited_by,
            expires_at: inv.expires_at,
        };
    }

    async acceptInvitation(token: string, userId: string) {
        const inv = await this.prisma.invitation.findUnique({ where: { token_hash: sha256(token) } });
        if (!inv || inv.status !== 'PENDING') throw new NotFoundException('Invitation not found or no longer valid');
        if (inv.expires_at < new Date()) {
            await this.prisma.invitation.update({ where: { id: inv.id }, data: { status: 'EXPIRED' } });
            throw new GoneException('This invitation has expired');
        }
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (!inv.is_link && inv.email && inv.email.toLowerCase() !== user.email.toLowerCase()) {
            throw new ForbiddenException(`This invitation was sent to ${inv.email}. Sign in with that email to accept it.`);
        }
        const existing = await this.prisma.organizationMember.findUnique({ where: { organization_id_user_id: { organization_id: inv.organization_id, user_id: userId } } });
        if (existing) {
            if (!inv.is_link) await this.prisma.invitation.update({ where: { id: inv.id }, data: { status: 'ACCEPTED', accepted_by_id: userId, accepted_at: new Date() } });
            return { organization_id: inv.organization_id, already_member: true };
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.organizationMember.create({ data: { organization_id: inv.organization_id, user_id: userId, role: inv.role } });
            if (!inv.is_link) await tx.invitation.update({ where: { id: inv.id }, data: { status: 'ACCEPTED', accepted_by_id: userId, accepted_at: new Date() } });
        });
        await this.activity.log({ organization_id: inv.organization_id, actor_user_id: userId, action: 'member.joined', target_type: 'invitation', target_id: inv.id, metadata: { role: inv.role } });
        return { organization_id: inv.organization_id, already_member: false };
    }

    /** §13.4 "Auto-join by email domain" — called after sign-up. */
    async autoJoinByDomain(userId: string, email: string) {
        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain) return;
        const orgs = await this.prisma.organizationSettings.findMany({ where: { auto_join_domain: domain, organization: { deleted_at: null } } });
        for (const s of orgs) {
            await this.prisma.organizationMember
                .create({ data: { organization_id: s.organization_id, user_id: userId, role: 'MEMBER' } })
                .catch(() => undefined);
        }
    }

    ensureAdmin(role: OrganizationRole) {
        if (!isAdminRole(role)) throw new ForbiddenException('Owners and Admins only');
    }

    async ensureUniqueName(userId: string, name: string) {
        const dup = await this.prisma.organizationMember.findFirst({ where: { user_id: userId, organization: { name, deleted_at: null } } });
        if (dup) throw new ConflictException('You already belong to an organisation with this name');
    }
}
