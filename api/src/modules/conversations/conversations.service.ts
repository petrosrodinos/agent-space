import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ConversationEvents, EventsService, UserEvents } from '@/core/realtime/events.service';
import { AccessService } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { welcomeMessageData } from '../bots/bot-welcome.utils';
import { BOT_BRIEF, USER_BRIEF } from './conversation.select';
import { MessageEventsService } from './message-events.service';
import { AddParticipantsDto, ConversationListQuery, CreateConversationDto, CreateDirectDto, UpdateConversationDto, UpdateMyConversationDto } from './dto/conversation.dto';

const CONVERSATION_INCLUDE = {
    participants: {
        where: { left_at: null },
        include: { user: { select: USER_BRIEF }, bot: { select: BOT_BRIEF } },
        orderBy: { joined_at: 'asc' },
    },
    lead_bot: { select: BOT_BRIEF },
} satisfies Prisma.ConversationInclude;

@Injectable()
export class ConversationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: AccessService,
        private readonly events: EventsService,
        private readonly activity: ActivityService,
        private readonly messageEvents: MessageEventsService,
    ) { }

    private shape(c: Prisma.ConversationGetPayload<{ include: typeof CONVERSATION_INCLUDE }>, me?: { is_favourite: boolean; is_archived: boolean; is_muted: boolean; unread_count: number; folder_id: string | null; last_read_at: Date | null }) {
        const bots = c.participants.filter((p) => p.bot).map((p) => ({ ...p.bot!, participant_id: p.id }));
        const users = c.participants.filter((p) => p.user).map((p) => ({ ...p.user!, participant_id: p.id }));
        const first = bots[0];
        return {
            id: c.id,
            type: c.type,
            name: c.name ?? (c.type === 'DIRECT' ? first?.name : null) ?? 'Conversation',
            emoji: c.emoji ?? (c.type !== 'GROUP' ? first?.emoji : null) ?? '💬',
            color: c.color ?? (c.type !== 'GROUP' ? first?.color : null) ?? '#6B4EFF',
            lead_bot: c.lead_bot,
            is_temporary: c.is_temporary,
            created_by_id: c.created_by_id,
            last_message_at: c.last_message_at,
            message_count: c.message_count,
            created_at: c.created_at,
            bots,
            users,
            me: me ?? null,
        };
    }

    async list(actor: Actor, q: ConversationListQuery) {
        const parts = await this.prisma.conversationParticipant.findMany({
            where: {
                user_id: actor.user_id,
                left_at: null,
                is_archived: q.archived ? true : false,
                conversation: {
                    organization_id: actor.organization_id,
                    deleted_at: null,
                    is_temporary: false,
                    ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { participants: { some: { bot: { name: { contains: q.search, mode: 'insensitive' } } } } }] } : {}),
                },
            },
            include: {
                conversation: {
                    include: {
                        ...CONVERSATION_INCLUDE,
                        messages: {
                            where: { deleted_at: null, parent_message_id: null },
                            orderBy: { created_at: 'desc' },
                            take: 1,
                            select: { id: true, content: true, author_type: true, created_at: true, author_bot: { select: { name: true } }, author_user: { select: { name: true } } },
                        },
                        approvals: { where: { status: 'PENDING', requested_from_id: actor.user_id }, select: { id: true } },
                        runs: { where: { status: { in: ['QUEUED', 'RUNNING'] } }, select: { id: true, bot_id: true } },
                    },
                },
            },
            orderBy: { conversation: { last_message_at: { sort: 'desc', nulls: 'last' } } },
            take: 300,
        });
        return parts.map((p) => {
            const c = p.conversation;
            const last = c.messages[0];
            return {
                ...this.shape(c, p),
                last_message: last
                    ? { id: last.id, preview: (last.content ?? '').replace(/[*_`#>|]+/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 140), author_type: last.author_type, author_name: last.author_bot?.name ?? last.author_user?.name ?? null, created_at: last.created_at }
                    : null,
                pending_approvals: c.approvals.length,
                working_bot_ids: c.runs.map((r) => r.bot_id),
            };
        });
    }

    async get(actor: Actor, id: string) {
        const me = await this.access.requireParticipant(id, actor.user_id);
        if (me.conversation.organization_id !== actor.organization_id) throw new NotFoundException('Conversation not found');
        const c = await this.prisma.conversation.findUniqueOrThrow({ where: { id }, include: CONVERSATION_INCLUDE });
        return this.shape(c, me);
    }

    /** One user + one bot. Re-uses an existing direct chat unless a temporary chat is requested. */
    async getOrCreateDirect(actor: Actor, dto: CreateDirectDto) {
        const bot = await this.access.requireUsableBot(actor.organization_id, actor.user_id, dto.bot_id);
        if (dto.is_temporary) {
            const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } });
            if (s && !s.temporary_chats_allowed) throw new ForbiddenException('Temporary chats are turned off for this organisation');
        } else {
            const existing = await this.prisma.conversation.findFirst({
                where: {
                    organization_id: actor.organization_id,
                    type: 'DIRECT',
                    deleted_at: null,
                    is_temporary: false,
                    AND: [{ participants: { some: { user_id: actor.user_id, left_at: null } } }, { participants: { some: { bot_id: bot.id } } }],
                },
            });
            if (existing) {
                await this.prisma.conversationParticipant.updateMany({ where: { conversation_id: existing.id, user_id: actor.user_id }, data: { is_archived: false } });
                return this.get(actor, existing.id);
            }
        }
        // A new direct chat opens with the bot's greeting as its first message, never an empty screen.
        const now = new Date();
        const c = await this.prisma.$transaction(async (tx) => {
            const created = await tx.conversation.create({
                data: {
                    organization_id: actor.organization_id,
                    type: 'DIRECT',
                    created_by_id: actor.user_id,
                    lead_bot_id: bot.id,
                    is_temporary: !!dto.is_temporary,
                    last_message_at: now,
                    message_count: 1,
                    participants: { create: [{ user_id: actor.user_id, last_read_at: now }, { bot_id: bot.id }] },
                },
            });
            await tx.message.create({ data: welcomeMessageData(actor.organization_id, created.id, bot, now) });
            return created;
        });
        await this.events.toUser(actor.user_id, UserEvents.CONVERSATIONS_CHANGED, { conversation_id: c.id });
        return this.get(actor, c.id);
    }

    private async validateUsers(orgId: string, userIds: string[]) {
        if (!userIds.length) return;
        const n = await this.prisma.organizationMember.count({ where: { organization_id: orgId, user_id: { in: userIds } } });
        if (n !== new Set(userIds).size) throw new BadRequestException('Only members of this organisation can be added (§7.2: no outside guests)');
    }

    private async validateBots(actor: Actor, botIds: string[]) {
        for (const id of new Set(botIds)) await this.access.requireUsableBot(actor.organization_id, actor.user_id, id);
    }

    async create(actor: Actor, dto: CreateConversationDto) {
        if (!dto.bot_ids.length) throw new BadRequestException('Add at least one bot');
        if (dto.type === 'SHARED_BOT' && dto.bot_ids.length !== 1) throw new BadRequestException('A shared bot chat has exactly one bot');
        const userIds = [...new Set([actor.user_id, ...(dto.user_ids ?? [])])];
        await this.validateUsers(actor.organization_id, userIds);
        await this.validateBots(actor, dto.bot_ids);
        const lead = dto.lead_bot_id && dto.bot_ids.includes(dto.lead_bot_id) ? dto.lead_bot_id : dto.bot_ids[0];
        const c = await this.prisma.conversation.create({
            data: {
                organization_id: actor.organization_id,
                type: dto.type,
                name: dto.name?.trim() || null,
                emoji: dto.emoji,
                color: dto.color,
                created_by_id: actor.user_id,
                lead_bot_id: lead,
                participants: { create: [...userIds.map((user_id) => ({ user_id })), ...[...new Set(dto.bot_ids)].map((bot_id) => ({ bot_id }))] },
            },
        });
        await this.events.toUsers(userIds, UserEvents.CONVERSATIONS_CHANGED, { conversation_id: c.id });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'conversation.created', target_type: 'conversation', target_id: c.id, metadata: { type: dto.type } });
        return this.get(actor, c.id);
    }

    async update(actor: Actor, id: string, dto: UpdateConversationDto) {
        const me = await this.access.requireParticipant(id, actor.user_id);
        if (dto.lead_bot_id) {
            const isBot = await this.prisma.conversationParticipant.count({ where: { conversation_id: id, bot_id: dto.lead_bot_id, left_at: null } });
            if (!isBot) throw new BadRequestException('The lead bot must be in the conversation');
        }
        await this.prisma.conversation.update({ where: { id: me.conversation_id }, data: dto });
        await this.broadcastChanged(id);
        return this.get(actor, id);
    }

    async updateMine(actor: Actor, id: string, dto: UpdateMyConversationDto) {
        const me = await this.access.requireParticipant(id, actor.user_id);
        if (dto.folder_id) {
            const f = await this.prisma.conversationFolder.findFirst({ where: { id: dto.folder_id, user_id: actor.user_id } });
            if (!f) throw new BadRequestException('Unknown folder');
        }
        await this.prisma.conversationParticipant.update({ where: { id: me.id }, data: dto });
        await this.events.toUser(actor.user_id, UserEvents.CONVERSATIONS_CHANGED, { conversation_id: id });
        return { ok: true };
    }

    async markRead(actor: Actor, id: string) {
        const me = await this.access.requireParticipant(id, actor.user_id);
        await this.prisma.conversationParticipant.update({ where: { id: me.id }, data: { unread_count: 0, last_read_at: new Date() } });
        return { ok: true };
    }

    async addParticipants(actor: Actor, id: string, dto: AddParticipantsDto) {
        const me = await this.access.requireParticipant(id, actor.user_id);
        if (me.conversation.type === 'DIRECT') throw new BadRequestException('Turn this into a group to add people or bots');
        const userIds = dto.user_ids ?? [];
        const botIds = dto.bot_ids ?? [];
        if (me.conversation.type === 'SHARED_BOT' && botIds.length) throw new BadRequestException('A shared bot chat has one bot. Create a group to add more bots.');
        await this.validateUsers(actor.organization_id, userIds);
        await this.validateBots(actor, botIds);
        for (const user_id of userIds) {
            await this.prisma.conversationParticipant.upsert({
                where: { conversation_id_user_id: { conversation_id: id, user_id } },
                create: { conversation_id: id, user_id },
                update: { left_at: null },
            });
        }
        for (const bot_id of botIds) {
            await this.prisma.conversationParticipant.upsert({
                where: { conversation_id_bot_id: { conversation_id: id, bot_id } },
                create: { conversation_id: id, bot_id },
                update: { left_at: null },
            });
        }
        await this.systemMessage(id, actor.organization_id, `${await this.userName(actor.user_id)} added ${await this.describe(userIds, botIds)}`);
        await this.events.toUsers(userIds, UserEvents.CONVERSATIONS_CHANGED, { conversation_id: id });
        await this.broadcastChanged(id);
        return this.get(actor, id);
    }

    async removeParticipant(actor: Actor, id: string, participantId: string) {
        const me = await this.access.requireParticipant(id, actor.user_id);
        const p = await this.prisma.conversationParticipant.findFirst({ where: { id: participantId, conversation_id: id, left_at: null } });
        if (!p) throw new NotFoundException('Participant not found');
        if (me.conversation.type === 'DIRECT') throw new BadRequestException('You cannot remove participants from a direct chat');
        if (p.bot_id) {
            const remaining = await this.prisma.conversationParticipant.count({ where: { conversation_id: id, bot_id: { not: null }, left_at: null } });
            if (remaining <= 1) throw new BadRequestException('A conversation needs at least one bot');
        }
        await this.prisma.conversationParticipant.update({ where: { id: p.id }, data: { left_at: new Date() } });
        if (p.bot_id && me.conversation.lead_bot_id === p.bot_id) {
            const next = await this.prisma.conversationParticipant.findFirst({ where: { conversation_id: id, bot_id: { not: null }, left_at: null } });
            await this.prisma.conversation.update({ where: { id }, data: { lead_bot_id: next?.bot_id ?? null } });
        }
        const label = p.user_id === actor.user_id ? `${await this.userName(actor.user_id)} left` : `${await this.userName(actor.user_id)} removed ${await this.describe(p.user_id ? [p.user_id] : [], p.bot_id ? [p.bot_id] : [])}`;
        await this.systemMessage(id, actor.organization_id, label);
        if (p.user_id) await this.events.toUser(p.user_id, UserEvents.CONVERSATIONS_CHANGED, { conversation_id: id });
        await this.broadcastChanged(id);
        return { ok: true };
    }

    async remove(actor: Actor, id: string) {
        const me = await this.access.requireParticipant(id, actor.user_id);
        const others = await this.prisma.conversationParticipant.count({ where: { conversation_id: id, user_id: { not: actor.user_id }, left_at: null } });
        if (others > 0 && me.conversation.created_by_id !== actor.user_id) {
            // Leaving a shared conversation instead of deleting it for everyone.
            await this.prisma.conversationParticipant.update({ where: { id: me.id }, data: { left_at: new Date() } });
        } else {
            await this.prisma.conversation.update({ where: { id }, data: { deleted_at: new Date() } });
            await this.prisma.file.updateMany({ where: { conversation_id: id, deleted_at: null }, data: { deleted_at: new Date(), purge_after: new Date(Date.now() + 30 * 86400_000) } });
        }
        await this.events.toUser(actor.user_id, UserEvents.CONVERSATIONS_CHANGED, { conversation_id: id });
        return { ok: true };
    }

    // ---- Folders ----
    folders(actor: Actor) {
        return this.prisma.conversationFolder.findMany({ where: { user_id: actor.user_id, organization_id: actor.organization_id }, orderBy: { sort_order: 'asc' } });
    }

    createFolder(actor: Actor, name: string) {
        return this.prisma.conversationFolder.create({ data: { user_id: actor.user_id, organization_id: actor.organization_id, name } });
    }

    async deleteFolder(actor: Actor, id: string) {
        await this.prisma.conversationFolder.deleteMany({ where: { id, user_id: actor.user_id } });
        return { ok: true };
    }

    // ---- helpers ----

    async participantUserIds(conversationId: string) {
        const rows = await this.prisma.conversationParticipant.findMany({ where: { conversation_id: conversationId, user_id: { not: null }, left_at: null }, select: { user_id: true } });
        return rows.map((r) => r.user_id!);
    }

    private async broadcastChanged(id: string) {
        await this.events.toConversation(id, ConversationEvents.CONVERSATION_UPDATED, { conversation_id: id });
        await this.events.toUsers(await this.participantUserIds(id), UserEvents.CONVERSATIONS_CHANGED, { conversation_id: id });
    }

    private async userName(id: string) {
        const u = await this.prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
        return u?.name || u?.email || 'Someone';
    }

    private async describe(userIds: string[], botIds: string[]) {
        const [users, bots] = await Promise.all([
            this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { name: true, email: true } }),
            this.prisma.bot.findMany({ where: { id: { in: botIds } }, select: { name: true } }),
        ]);
        return [...users.map((u) => u.name || u.email), ...bots.map((b) => b.name)].join(', ');
    }

    async systemMessage(conversationId: string, orgId: string, text: string) {
        const m = await this.prisma.message.create({
            data: { organization_id: orgId, conversation_id: conversationId, author_type: 'SYSTEM', content: text, parts: [{ type: 'text', text }] },
        });
        await this.messageEvents.created(m.id);
        return m;
    }
}
