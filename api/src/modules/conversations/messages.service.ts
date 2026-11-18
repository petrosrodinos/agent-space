import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Bot, Conversation, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ConversationEvents, EventsService, UserEvents } from '@/core/realtime/events.service';
import { maskSecretsInText } from '@/shared/utils/security/secret-detection.utils';
import { AccessService } from '../access/access.service';
import type { Actor } from '../bots/bots.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RunsService } from '../runs/runs.service';
import { MESSAGE_INCLUDE, serializeMessage } from './conversation.select';
import { MessageEventsService } from './message-events.service';
import { EditMessageDto, InteractionDto, MessagesQuery, RetryMessageDto, SendMessageDto } from './dto/conversation.dto';

@Injectable()
export class MessagesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: AccessService,
        private readonly events: EventsService,
        private readonly messageEvents: MessageEventsService,
        private readonly runs: RunsService,
        private readonly notifications: NotificationsService,
    ) { }

    async list(actor: Actor, conversationId: string, q: MessagesQuery) {
        await this.access.requireParticipant(conversationId, actor.user_id);
        const rows = await this.prisma.message.findMany({
            where: {
                conversation_id: conversationId,
                deleted_at: null,
                ...(q.before ? { created_at: { lt: new Date(q.before) } } : {}),
                ...(q.search ? { content: { contains: q.search, mode: 'insensitive' } } : {}),
            },
            include: MESSAGE_INCLUDE,
            orderBy: { created_at: 'desc' },
            take: q.limit + 1,
        });
        const has_more = rows.length > q.limit;
        const page = rows.slice(0, q.limit).reverse();
        return { data: page.map((m) => serializeMessage(m, actor.user_id)), has_more };
    }

    async pinned(actor: Actor, conversationId: string) {
        await this.access.requireParticipant(conversationId, actor.user_id);
        const rows = await this.prisma.message.findMany({ where: { conversation_id: conversationId, is_pinned: true, deleted_at: null }, include: MESSAGE_INCLUDE, orderBy: { pinned_at: 'desc' } });
        return rows.map((m) => serializeMessage(m, actor.user_id));
    }

    private botsOf(conversationId: string) {
        return this.prisma.conversationParticipant
            .findMany({ where: { conversation_id: conversationId, bot_id: { not: null }, left_at: null, bot: { deleted_at: null } }, include: { bot: true } })
            .then((rows) => rows.map((r) => r.bot!));
    }

    /** Finds `@Name` mentions, longest names first so "@Sales Sam" beats "@Sales". */
    private findMentions<T extends { id: string; name: string }>(text: string, candidates: T[]): T[] {
        const lower = text.toLowerCase();
        const found = new Map<string, T>();
        for (const c of [...candidates].sort((a, b) => b.name.length - a.name.length)) {
            const needle = `@${c.name.toLowerCase()}`;
            const idx = lower.indexOf(needle);
            if (idx >= 0) {
                const next = lower[idx + needle.length];
                if (!next || /[\s,.!?:;)]/.test(next)) found.set(c.id, c);
            } else {
                const first = c.name.split(/\s+/)[0]?.toLowerCase();
                if (first && first.length >= 3 && new RegExp(`@${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i').test(text)) found.set(c.id, c);
            }
        }
        return [...found.values()];
    }

    /** §7.2 groups: mentioned bots answer; otherwise the lead bot coordinates unless the user only wants mentioned bots. */
    private async responders(conv: Conversation, bots: Bot[], text: string, userId: string): Promise<Bot[]> {
        if (!bots.length) return [];
        if (conv.type !== 'GROUP') return [bots[0]];
        const mentioned = this.findMentions(text, bots);
        if (mentioned.length) return mentioned;
        const settings = await this.prisma.userSettings.findUnique({ where: { user_id: userId } });
        if (settings?.group_reply_mode === 'ONLY_WHEN_MENTIONED') return [];
        const eligible = bots.filter((b) => b.group_response === 'WHEN_RELEVANT_OR_MENTIONED');
        const lead = eligible.find((b) => b.id === conv.lead_bot_id) ?? eligible[0];
        return lead ? [lead] : [];
    }

    /** `/client-onboarding` style skill mentions (§6.7). */
    private async findSkill(actor: Actor, text: string) {
        const m = /(?:^|\s)\/([a-z0-9][a-z0-9-]{1,60})\b/i.exec(text);
        if (!m) return null;
        return this.prisma.skill.findFirst({
            where: { slug: m[1].toLowerCase(), ...this.access.usableSkillsWhere(actor.organization_id, actor.user_id) },
            orderBy: { organization_id: { sort: 'desc', nulls: 'last' } },
        });
    }

    async send(actor: Actor, conversationId: string, dto: SendMessageDto) {
        const me = await this.access.requireParticipant(conversationId, actor.user_id);
        const conv = me.conversation;
        if (conv.organization_id !== actor.organization_id) throw new NotFoundException('Conversation not found');

        // §8.8 second line of defence: likely secrets are masked before storage and before the model sees them.
        const { text, masked } = maskSecretsInText(dto.content);

        if (dto.file_ids?.length) {
            const n = await this.prisma.file.count({ where: { id: { in: dto.file_ids }, uploaded_by_id: actor.user_id, status: 'READY', deleted_at: null } });
            if (n !== dto.file_ids.length) throw new BadRequestException('Some files are not ready or not yours');
        }
        if (dto.parent_message_id) {
            const parent = await this.prisma.message.count({ where: { id: dto.parent_message_id, conversation_id: conversationId } });
            if (!parent) throw new BadRequestException('Unknown thread');
        }

        const bots = await this.botsOf(conversationId);
        const users = await this.prisma.conversationParticipant.findMany({ where: { conversation_id: conversationId, user_id: { not: null }, left_at: null }, include: { user: { select: { id: true, name: true, email: true } } } });
        const mentionedUsers = this.findMentions(text, users.map((u) => ({ id: u.user!.id, name: u.user!.name || u.user!.email })));
        const responders = await this.responders(conv, bots, text, actor.user_id);
        const skill = await this.findSkill(actor, text);

        const message = await this.prisma.$transaction(async (tx) => {
            const m = await tx.message.create({
                data: {
                    organization_id: conv.organization_id,
                    conversation_id: conversationId,
                    author_type: 'USER',
                    author_user_id: actor.user_id,
                    source: dto.source ?? 'TEXT',
                    content: text,
                    parts: [{ type: 'text', text }, ...(dto.client_id ? [{ type: 'client-ref', client_id: dto.client_id }] : [])] as Prisma.InputJsonValue,
                    parent_message_id: dto.parent_message_id,
                    secret_masked: masked,
                    files: dto.file_ids?.length ? { create: dto.file_ids.map((file_id, i) => ({ file_id, sort_order: i })) } : undefined,
                    mentions: {
                        create: [
                            ...responders.filter((b) => this.findMentions(text, [b]).length).map((b) => ({ bot_id: b.id })),
                            ...mentionedUsers.map((u) => ({ user_id: u.id })),
                            ...(skill ? [{ skill_id: skill.id }] : []),
                        ],
                    },
                },
            });
            if (dto.file_ids?.length) await tx.file.updateMany({ where: { id: { in: dto.file_ids } }, data: { conversation_id: conversationId } });
            await tx.conversation.update({ where: { id: conversationId }, data: { last_message_at: new Date(), message_count: { increment: 1 } } });
            await tx.conversationParticipant.updateMany({ where: { conversation_id: conversationId, user_id: { not: actor.user_id }, left_at: null }, data: { unread_count: { increment: 1 } } });
            await tx.conversationParticipant.updateMany({ where: { conversation_id: conversationId, user_id: actor.user_id }, data: { last_read_at: new Date(), unread_count: 0 } });
            return m;
        });

        const serialized = await this.messageEvents.created(message.id);
        const others = users.map((u) => u.user_id!).filter((id) => id !== actor.user_id);
        await this.events.toUsers([actor.user_id, ...others], UserEvents.CONVERSATIONS_CHANGED, { conversation_id: conversationId });
        if (mentionedUsers.length) {
            const author = await this.prisma.user.findUnique({ where: { id: actor.user_id }, select: { name: true, email: true } });
            await this.notifications.notifyMany(mentionedUsers.map((u) => u.id).filter((id) => id !== actor.user_id), {
                organization_id: conv.organization_id,
                event: 'MENTION',
                title: `${author?.name || author?.email} mentioned you`,
                body: text.slice(0, 200),
                link_path: `/c/${conversationId}`,
            });
        }

        const runs = [];
        for (const bot of responders) {
            runs.push(
                await this.runs.start({
                    organization_id: conv.organization_id,
                    conversation_id: conversationId,
                    bot_id: bot.id,
                    user_id: actor.user_id,
                    type: 'CHAT_REPLY',
                    trigger_message_id: message.id,
                    skill_id: skill?.id ?? null,
                }),
            );
        }
        return { message: serialized, runs: runs.map((r) => ({ id: r.id, bot_id: r.bot_id, status: r.status })), secret_masked: masked };
    }

    private async ownUserMessage(actor: Actor, id: string) {
        const m = await this.prisma.message.findFirst({ where: { id, deleted_at: null, conversation: { organization_id: actor.organization_id } } });
        if (!m) throw new NotFoundException('Message not found');
        await this.access.requireParticipant(m.conversation_id, actor.user_id);
        return m;
    }

    async edit(actor: Actor, id: string, dto: EditMessageDto) {
        const m = await this.ownUserMessage(actor, id);
        if (m.author_user_id !== actor.user_id) throw new ForbiddenException('You can only edit your own messages');
        const { text, masked } = maskSecretsInText(dto.content);
        await this.prisma.message.update({ where: { id }, data: { content: text, parts: [{ type: 'text', text }], edited_at: new Date(), secret_masked: m.secret_masked || masked } });
        await this.messageEvents.publish(id);
        if (dto.rerun) {
            const prev = await this.prisma.run.findMany({ where: { trigger_message_id: id }, select: { bot_id: true, skill_id: true }, distinct: ['bot_id'] });
            for (const r of prev) {
                await this.runs.start({ organization_id: actor.organization_id, conversation_id: m.conversation_id, bot_id: r.bot_id, user_id: actor.user_id, type: 'CHAT_REPLY', trigger_message_id: id, skill_id: r.skill_id });
            }
        }
        return this.messageEvents.load(id);
    }

    /** Retry a bot reply, optionally with another model to compare (§6.4) or as a new branch (§7.2). */
    async retry(actor: Actor, id: string, dto: RetryMessageDto) {
        const m = await this.ownUserMessage(actor, id);
        if (m.author_type !== 'BOT' || !m.author_bot_id) throw new BadRequestException('Only bot replies can be retried');
        const run = m.run_id ? await this.prisma.run.findUnique({ where: { id: m.run_id } }) : null;
        if (dto.model_id) {
            const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } });
            if (s && !s.model_compare_enabled) throw new ForbiddenException('Comparing models is turned off for this organisation');
        }
        const started = await this.runs.start({
            organization_id: actor.organization_id,
            conversation_id: m.conversation_id,
            bot_id: m.author_bot_id,
            user_id: actor.user_id,
            type: 'CHAT_REPLY',
            trigger_message_id: run?.trigger_message_id ?? null,
            skill_id: run?.skill_id ?? null,
            model_override_id: dto.model_id ?? null,
            branch_from_message_id: m.id,
        });
        return { run: { id: started.id, status: started.status } };
    }

    async remove(actor: Actor, id: string) {
        const m = await this.ownUserMessage(actor, id);
        if (m.author_user_id !== actor.user_id) throw new ForbiddenException('You can only delete your own messages');
        await this.prisma.message.update({ where: { id }, data: { deleted_at: new Date(), content: null, parts: Prisma.DbNull } });
        await this.prisma.file.updateMany({ where: { messages: { some: { message_id: id } } }, data: { deleted_at: new Date(), purge_after: new Date(Date.now() + 30 * 86400_000) } });
        await this.events.toConversation(m.conversation_id, ConversationEvents.MESSAGE_DELETED, { id, conversation_id: m.conversation_id });
        return { ok: true };
    }

    async react(actor: Actor, id: string, emoji: string) {
        const m = await this.ownUserMessage(actor, id);
        const existing = await this.prisma.messageReaction.findUnique({ where: { message_id_user_id_emoji: { message_id: id, user_id: actor.user_id, emoji } } });
        if (existing) await this.prisma.messageReaction.delete({ where: { id: existing.id } });
        else await this.prisma.messageReaction.create({ data: { message_id: id, user_id: actor.user_id, emoji } });
        await this.messageEvents.publish(m.id);
        return { ok: true };
    }

    async togglePin(actor: Actor, id: string) {
        const m = await this.ownUserMessage(actor, id);
        await this.prisma.message.update({
            where: { id },
            data: m.is_pinned ? { is_pinned: false, pinned_by_id: null, pinned_at: null } : { is_pinned: true, pinned_by_id: actor.user_id, pinned_at: new Date() },
        });
        await this.messageEvents.publish(id);
        return { ok: true, is_pinned: !m.is_pinned };
    }

    /**
     * §7.4 Users act inside an interactive reply. The input is stored (combined across group members) and goes back to the bot,
     * which continues the work.
     */
    async interact(actor: Actor, id: string, dto: InteractionDto) {
        const m = await this.ownUserMessage(actor, id);
        if (m.author_type !== 'BOT' || !m.author_bot_id) throw new BadRequestException('Not an interactive reply');
        await this.prisma.interactiveResponse.create({ data: { message_id: id, component_id: dto.component_id, user_id: actor.user_id, payload: dto.payload as Prisma.InputJsonValue } });
        const all = await this.prisma.interactiveResponse.findMany({ where: { message_id: id, component_id: dto.component_id } });
        const summary = Object.entries(dto.payload)
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
            .join('\n');
        const content = `[Response to "${dto.component_id}"]\n${summary}`.slice(0, 8000);
        const userMsg = await this.prisma.message.create({
            data: {
                organization_id: actor.organization_id,
                conversation_id: m.conversation_id,
                author_type: 'USER',
                author_user_id: actor.user_id,
                content,
                parts: [{ type: 'interaction', message_id: id, component_id: dto.component_id, payload: dto.payload, total_responses: all.length }] as Prisma.InputJsonValue,
            },
        });
        await this.prisma.conversation.update({ where: { id: m.conversation_id }, data: { last_message_at: new Date(), message_count: { increment: 1 } } });
        await this.messageEvents.created(userMsg.id);
        await this.runs.start({ organization_id: actor.organization_id, conversation_id: m.conversation_id, bot_id: m.author_bot_id, user_id: actor.user_id, type: 'CHAT_REPLY', trigger_message_id: userMsg.id });
        return { ok: true, total_responses: all.length };
    }

    async interactionResponses(actor: Actor, id: string) {
        await this.ownUserMessage(actor, id);
        return this.prisma.interactiveResponse.findMany({ where: { message_id: id }, orderBy: { created_at: 'asc' } });
    }

    /** §7.2 Global search across all conversations the user can access. */
    async search(actor: Actor, q: string) {
        if (!q || q.trim().length < 2) return [];
        const rows = await this.prisma.message.findMany({
            where: {
                organization_id: actor.organization_id,
                deleted_at: null,
                content: { contains: q.trim(), mode: 'insensitive' },
                conversation: { deleted_at: null, is_temporary: false, participants: { some: { user_id: actor.user_id, left_at: null } } },
            },
            include: { conversation: { select: { id: true, name: true, type: true } }, author_bot: { select: { name: true, emoji: true, color: true } }, author_user: { select: { name: true } } },
            orderBy: { created_at: 'desc' },
            take: 30,
        });
        return rows.map((r) => ({
            id: r.id,
            conversation: r.conversation,
            author: r.author_bot ?? r.author_user,
            author_type: r.author_type,
            snippet: (r.content ?? '').slice(0, 240),
            created_at: r.created_at,
        }));
    }
}
