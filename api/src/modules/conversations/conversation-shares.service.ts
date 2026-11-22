import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationShareMode, MessageAuthorType, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { randomToken } from '@/shared/utils/security/crypto.utils';
import { AccessService } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { SaveShareDto, SharedConversationQuery } from './dto/conversation.dto';

const PUBLIC_MESSAGE_SELECT = {
    id: true, author_type: true, content: true, status: true, created_at: true, updated_at: true, edited_at: true, deleted_at: true, parts: true,
    author_user: { select: { name: true } },
    author_bot: { select: { name: true, avatar_seed: true, color: true } },
    files: { select: { file: { select: { filename: true, mimetype: true } } } },
} satisfies Prisma.MessageSelect;

type PublicMessageRow = Prisma.MessageGetPayload<{ select: typeof PUBLIC_MESSAGE_SELECT }>;

/**
 * Public, read-only links to a conversation. The link is the credential, so only what a reader needs leaves here:
 * author names, text, file names and source links. No ids of people, files, runs or tool activity, and nothing a viewer could act on.
 */
@Injectable()
export class ConversationSharesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly config: ConfigService,
    ) { }

    private url(token: string) {
        return `${(this.config.get<string>('APP_URL') || 'http://localhost:5173').replace(/\/$/, '')}/s/${token}`;
    }

    private shape(s: { token: string; mode: ConversationShareMode; cutoff_at: Date; created_at: Date }) {
        return { url: this.url(s.token), mode: s.mode, cutoff_at: s.cutoff_at, created_at: s.created_at };
    }

    async get(actor: Actor, conversationId: string) {
        await this.access.requireParticipant(conversationId, actor.user_id);
        const s = await this.prisma.conversationShare.findUnique({ where: { conversation_id: conversationId } });
        return { share: s ? this.shape(s) : null };
    }

    /** Creates the link, or changes the mode of the existing one (the URL stays the same). */
    async save(actor: Actor, conversationId: string, dto: SaveShareDto) {
        const me = await this.access.requireParticipant(conversationId, actor.user_id);
        if (me.conversation.is_temporary) throw new ConflictException("Temporary chats can't be shared");
        const sensitive = await this.prisma.conversationParticipant.count({ where: { conversation_id: conversationId, left_at: null, bot: { is_sensitive: true } } });
        if (sensitive > 0) throw new ConflictException("This conversation includes a sensitive bot and can't be shared");

        const existing = await this.prisma.conversationShare.findUnique({ where: { conversation_id: conversationId } });
        const now = new Date();
        const moveCutoff = !existing || (dto.mode === ConversationShareMode.SNAPSHOT && (existing.mode !== dto.mode || dto.refresh));
        const share = existing
            ? await this.prisma.conversationShare.update({ where: { id: existing.id }, data: { mode: dto.mode, ...(moveCutoff ? { cutoff_at: now } : {}) } })
            : await this.prisma.conversationShare.create({ data: { conversation_id: conversationId, created_by_id: actor.user_id, token: randomToken(24), mode: dto.mode, cutoff_at: now } });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: existing ? 'conversation.share_updated' : 'conversation.shared', target_type: 'conversation', target_id: conversationId });
        return { share: this.shape(share) };
    }

    async stop(actor: Actor, conversationId: string) {
        await this.access.requireParticipant(conversationId, actor.user_id);
        const res = await this.prisma.conversationShare.deleteMany({ where: { conversation_id: conversationId } });
        if (res.count) await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'conversation.share_stopped', target_type: 'conversation', target_id: conversationId });
        return { ok: true };
    }

    private publicMessage(m: PublicMessageRow) {
        if (m.deleted_at) return { id: m.id, deleted: true as const };
        const sources = Array.isArray(m.parts)
            ? (m.parts as any[])
                .filter((p) => p?.type === 'sources' && Array.isArray(p.sources))
                .flatMap((p) => p.sources as { url: string; title: string | null }[])
                .filter((x) => typeof x?.url === 'string' && /^https?:\/\//i.test(x.url))
                .map((x) => ({ url: x.url, title: x.title ?? null }))
            : [];
        return {
            id: m.id,
            deleted: false as const,
            author_type: m.author_type,
            author_name: m.author_type === MessageAuthorType.BOT ? (m.author_bot?.name ?? 'Assistant') : (m.author_user?.name ?? 'Someone'),
            author_avatar_seed: m.author_bot?.avatar_seed ?? null,
            author_color: m.author_bot?.color ?? null,
            content: m.content,
            status: m.status,
            created_at: m.created_at,
            updated_at: m.updated_at,
            edited_at: m.edited_at,
            files: m.files.map((f) => ({ filename: f.file.filename, mimetype: f.file.mimetype })),
            sources,
        };
    }

    /**
     * Anonymous read. `before` pages back through history; `since` returns what changed after that moment (live links poll with it,
     * and get deleted messages as `{ id, deleted: true }` tombstones). A SNAPSHOT link never shows messages newer than its cut-off.
     */
    async readPublic(token: string, q: SharedConversationQuery) {
        const share = await this.prisma.conversationShare.findUnique({
            where: { token },
            include: {
                created_by: { select: { name: true } },
                conversation: {
                    select: {
                        id: true, name: true, color: true, type: true, deleted_at: true,
                        participants: { where: { left_at: null, bot_id: { not: null } }, select: { bot: { select: { name: true, avatar_seed: true, color: true } } } },
                    },
                },
            },
        });
        if (!share || share.conversation.deleted_at) throw new NotFoundException("This link isn't available anymore");

        const live = share.mode === ConversationShareMode.LIVE;
        const created: Prisma.DateTimeFilter = { ...(live ? {} : { lte: share.cutoff_at }), ...(q.before && !q.since ? { lt: new Date(q.before) } : {}) };
        const where: Prisma.MessageWhereInput = {
            conversation_id: share.conversation_id,
            ...(Object.keys(created).length ? { created_at: created } : {}),
            ...(q.since ? { updated_at: { gt: new Date(q.since) } } : { deleted_at: null }),
        };
        const rows = await this.prisma.message.findMany({
            where,
            select: PUBLIC_MESSAGE_SELECT,
            orderBy: q.since ? { updated_at: 'asc' } : { created_at: 'desc' },
            take: q.limit + 1,
        });
        const has_more = !q.since && rows.length > q.limit;
        const page = q.since ? rows.slice(0, q.limit) : rows.slice(0, q.limit).reverse();

        const c = share.conversation;
        const first = c.participants[0]?.bot;
        const cursor = q.since ? (page.length ? page[page.length - 1].updated_at : new Date(q.since)) : new Date();
        return {
            conversation: {
                name: c.name ?? (c.type === 'DIRECT' ? first?.name : null) ?? 'Conversation',
                color: c.color ?? (c.type !== 'GROUP' ? first?.color : null) ?? null,
                bots: c.participants.map((p) => p.bot!).filter(Boolean),
            },
            mode: share.mode,
            shared_by: share.created_by?.name ?? null,
            shared_at: share.created_at,
            cutoff_at: live ? null : share.cutoff_at,
            messages: page.map((m) => this.publicMessage(m)),
            has_more,
            /** Where the next `since` poll starts: the newest change seen, or the old cursor when nothing changed. */
            cursor: cursor.toISOString(),
        };
    }
}
