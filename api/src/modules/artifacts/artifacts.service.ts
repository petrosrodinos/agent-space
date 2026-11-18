import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Artifact, ArtifactRole, ArtifactShare, ArtifactType, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { EventsService } from '@/core/realtime/events.service';
import { shortSuffix, slugify } from '@/shared/utils/security/crypto.utils';
import { isAdminRole } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MessagesService } from '../conversations/messages.service';
import { ArtifactQuery, ArtifactRoleName, CreateCommentDto, LabelVersionDto, MAX_ARTIFACT_HTML, PublicLinkDto, ShareArtifactDto, UpdateArtifactDto } from './dto/artifact.dto';

const RESTORE_WINDOW_MS = 30 * 86400_000;
const VIEW_TOKEN_TTL = 15 * 60;
export const ARTIFACT_UPDATED_EVENT = 'artifact.updated';

export const ROLE_RANK: Record<ArtifactRoleName, number> = { OWNER: 4, EDITOR: 3, COMMENTER: 2, VIEWER: 1 };

type ArtifactWithShares = Artifact & { shares: ArtifactShare[] };

export interface ArtifactViewClaims {
    typ: 'artifact-view';
    a: string;
    u: string;
    v?: string;
}

export interface BotArtifactInput {
    organization_id: string;
    owner_id: string | null;
    conversation_id: string | null;
    message_id: string | null;
    run_id: string | null;
    title: string;
    type: ArtifactType;
    description?: string | null;
    html: string;
    change_summary?: string | null;
}

/**
 * Artifacts (§7.5): standalone pages/apps a bot builds, with sharing levels, per-member roles, immutable versions,
 * drafts ("Review before publishing"), comments, stored records and public links.
 */
@Injectable()
export class ArtifactsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly jwt: JwtService,
        private readonly activity: ActivityService,
        private readonly notifications: NotificationsService,
        private readonly events: EventsService,
        private readonly messages: MessagesService,
    ) { }

    // ------------------------------------------------------------------ access

    /** The actor's role on an artifact, or null when they can't open it. Admins/Owners can see org-shared and public ones. */
    roleOf(actor: Actor, a: ArtifactWithShares): ArtifactRoleName | null {
        if (a.organization_id !== actor.organization_id) return null;
        if (a.owner_id === actor.user_id) return 'OWNER';
        const mine = a.shares.find((s) => s.user_id === actor.user_id);
        const orgWide = a.shares.find((s) => s.user_id === null);
        let role: ArtifactRoleName | null = null;
        if (a.sharing_level !== 'PRIVATE' && mine) role = mine.role;
        if (a.sharing_level === 'ORGANIZATION' || a.sharing_level === 'PUBLIC_LINK') {
            const org = (orgWide?.role ?? 'VIEWER') as ArtifactRoleName;
            if (!role || ROLE_RANK[org] > ROLE_RANK[role]) role = org;
            if (isAdminRole(actor.role) && !role) role = 'VIEWER';
        }
        return role;
    }

    async require(actor: Actor, id: string, min: ArtifactRoleName, opts: { includeDeleted?: boolean } = {}) {
        const a = await this.prisma.artifact.findFirst({
            where: { id, organization_id: actor.organization_id, ...(opts.includeDeleted ? {} : { deleted_at: null }) },
            include: { shares: true },
        });
        if (!a) throw new NotFoundException('Artifact not found');
        const role = this.roleOf(actor, a);
        if (!role) throw new NotFoundException('Artifact not found');
        if (ROLE_RANK[role] < ROLE_RANK[min]) {
            throw new ForbiddenException(min === 'OWNER' ? 'Only the artifact owner can do this' : min === 'EDITOR' ? 'You need edit access to this artifact' : 'You need comment access to this artifact');
        }
        if (a.taken_down_at && min !== 'OWNER' && !isAdminRole(actor.role)) throw new ForbiddenException('This artifact was taken down');
        return { artifact: a, role };
    }

    private accessibleWhere(actor: Actor): Prisma.ArtifactWhereInput {
        const or: Prisma.ArtifactWhereInput[] = [
            { owner_id: actor.user_id },
            { sharing_level: { in: ['ORGANIZATION', 'PUBLIC_LINK'] } },
            { sharing_level: 'SPECIFIC_MEMBERS', shares: { some: { user_id: actor.user_id } } },
        ];
        return { organization_id: actor.organization_id, deleted_at: null, OR: or };
    }

    // ------------------------------------------------------------------ urls

    private apiUrl() {
        return String(this.config.get('API_URL') || 'http://localhost:3100/api').replace(/\/$/, '');
    }

    private appUrl() {
        return String(this.config.get('APP_URL') || 'http://localhost:5180').replace(/\/$/, '');
    }

    /** Permanent, readable address on the isolated artifact host: <API>/a/<org-slug>/<artifact-slug>. */
    publicUrl(orgSlug: string, slug: string) {
        return `${this.apiUrl()}/a/${orgSlug}/${slug}`;
    }

    appPath(id: string) {
        return `/artifacts/${id}`;
    }

    private async uniqueSlug(orgId: string, base: string, exceptId?: string) {
        let slug = slugify(base, 50);
        for (let i = 0; i < 6; i++) {
            const clash = await this.prisma.artifact.findFirst({ where: { organization_id: orgId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
            if (!clash) return slug;
            slug = `${slugify(base, 42)}-${shortSuffix()}`;
        }
        return `${slugify(base, 36)}-${Date.now().toString(36)}`;
    }

    // ------------------------------------------------------------------ queries

    async list(actor: Actor, q: ArtifactQuery) {
        const tab: Prisma.ArtifactWhereInput =
            q.tab === 'mine'
                ? { organization_id: actor.organization_id, owner_id: actor.user_id, deleted_at: null }
                : q.tab === 'shared'
                    ? { organization_id: actor.organization_id, deleted_at: null, owner_id: { not: actor.user_id }, sharing_level: { not: 'PRIVATE' }, shares: { some: { user_id: actor.user_id } } }
                    : q.tab === 'organization'
                        ? { organization_id: actor.organization_id, deleted_at: null, sharing_level: { in: ['ORGANIZATION', 'PUBLIC_LINK'] } }
                        : q.tab === 'deleted'
                            ? { organization_id: actor.organization_id, owner_id: actor.user_id, deleted_at: { gt: new Date(Date.now() - RESTORE_WINDOW_MS) } }
                            : this.accessibleWhere(actor);
        const rows = await this.prisma.artifact.findMany({
            where: {
                AND: [
                    tab,
                    ...(q.type ? [{ type: q.type }] : []),
                    ...(q.conversation_id ? [{ conversation_id: q.conversation_id }] : []),
                    ...(q.search ? [{ OR: [{ title: { contains: q.search, mode: 'insensitive' as const } }, { description: { contains: q.search, mode: 'insensitive' as const } }] }] : []),
                ],
            },
            include: { shares: true, owner: { select: { id: true, name: true, email: true } }, current_version: { select: { version: true, published_at: true } }, organization: { select: { slug: true } } },
            orderBy: { updated_at: 'desc' },
            take: 200,
        });
        const out = rows
            .map((a) => ({ a, role: q.tab === 'deleted' ? ('OWNER' as const) : this.roleOf(actor, a) }))
            .filter((x) => x.role)
            .map(({ a, role }) => ({
                id: a.id,
                title: a.title,
                slug: a.slug,
                type: a.type,
                description: a.description,
                sharing_level: a.sharing_level,
                public_enabled: a.public_enabled,
                owner: a.owner,
                role,
                pinned: this.isPinned(a, actor.user_id),
                version: a.current_version?.version ?? null,
                has_draft: !!a.draft_version_id,
                conversation_id: a.conversation_id,
                view_count: role === 'OWNER' || role === 'EDITOR' ? a.view_count : undefined,
                taken_down: !!a.taken_down_at,
                deleted_at: a.deleted_at,
                updated_at: a.updated_at,
                created_at: a.created_at,
                url: this.publicUrl(a.organization.slug, a.slug),
            }));
        return out.sort((x, y) => Number(y.pinned) - Number(x.pinned));
    }

    private isPinned(a: Artifact, userId: string) {
        const pins = (a.is_pinned_by ?? {}) as Record<string, boolean>;
        return !!pins[userId];
    }

    async get(actor: Actor, id: string) {
        const { artifact, role } = await this.require(actor, id, 'VIEWER', { includeDeleted: true });
        if (artifact.deleted_at && role !== 'OWNER') throw new NotFoundException('Artifact not found');
        const [org, owner, shares, versionCount, current, draft, commentCount, recordCount, conversation] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({ where: { id: artifact.organization_id }, select: { slug: true, brand_color: true } }),
            artifact.owner_id ? this.prisma.user.findUnique({ where: { id: artifact.owner_id }, select: { id: true, name: true, email: true } }) : null,
            this.prisma.artifactShare.findMany({ where: { artifact_id: id }, include: { user: { select: { id: true, name: true, email: true } } } }),
            this.prisma.artifactVersion.count({ where: { artifact_id: id } }),
            artifact.current_version_id ? this.prisma.artifactVersion.findUnique({ where: { id: artifact.current_version_id }, select: { id: true, version: true, change_summary: true, published_at: true, created_at: true } }) : null,
            artifact.draft_version_id ? this.prisma.artifactVersion.findUnique({ where: { id: artifact.draft_version_id }, select: { id: true, version: true, change_summary: true, created_at: true } }) : null,
            this.prisma.artifactComment.count({ where: { artifact_id: id, deleted_at: null, resolved_at: null } }),
            ROLE_RANK[role] >= ROLE_RANK.EDITOR ? this.prisma.artifactRecord.count({ where: { artifact_id: id, deleted_at: null } }) : 0,
            artifact.conversation_id ? this.prisma.conversation.findUnique({ where: { id: artifact.conversation_id }, select: { id: true, name: true } }) : null,
        ]);
        const isEditor = ROLE_RANK[role] >= ROLE_RANK.EDITOR;
        return {
            id: artifact.id,
            title: artifact.title,
            slug: artifact.slug,
            type: artifact.type,
            description: artifact.description,
            role,
            owner,
            sharing_level: artifact.sharing_level,
            organization_role: (shares.find((s) => s.user_id === null)?.role ?? 'VIEWER') as ArtifactRole,
            shares: shares.filter((s) => s.user_id).map((s) => ({ user: s.user, role: s.role })),
            public_link: {
                enabled: artifact.public_enabled,
                has_password: !!artifact.public_password_hash,
                expires_at: artifact.public_expires_at,
                allow_search_engines: artifact.allow_search_engines,
                allow_embedding: artifact.allow_embedding,
                public_ai_enabled: artifact.public_ai_enabled,
            },
            review_before_publish: artifact.review_before_publish,
            current_version: current,
            draft_version: isEditor ? draft : null,
            version_count: versionCount,
            pinned: this.isPinned(artifact, actor.user_id),
            stats: isEditor ? { views: artifact.view_count, uses: artifact.use_count, records: recordCount } : null,
            open_comments: commentCount,
            conversation,
            duplicated_from_id: artifact.duplicated_from_id,
            brand_color: org.brand_color,
            url: this.publicUrl(org.slug, artifact.slug),
            embed_code: artifact.public_enabled && artifact.allow_embedding ? `<iframe src="${this.publicUrl(org.slug, artifact.slug)}" style="width:100%;height:640px;border:0" loading="lazy" title="${artifact.title.replace(/"/g, '')}"></iframe>` : null,
            taken_down: !!artifact.taken_down_at,
            deleted_at: artifact.deleted_at,
            created_at: artifact.created_at,
            updated_at: artifact.updated_at,
        };
    }

    // ------------------------------------------------------------------ bot create / edit

    private checkHtml(html: string) {
        if (!html?.trim()) throw new BadRequestException('The artifact is empty');
        if (html.length > MAX_ARTIFACT_HTML) throw new BadRequestException(`The artifact is too large (max ${Math.round(MAX_ARTIFACT_HTML / 1000)} KB). Split data out or simplify.`);
    }

    async createFromBot(input: BotArtifactInput) {
        this.checkHtml(input.html);
        const slug = await this.uniqueSlug(input.organization_id, input.title);
        const artifact = await this.prisma.$transaction(async (tx) => {
            const a = await tx.artifact.create({
                data: {
                    organization_id: input.organization_id,
                    owner_id: input.owner_id,
                    conversation_id: input.conversation_id,
                    message_id: input.message_id,
                    title: input.title.slice(0, 120),
                    slug,
                    type: input.type,
                    description: input.description?.slice(0, 500) ?? null,
                },
            });
            const v = await tx.artifactVersion.create({
                data: { artifact_id: a.id, version: 1, status: 'PUBLISHED', source: { html: input.html }, change_summary: input.change_summary ?? 'First version', created_by_id: input.owner_id, run_id: input.run_id, published_at: new Date() },
            });
            return tx.artifact.update({ where: { id: a.id }, data: { current_version_id: v.id } });
        });
        await this.activity.log({ organization_id: input.organization_id, actor_user_id: input.owner_id, action: 'artifact.created', target_type: 'artifact', target_id: artifact.id, run_id: input.run_id ?? undefined, metadata: { title: artifact.title } });
        return { artifact, version: 1, status: 'PUBLISHED' as const };
    }

    /** Saves a new version from a bot or editor. With "Review before publishing" it becomes (or replaces) the draft. */
    async saveVersion(actor: Actor, id: string, input: { html: string; change_summary?: string | null; run_id?: string | null; title?: string; restored_from_version?: number }) {
        this.checkHtml(input.html);
        const { artifact } = await this.require(actor, id, 'EDITOR');
        const last = await this.prisma.artifactVersion.findFirst({ where: { artifact_id: id }, orderBy: { version: 'desc' }, select: { version: true } });
        const version = (last?.version ?? 0) + 1;
        const draft = artifact.review_before_publish;
        const saved = await this.prisma.$transaction(async (tx) => {
            if (draft && artifact.draft_version_id) await tx.artifact.update({ where: { id }, data: { draft_version_id: null } }).then(() => tx.artifactVersion.delete({ where: { id: artifact.draft_version_id! } }));
            const v = await tx.artifactVersion.create({
                data: {
                    artifact_id: id,
                    version,
                    status: draft ? 'DRAFT' : 'PUBLISHED',
                    source: { html: input.html },
                    change_summary: input.change_summary?.slice(0, 300) ?? null,
                    created_by_id: actor.user_id,
                    run_id: input.run_id ?? null,
                    restored_from_version: input.restored_from_version ?? null,
                    published_at: draft ? null : new Date(),
                },
            });
            await tx.artifact.update({ where: { id }, data: { ...(draft ? { draft_version_id: v.id } : { current_version_id: v.id }), ...(input.title ? { title: input.title.slice(0, 120) } : {}) } });
            return v;
        });
        await this.afterChange(actor, artifact, draft ? 'draft' : 'published', input.change_summary ?? null);
        return { artifact_id: id, version: saved.version, status: saved.status, version_id: saved.id };
    }

    private async afterChange(actor: Actor, artifact: ArtifactWithShares, what: string, summary: string | null) {
        await this.activity.log({ organization_id: artifact.organization_id, actor_user_id: actor.user_id, action: `artifact.${what === 'draft' ? 'draft_saved' : 'version_published'}`, target_type: 'artifact', target_id: artifact.id, metadata: { summary } });
        const audience = [artifact.owner_id, ...artifact.shares.map((s) => s.user_id)].filter((u): u is string => !!u);
        await this.events.toUsers([...new Set(audience)], ARTIFACT_UPDATED_EVENT, { artifact_id: artifact.id });
        if (artifact.owner_id && artifact.owner_id !== actor.user_id && what !== 'draft') {
            await this.notifications.notify({ user_id: artifact.owner_id, organization_id: artifact.organization_id, event: 'ARTIFACT_EDITED', title: `“${artifact.title}” was updated`, body: summary ?? undefined, link_path: this.appPath(artifact.id) });
        }
    }

    async source(actor: Actor, id: string, versionId?: string) {
        const { artifact, role } = await this.require(actor, id, 'VIEWER');
        const vid = versionId ?? artifact.current_version_id ?? artifact.draft_version_id;
        if (!vid) throw new NotFoundException('This artifact has no version yet');
        if (versionId && versionId !== artifact.current_version_id && ROLE_RANK[role] < ROLE_RANK.EDITOR) throw new ForbiddenException('Only editors can open earlier versions');
        const v = await this.prisma.artifactVersion.findFirst({ where: { id: vid, artifact_id: id } });
        if (!v) throw new NotFoundException('Version not found');
        return { artifact, version: v, html: String((v.source as { html?: string })?.html ?? '') };
    }

    // ------------------------------------------------------------------ settings & sharing

    async update(actor: Actor, id: string, dto: UpdateArtifactDto) {
        const needsOwner = dto.slug !== undefined || dto.review_before_publish !== undefined;
        const needsEdit = dto.title !== undefined || dto.description !== undefined || dto.type !== undefined;
        const { artifact } = await this.require(actor, id, needsOwner ? 'OWNER' : needsEdit ? 'EDITOR' : 'VIEWER');
        const data: Prisma.ArtifactUpdateInput = {};
        if (dto.title !== undefined) data.title = dto.title.trim();
        if (dto.description !== undefined) data.description = dto.description.trim() || null;
        if (dto.type !== undefined) data.type = dto.type;
        if (dto.review_before_publish !== undefined) data.review_before_publish = dto.review_before_publish;
        if (dto.slug !== undefined && dto.slug !== artifact.slug) {
            const clash = await this.prisma.artifact.findFirst({ where: { organization_id: artifact.organization_id, slug: dto.slug, id: { not: id } }, select: { id: true } });
            if (clash) throw new BadRequestException('That link is already used by another artifact');
            data.slug = dto.slug;
        }
        if (dto.pinned !== undefined) {
            const pins = { ...((artifact.is_pinned_by ?? {}) as Record<string, boolean>) };
            if (dto.pinned) pins[actor.user_id] = true;
            else delete pins[actor.user_id];
            data.is_pinned_by = pins;
        }
        await this.prisma.artifact.update({ where: { id }, data });
        return this.get(actor, id);
    }

    async share(actor: Actor, id: string, dto: ShareArtifactDto) {
        const { artifact } = await this.require(actor, id, 'OWNER');
        const shares = (dto.shares ?? []).filter((s) => s.user_id !== artifact.owner_id);
        if (shares.length) {
            const members = await this.prisma.organizationMember.count({ where: { organization_id: artifact.organization_id, user_id: { in: shares.map((s) => s.user_id) } } });
            if (members !== new Set(shares.map((s) => s.user_id)).size) throw new BadRequestException('You can only share with members of this organisation');
        }
        const before = new Set(artifact.shares.filter((s) => s.user_id).map((s) => s.user_id!));
        await this.prisma.$transaction(async (tx) => {
            await tx.artifact.update({
                where: { id },
                data: { sharing_level: dto.sharing_level, ...(dto.sharing_level !== 'PUBLIC_LINK' ? { public_enabled: false } : {}) },
            });
            await tx.artifactShare.deleteMany({ where: { artifact_id: id } });
            const rows: Prisma.ArtifactShareCreateManyInput[] = shares.map((s) => ({ artifact_id: id, user_id: s.user_id, role: s.role }));
            if (dto.organization_role && (dto.sharing_level === 'ORGANIZATION' || dto.sharing_level === 'PUBLIC_LINK')) rows.push({ artifact_id: id, user_id: null, role: dto.organization_role });
            if (rows.length) await tx.artifactShare.createMany({ data: rows });
        });
        const added = shares.filter((s) => !before.has(s.user_id)).map((s) => s.user_id);
        if (added.length && dto.sharing_level !== 'PRIVATE') {
            const me = await this.prisma.user.findUnique({ where: { id: actor.user_id }, select: { name: true, email: true } });
            await this.notifications.notifyMany(added, { organization_id: artifact.organization_id, event: 'ARTIFACT_SHARED', title: `${me?.name ?? me?.email ?? 'Someone'} shared “${artifact.title}” with you`, link_path: this.appPath(id) });
        }
        await this.activity.log({ organization_id: artifact.organization_id, actor_user_id: actor.user_id, action: 'artifact.sharing_changed', target_type: 'artifact', target_id: id, metadata: { sharing_level: dto.sharing_level, members: shares.length } });
        return this.get(actor, id);
    }

    async publicLink(actor: Actor, id: string, dto: PublicLinkDto) {
        const a = await this.prisma.artifact.findFirst({ where: { id, organization_id: actor.organization_id, deleted_at: null }, include: { shares: true } });
        if (!a) throw new NotFoundException('Artifact not found');
        const role = this.roleOf(actor, a);
        const isOwner = role === 'OWNER';
        // Owners and Admins can switch off any public link (§7.5 Ownership and safety); everything else is owner-only.
        if (!isOwner && !(isAdminRole(actor.role) && dto.enabled === false)) throw new ForbiddenException('Only the artifact owner can change its public link');
        const data: Prisma.ArtifactUpdateInput = { public_enabled: dto.enabled };
        if (isOwner) {
            if (dto.enabled) data.sharing_level = 'PUBLIC_LINK';
            if (dto.password !== undefined) data.public_password_hash = dto.password ? await bcrypt.hash(dto.password, 10) : null;
            if (dto.expires_at !== undefined) {
                if (dto.expires_at && new Date(dto.expires_at).getTime() < Date.now()) throw new BadRequestException('The expiry date must be in the future');
                data.public_expires_at = dto.expires_at ? new Date(dto.expires_at) : null;
            }
            if (dto.allow_search_engines !== undefined) data.allow_search_engines = dto.allow_search_engines;
            if (dto.allow_embedding !== undefined) data.allow_embedding = dto.allow_embedding;
            if (dto.public_ai_enabled !== undefined) data.public_ai_enabled = dto.public_ai_enabled;
        }
        await this.prisma.artifact.update({ where: { id }, data });
        await this.activity.log({ organization_id: a.organization_id, actor_user_id: actor.user_id, action: dto.enabled ? 'artifact.public_link_on' : 'artifact.public_link_off', target_type: 'artifact', target_id: id });
        return role ? this.get(actor, id) : { ok: true };
    }

    async transfer(actor: Actor, id: string, userId: string) {
        const { artifact } = await this.require(actor, id, 'OWNER');
        const member = await this.prisma.organizationMember.findUnique({ where: { organization_id_user_id: { organization_id: artifact.organization_id, user_id: userId } } });
        if (!member) throw new BadRequestException('That person is not a member of this organisation');
        await this.prisma.$transaction(async (tx) => {
            await tx.artifact.update({ where: { id }, data: { owner_id: userId, sharing_level: artifact.sharing_level === 'PRIVATE' ? 'SPECIFIC_MEMBERS' : artifact.sharing_level } });
            await tx.artifactShare.deleteMany({ where: { artifact_id: id, user_id: { in: [userId, actor.user_id] } } });
            await tx.artifactShare.create({ data: { artifact_id: id, user_id: actor.user_id, role: 'EDITOR' } });
        });
        await this.notifications.notify({ user_id: userId, organization_id: artifact.organization_id, event: 'ARTIFACT_SHARED', title: `You now own “${artifact.title}”`, link_path: this.appPath(id) });
        await this.activity.log({ organization_id: artifact.organization_id, actor_user_id: actor.user_id, action: 'artifact.ownership_transferred', target_type: 'artifact', target_id: id, metadata: { to: userId } });
        return this.get(actor, id);
    }

    /** Owners/Admins: every artifact with a live public link in the organisation (§7.5 Ownership and safety). */
    async publicLinks(actor: Actor) {
        if (!isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can review public links');
        const rows = await this.prisma.artifact.findMany({
            where: { organization_id: actor.organization_id, deleted_at: null, public_enabled: true },
            include: { owner: { select: { id: true, name: true, email: true } }, organization: { select: { slug: true } }, _count: { select: { reports: { where: { status: 'OPEN' } } } } },
            orderBy: { updated_at: 'desc' },
        });
        return rows.map((a) => ({ id: a.id, title: a.title, owner: a.owner, url: this.publicUrl(a.organization.slug, a.slug), view_count: a.view_count, open_reports: a._count.reports, expires_at: a.public_expires_at, has_password: !!a.public_password_hash }));
    }

    // ------------------------------------------------------------------ versions

    async versions(actor: Actor, id: string) {
        const { artifact } = await this.require(actor, id, 'EDITOR');
        const rows = await this.prisma.artifactVersion.findMany({
            where: { artifact_id: id },
            select: { id: true, version: true, status: true, label: true, change_summary: true, restored_from_version: true, published_at: true, created_at: true, created_by: { select: { id: true, name: true, email: true } }, run: { select: { bot: { select: { id: true, name: true, emoji: true, color: true } } } } },
            orderBy: { version: 'desc' },
        });
        return rows.map(({ run, ...v }) => ({ ...v, bot: run?.bot ?? null, is_current: v.id === artifact.current_version_id, is_draft: v.id === artifact.draft_version_id }));
    }

    async labelVersion(actor: Actor, id: string, versionId: string, dto: LabelVersionDto) {
        await this.require(actor, id, 'EDITOR');
        const v = await this.prisma.artifactVersion.findFirst({ where: { id: versionId, artifact_id: id } });
        if (!v) throw new NotFoundException('Version not found');
        return this.prisma.artifactVersion.update({ where: { id: versionId }, data: { label: dto.label?.trim() || null }, select: { id: true, label: true } });
    }

    async restoreVersion(actor: Actor, id: string, versionId: string) {
        const { html, version } = await this.source(actor, id, versionId);
        return this.saveVersion(actor, id, { html, change_summary: `Restored version ${version.version}${version.label ? ` (“${version.label}”)` : ''}`, restored_from_version: version.version });
    }

    async publishDraft(actor: Actor, id: string) {
        const { artifact } = await this.require(actor, id, 'EDITOR');
        if (!artifact.draft_version_id) throw new BadRequestException('There is no draft to publish');
        const draftId = artifact.draft_version_id;
        await this.prisma.$transaction([
            this.prisma.artifactVersion.update({ where: { id: draftId }, data: { status: 'PUBLISHED', published_at: new Date() } }),
            this.prisma.artifact.update({ where: { id }, data: { current_version_id: draftId, draft_version_id: null } }),
        ]);
        const v = await this.prisma.artifactVersion.findUniqueOrThrow({ where: { id: draftId } });
        await this.afterChange(actor, artifact, 'published', v.change_summary);
        return this.get(actor, id);
    }

    async discardDraft(actor: Actor, id: string) {
        const { artifact } = await this.require(actor, id, 'EDITOR');
        if (!artifact.draft_version_id) throw new BadRequestException('There is no draft');
        const draftId = artifact.draft_version_id;
        await this.prisma.$transaction([this.prisma.artifact.update({ where: { id }, data: { draft_version_id: null } }), this.prisma.artifactVersion.delete({ where: { id: draftId } })]);
        return this.get(actor, id);
    }

    // ------------------------------------------------------------------ duplicate / delete

    async duplicate(actor: Actor, id: string) {
        const { artifact, html } = await this.source(actor, id);
        const copy = await this.createFromBot({
            organization_id: artifact.organization_id,
            owner_id: actor.user_id,
            conversation_id: null,
            message_id: null,
            run_id: null,
            title: `${artifact.title} (copy)`.slice(0, 120),
            type: artifact.type,
            description: artifact.description,
            html,
            change_summary: `Duplicated from “${artifact.title}”`,
        });
        await this.prisma.artifact.update({ where: { id: copy.artifact.id }, data: { duplicated_from_id: id } });
        return this.get(actor, copy.artifact.id);
    }

    async remove(actor: Actor, id: string) {
        const { artifact } = await this.require(actor, id, 'OWNER');
        await this.prisma.artifact.update({ where: { id }, data: { deleted_at: new Date() } });
        await this.prisma.file.updateMany({ where: { artifact_id: id, deleted_at: null }, data: { deleted_at: new Date(), purge_after: new Date(Date.now() + RESTORE_WINDOW_MS) } });
        await this.activity.log({ organization_id: artifact.organization_id, actor_user_id: actor.user_id, action: 'artifact.deleted', target_type: 'artifact', target_id: id });
        return { ok: true, restorable_until: new Date(Date.now() + RESTORE_WINDOW_MS) };
    }

    async restore(actor: Actor, id: string) {
        const { artifact } = await this.require(actor, id, 'OWNER', { includeDeleted: true });
        if (!artifact.deleted_at) return this.get(actor, id);
        if (artifact.deleted_at.getTime() < Date.now() - RESTORE_WINDOW_MS) throw new BadRequestException('This artifact can no longer be restored');
        await this.prisma.artifact.update({ where: { id }, data: { deleted_at: null } });
        await this.prisma.file.updateMany({ where: { artifact_id: id }, data: { deleted_at: null, purge_after: null } });
        return this.get(actor, id);
    }

    // ------------------------------------------------------------------ records

    async records(actor: Actor, id: string, collection?: string) {
        await this.require(actor, id, 'EDITOR');
        const rows = await this.prisma.artifactRecord.findMany({
            where: { artifact_id: id, deleted_at: null, ...(collection ? { collection } : {}) },
            orderBy: { created_at: 'desc' },
            take: 1000,
        });
        const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.submitted_by_id).filter((x): x is string => !!x))] } }, select: { id: true, name: true, email: true } });
        const byId = new Map(users.map((u) => [u.id, u]));
        const collections = await this.prisma.artifactRecord.groupBy({ by: ['collection'], where: { artifact_id: id, deleted_at: null }, _count: { _all: true } });
        return {
            collections: collections.map((c) => ({ name: c.collection, count: c._count._all })),
            records: rows.map((r) => ({ id: r.id, collection: r.collection, data: r.data, submitted_by: r.submitted_by_id ? (byId.get(r.submitted_by_id) ?? null) : null, is_visitor: !r.submitted_by_id, created_at: r.created_at })),
        };
    }

    async deleteRecord(actor: Actor, id: string, recordId: string) {
        await this.require(actor, id, 'EDITOR');
        const r = await this.prisma.artifactRecord.updateMany({ where: { id: recordId, artifact_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
        if (!r.count) throw new NotFoundException('Record not found');
        return { ok: true };
    }

    // ------------------------------------------------------------------ comments

    async comments(actor: Actor, id: string) {
        await this.require(actor, id, 'COMMENTER');
        const rows = await this.prisma.artifactComment.findMany({
            where: { artifact_id: id, deleted_at: null },
            include: { author: { select: { id: true, name: true, email: true } }, mentioned_bot: { select: { id: true, name: true, emoji: true, color: true } } },
            orderBy: { created_at: 'asc' },
        });
        const map = (c: (typeof rows)[number]) => ({ id: c.id, content: c.content, anchor: c.anchor, author: c.author, mentioned_bot: c.mentioned_bot, resolved_at: c.resolved_at, created_at: c.created_at, is_mine: c.author_id === actor.user_id });
        return rows.filter((c) => !c.parent_comment_id).map((c) => ({ ...map(c), replies: rows.filter((r) => r.parent_comment_id === c.id).map(map) }));
    }

    async addComment(actor: Actor, id: string, dto: CreateCommentDto) {
        const { artifact } = await this.require(actor, id, 'COMMENTER');
        if (dto.parent_comment_id) {
            const parent = await this.prisma.artifactComment.findFirst({ where: { id: dto.parent_comment_id, artifact_id: id, deleted_at: null, parent_comment_id: null } });
            if (!parent) throw new BadRequestException('Unknown comment thread');
        }
        let bot: { id: string; name: string } | null = null;
        if (dto.mentioned_bot_id) {
            // A bot mention makes the bot edit the artifact, so the commenter needs edit rights and a conversation with that bot (§7.5).
            const role = this.roleOf(actor, artifact)!;
            if (ROLE_RANK[role] < ROLE_RANK.EDITOR) throw new ForbiddenException('Only editors can ask a bot to change this artifact');
            if (!artifact.conversation_id) throw new BadRequestException('Ask a bot from a conversation to edit this artifact');
            const p = await this.prisma.conversationParticipant.findFirst({ where: { conversation_id: artifact.conversation_id, bot_id: dto.mentioned_bot_id, left_at: null }, include: { bot: { select: { id: true, name: true } } } });
            if (!p?.bot) throw new BadRequestException('That bot is not in the conversation where this artifact was made');
            bot = p.bot;
        }
        const comment = await this.prisma.artifactComment.create({
            data: { artifact_id: id, author_id: actor.user_id, parent_comment_id: dto.parent_comment_id ?? null, content: dto.content.trim(), anchor: (dto.anchor ?? undefined) as Prisma.InputJsonValue, mentioned_bot_id: bot?.id ?? null },
        });
        if (bot && artifact.conversation_id) {
            const where = dto.anchor && typeof dto.anchor === 'object' && 'section' in dto.anchor ? ` (on “${String((dto.anchor as { section?: unknown }).section).slice(0, 80)}”)` : '';
            await this.messages.send(actor, artifact.conversation_id, { content: `@${bot.name} Please update the artifact “${artifact.title}” (artifact id ${artifact.id}) based on this comment${where}: ${dto.content.trim()}` });
        }
        const me = await this.prisma.user.findUnique({ where: { id: actor.user_id }, select: { name: true, email: true } });
        const notify = new Set<string>();
        if (artifact.owner_id && artifact.owner_id !== actor.user_id) notify.add(artifact.owner_id);
        if (dto.parent_comment_id) {
            const thread = await this.prisma.artifactComment.findMany({ where: { OR: [{ id: dto.parent_comment_id }, { parent_comment_id: dto.parent_comment_id }] }, select: { author_id: true } });
            thread.forEach((t) => t.author_id && t.author_id !== actor.user_id && notify.add(t.author_id));
        }
        if (notify.size) await this.notifications.notifyMany([...notify], { organization_id: artifact.organization_id, event: 'ARTIFACT_COMMENT', title: `${me?.name ?? me?.email} commented on “${artifact.title}”`, body: dto.content.slice(0, 200), link_path: this.appPath(id) });
        await this.events.toUsers([...notify, actor.user_id], ARTIFACT_UPDATED_EVENT, { artifact_id: id, comments: true });
        return comment;
    }

    async resolveComment(actor: Actor, id: string, commentId: string, resolved: boolean) {
        const { role } = await this.require(actor, id, 'COMMENTER');
        const c = await this.prisma.artifactComment.findFirst({ where: { id: commentId, artifact_id: id, deleted_at: null } });
        if (!c) throw new NotFoundException('Comment not found');
        if (c.author_id !== actor.user_id && ROLE_RANK[role] < ROLE_RANK.EDITOR) throw new ForbiddenException('Only editors or the author can resolve this');
        return this.prisma.artifactComment.update({ where: { id: commentId }, data: { resolved_at: resolved ? new Date() : null } });
    }

    async deleteComment(actor: Actor, id: string, commentId: string) {
        const { role } = await this.require(actor, id, 'COMMENTER');
        const c = await this.prisma.artifactComment.findFirst({ where: { id: commentId, artifact_id: id, deleted_at: null } });
        if (!c) throw new NotFoundException('Comment not found');
        if (c.author_id !== actor.user_id && role !== 'OWNER') throw new ForbiddenException('You can only delete your own comments');
        await this.prisma.artifactComment.update({ where: { id: commentId }, data: { deleted_at: new Date() } });
        return { ok: true };
    }

    // ------------------------------------------------------------------ viewing

    /** Short-lived signed address the app loads in its sandboxed iframe (members never need a cookie on the artifact host). */
    async viewToken(actor: Actor, id: string, versionId?: string) {
        const { artifact, role } = await this.require(actor, id, 'VIEWER');
        if (versionId && ROLE_RANK[role] < ROLE_RANK.EDITOR) throw new ForbiddenException('Only editors can preview earlier versions');
        if (versionId) {
            const v = await this.prisma.artifactVersion.count({ where: { id: versionId, artifact_id: id } });
            if (!v) throw new NotFoundException('Version not found');
        }
        const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: artifact.organization_id }, select: { slug: true } });
        const claims: ArtifactViewClaims = { typ: 'artifact-view', a: id, u: actor.user_id, ...(versionId ? { v: versionId } : {}) };
        const token = await this.jwt.signAsync(claims, { secret: this.config.get('JWT_SECRET'), expiresIn: VIEW_TOKEN_TTL });
        return { url: `${this.publicUrl(org.slug, artifact.slug)}?t=${encodeURIComponent(token)}`, expires_at: new Date(Date.now() + VIEW_TOKEN_TTL * 1000) };
    }

    async exportHtml(actor: Actor, id: string) {
        const { artifact, html } = await this.source(actor, id);
        await this.activity.log({ organization_id: artifact.organization_id, actor_user_id: actor.user_id, action: 'artifact.exported', target_type: 'artifact', target_id: id });
        return { filename: `${artifact.slug}.html`, html };
    }

    appUrlFor(id: string) {
        return `${this.appUrl()}${this.appPath(id)}`;
    }
}
