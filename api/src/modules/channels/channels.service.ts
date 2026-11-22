import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomInt } from 'node:crypto';
import { ChannelLinkStatus, ExternalChannel, MessageSource, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { Jobs, Queues } from '@/core/queues/queues.constants';
import { randomToken } from '@/shared/utils/security/crypto.utils';
import { AccessService } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../conversations/messages.service';
import { ChannelTransportService } from './channel-transport.service';
import {
    CHANNEL_LABELS, CHANNEL_MESSAGES_PER_HOUR, ChannelJob, ChannelMeta, InboundMessage, LINK_CODE_TTL_MS, REPLY_MAX_CHARS, ReplyStatus, ReplyStatuses, WEBHOOK_DEDUPE_SECONDS,
} from './channels.constants';

const SOURCE_OF: Record<ExternalChannel, MessageSource> = { EMAIL: MessageSource.EMAIL, SLACK: MessageSource.SLACK, WHATSAPP: MessageSource.WHATSAPP };
const CHANNEL_SOURCES: MessageSource[] = Object.values(SOURCE_OF);
/** "123456" or "link 123456" / "LINK-123456". */
const LINK_CODE_RE = /^\s*(?:link[\s:-]*)?(\d{6})\s*$/i;
const JOB_OPTIONS = { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } };
/** Message parts that only show properly in the app (pages, interactive replies, files…). */
const TEXT_ONLY_PARTS = ['text', 'tool', 'follow-ups', 'reasoning', 'approval'];

/**
 * Message from anywhere (§16): members link email, Slack or WhatsApp to one of their bots. Linked messages go into
 * the member's direct chat with that bot (so the history is in the app too), and the bot's answer is sent back to the
 * same place. Only the linked person can talk to the bot this way.
 */
@Injectable()
export class ChannelsService {
    private readonly logger = new Logger(ChannelsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly config: ConfigService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly conversations: ConversationsService,
        private readonly messages: MessagesService,
        private readonly transport: ChannelTransportService,
        @InjectQueue(Queues.CHANNELS) private readonly queue: Queue<ChannelJob>,
    ) { }

    private get appUrl() {
        return (this.config.get<string>('APP_URL') || '').replace(/\/$/, '');
    }

    // ---------------- Settings (the member's own links) ----------------

    private view(l: { id: string; channel: ExternalChannel; status: ChannelLinkStatus; external_id: string | null; inbound_token: string | null; link_code: string | null; link_code_expires_at: Date | null; last_message_at: Date | null; created_at: Date; bot: { id: string; name: string; avatar_seed: string; color: string | null } }) {
        const codeValid = !!l.link_code && !!l.link_code_expires_at && l.link_code_expires_at > new Date();
        return {
            id: l.id,
            channel: l.channel,
            status: l.status,
            bot: l.bot,
            /** Where the member writes to: their personal email address, or the WhatsApp number. */
            address: l.channel === ExternalChannel.EMAIL && l.inbound_token ? `${l.inbound_token}@${this.transport.inboundDomain}` : l.channel === ExternalChannel.WHATSAPP ? this.transport.whatsappNumber : null,
            /** Linked identity, shown masked: Slack user id or the last digits of the phone number. */
            linked_as: l.external_id ? (l.channel === ExternalChannel.WHATSAPP ? `•••• ${l.external_id.slice(-4)}` : l.external_id.split(':')[1] ?? l.external_id) : null,
            link_code: l.status === ChannelLinkStatus.PENDING && codeValid ? l.link_code : null,
            link_code_expires_at: l.status === ChannelLinkStatus.PENDING && codeValid ? l.link_code_expires_at : null,
            last_message_at: l.last_message_at,
            created_at: l.created_at,
        };
    }

    private readonly linkInclude = { bot: { select: { id: true, name: true, avatar_seed: true, color: true } } } as const;

    async list(actor: Actor) {
        const links = await this.prisma.channelLink.findMany({ where: { organization_id: actor.organization_id, user_id: actor.user_id }, include: this.linkInclude, orderBy: { created_at: 'asc' } });
        return {
            available: Object.fromEntries(Object.values(ExternalChannel).map((c) => [c, this.transport.available(c)])) as Record<ExternalChannel, boolean>,
            links: links.map((l) => this.view(l)),
        };
    }

    private async newCode(): Promise<string> {
        for (let i = 0; i < 5; i++) {
            const code = String(randomInt(100000, 1000000));
            const taken = await this.prisma.channelLink.count({ where: { link_code: code } });
            if (!taken) return code;
        }
        throw new BadRequestException('Try again');
    }

    /** Turns a channel on (or changes its bot). Email is ready at once; Slack and WhatsApp wait for the linking code. */
    async upsert(actor: Actor, channel: ExternalChannel, botId: string) {
        if (!this.transport.available(channel)) throw new BadRequestException(`${CHANNEL_LABELS[channel]} isn't set up for Agent Space yet`);
        await this.access.requireUsableBot(actor.organization_id, actor.user_id, botId);
        const existing = await this.prisma.channelLink.findUnique({ where: { organization_id_user_id_channel: { organization_id: actor.organization_id, user_id: actor.user_id, channel } } });
        let link;
        if (existing) {
            link = await this.prisma.channelLink.update({ where: { id: existing.id }, data: { bot_id: botId }, include: this.linkInclude });
        } else if (channel === ExternalChannel.EMAIL) {
            link = await this.prisma.channelLink.create({
                data: { organization_id: actor.organization_id, user_id: actor.user_id, bot_id: botId, channel, status: ChannelLinkStatus.ACTIVE, inbound_token: `b-${randomToken(12).toLowerCase().replace(/[^a-z0-9]/g, '')}` },
                include: this.linkInclude,
            });
        } else {
            link = await this.prisma.channelLink.create({
                data: { organization_id: actor.organization_id, user_id: actor.user_id, bot_id: botId, channel, status: ChannelLinkStatus.PENDING, link_code: await this.newCode(), link_code_expires_at: new Date(Date.now() + LINK_CODE_TTL_MS) },
                include: this.linkInclude,
            });
        }
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: existing ? 'channel.updated' : 'channel.added', target_type: 'channel_link', target_id: link.id, metadata: { channel, bot_id: botId } });
        return this.view(link);
    }

    /** A fresh linking code (Slack / WhatsApp), e.g. to link another account; the old account stays linked until the code is used. */
    async newLinkCode(actor: Actor, channel: ExternalChannel) {
        if (channel === ExternalChannel.EMAIL) throw new BadRequestException('Email needs no code');
        const link = await this.prisma.channelLink.findUnique({ where: { organization_id_user_id_channel: { organization_id: actor.organization_id, user_id: actor.user_id, channel } } });
        if (!link) throw new NotFoundException('Turn this channel on first');
        const updated = await this.prisma.channelLink.update({
            where: { id: link.id },
            data: { status: ChannelLinkStatus.PENDING, external_id: null, link_code: await this.newCode(), link_code_expires_at: new Date(Date.now() + LINK_CODE_TTL_MS) },
            include: this.linkInclude,
        });
        return this.view(updated);
    }

    /** Email: a new personal address (the old one stops working at once). */
    async newAddress(actor: Actor) {
        const link = await this.prisma.channelLink.findUnique({ where: { organization_id_user_id_channel: { organization_id: actor.organization_id, user_id: actor.user_id, channel: ExternalChannel.EMAIL } } });
        if (!link) throw new NotFoundException('Turn email on first');
        const updated = await this.prisma.channelLink.update({ where: { id: link.id }, data: { inbound_token: `b-${randomToken(12).toLowerCase().replace(/[^a-z0-9]/g, '')}` }, include: this.linkInclude });
        return this.view(updated);
    }

    async remove(actor: Actor, channel: ExternalChannel) {
        const link = await this.prisma.channelLink.findUnique({ where: { organization_id_user_id_channel: { organization_id: actor.organization_id, user_id: actor.user_id, channel } } });
        if (!link) return { ok: true };
        await this.prisma.channelLink.delete({ where: { id: link.id } });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'channel.removed', target_type: 'channel_link', target_id: link.id, metadata: { channel } });
        return { ok: true };
    }

    // ---------------- Inbound ----------------

    /** Webhooks only check signatures and queue the message; this answers the provider fast (Slack wants 3 s). */
    async enqueueInbound(m: InboundMessage) {
        const fresh = await this.redis.client.set(this.redis.key(`channel:delivery:${m.channel}:${m.delivery_id}`), '1', 'EX', WEBHOOK_DEDUPE_SECONDS, 'NX');
        if (!fresh) return false;
        await this.queue.add(Jobs.channels.INBOUND, { kind: 'inbound', inbound: m }, JOB_OPTIONS);
        return true;
    }

    private async overLimit(linkId: string) {
        const key = this.redis.key(`channel:rate:${linkId}:${Math.floor(Date.now() / 3_600_000)}`);
        const n = await this.redis.client.incr(key);
        if (n === 1) await this.redis.client.expire(key, 3700);
        return n > CHANNEL_MESSAGES_PER_HOUR ? (n === CHANNEL_MESSAGES_PER_HOUR + 1 ? 'first' : 'again') : null;
    }

    /** Matches the message to a link (or finishes linking with a code) and posts it to the member's chat with the bot. */
    async handleInbound(m: InboundMessage): Promise<{ status: string; message_id?: string }> {
        const where = m.channel === ExternalChannel.EMAIL ? { inbound_token: m.external_id } : { channel_external_id: { channel: m.channel, external_id: m.external_id } };
        const link = await this.prisma.channelLink.findUnique({ where: where as Prisma.ChannelLinkWhereUniqueInput, include: { user: { select: { id: true, email: true } }, bot: { select: { id: true, name: true, deleted_at: true } } } });

        if (m.channel !== ExternalChannel.EMAIL && (!link || link.status !== ChannelLinkStatus.ACTIVE)) {
            const code = LINK_CODE_RE.exec(m.text)?.[1];
            if (!code) {
                await this.transport.notice(m.channel, m.meta, 'This account isn\'t linked to Agent Space yet. In Agent Space, open Settings → Message from anywhere, turn this on, and send the code shown there.');
                return { status: 'not_linked' };
            }
            return this.finishLinking(m, code);
        }
        if (!link || link.status !== ChannelLinkStatus.ACTIVE) return { status: 'unknown_address' };
        if (m.channel === ExternalChannel.EMAIL && (m.from_address ?? '').toLowerCase() !== link.user.email.toLowerCase()) {
            this.logger.warn(`Email to a personal address from someone else (${m.from_address}) was ignored`);
            return { status: 'wrong_sender' };
        }
        if (link.bot.deleted_at) {
            await this.transport.notice(m.channel, m.meta, `${link.bot.name} was deleted. Pick another bot in Agent Space → Settings → Message from anywhere.`);
            return { status: 'bot_deleted' };
        }
        const limited = await this.overLimit(link.id);
        if (limited) {
            if (limited === 'first') await this.transport.notice(m.channel, m.meta, `That's a lot of messages for one hour. Messages are paused for a little while; you can keep going in the Agent Space app.`);
            return { status: 'rate_limited' };
        }
        const member = await this.access.membership(link.organization_id, link.user_id);
        if (!member) return { status: 'not_member' };
        const actor: Actor = { user_id: link.user_id, organization_id: link.organization_id, role: member.role };

        const conv = await this.conversations.getOrCreateDirect(actor, { bot_id: link.bot_id });
        const meta: ChannelMeta = {
            ...m.meta,
            channel: m.channel,
            link_id: link.id,
            ...(m.channel === ExternalChannel.EMAIL ? { email_from_address: link.user.email, email_to: `${link.inbound_token}@${this.transport.inboundDomain}` } : {}),
        };
        const sent = await this.messages.send(actor, conv.id, { content: m.text }, { source: SOURCE_OF[m.channel], channel_meta: meta as unknown as Prisma.InputJsonValue });
        await this.prisma.channelLink.update({ where: { id: link.id }, data: { conversation_id: conv.id, last_message_at: new Date() } });
        return { status: 'sent', message_id: sent.message.id };
    }

    private async finishLinking(m: InboundMessage, code: string) {
        const pending = await this.prisma.channelLink.findFirst({ where: { channel: m.channel, link_code: code, status: ChannelLinkStatus.PENDING, link_code_expires_at: { gt: new Date() } }, include: { bot: { select: { name: true } } } });
        if (!pending) {
            await this.transport.notice(m.channel, m.meta, 'That code isn\'t valid or has expired. Get a new one in Agent Space → Settings → Message from anywhere.');
            return { status: 'bad_code' };
        }
        // One Slack / WhatsApp account links to one member: a previous link of this account is replaced.
        await this.prisma.$transaction([
            this.prisma.channelLink.deleteMany({ where: { channel: m.channel, external_id: m.external_id, id: { not: pending.id } } }),
            this.prisma.channelLink.update({ where: { id: pending.id }, data: { status: ChannelLinkStatus.ACTIVE, external_id: m.external_id, link_code: null, link_code_expires_at: null } }),
        ]);
        await this.activity.log({ organization_id: pending.organization_id, actor_user_id: pending.user_id, action: 'channel.linked', target_type: 'channel_link', target_id: pending.id, metadata: { channel: m.channel } });
        await this.transport.notice(m.channel, m.meta, `Linked. Messages you send here now go to ${pending.bot.name}, and the answers come back here.`);
        return { status: 'linked' };
    }

    // ---------------- Replies ----------------

    /** Called by the runner on run status changes; only runs started by a channel message send anything back. */
    async onRunStatus(runId: string, status: string) {
        if (!Object.values(ReplyStatuses).includes(status as ReplyStatus)) return;
        const run = await this.prisma.run.findUnique({ where: { id: runId }, select: { type: true, trigger_message: { select: { source: true } } } });
        if (run?.type !== 'CHAT_REPLY' || !run.trigger_message || !CHANNEL_SOURCES.includes(run.trigger_message.source)) return;
        // Waiting can happen more than once per run (several approvals); the end only once.
        const done = status === ReplyStatuses.COMPLETED || status === ReplyStatuses.FAILED;
        await this.queue.add(Jobs.channels.REPLY, { kind: 'reply', run_id: runId, status: status as ReplyStatus }, { ...JOB_OPTIONS, ...(done ? { jobId: `channel-reply-${runId}` } : {}) });
    }

    async sendReply(runId: string, status: ReplyStatus) {
        const run = await this.prisma.run.findUnique({
            where: { id: runId },
            select: { id: true, state: true, error: true, conversation_id: true, bot: { select: { name: true } }, trigger_message: { select: { channel_meta: true } } },
        });
        const meta = run?.trigger_message?.channel_meta as unknown as ChannelMeta | null;
        if (!run || !meta?.channel) return;
        const link = await this.prisma.channelLink.findUnique({ where: { id: meta.link_id } });
        if (!link || link.status !== ChannelLinkStatus.ACTIVE) return; // unlinked since: nothing goes out
        const chatUrl = run.conversation_id ? `${this.appUrl}/c/${run.conversation_id}` : this.appUrl;
        let text: string;
        if (status === ReplyStatuses.COMPLETED) {
            const messageId = (run.state as { message_id?: string } | null)?.message_id;
            const msg = messageId ? await this.prisma.message.findUnique({ where: { id: messageId }, select: { content: true, parts: true } }) : null;
            const parts = (Array.isArray(msg?.parts) ? msg!.parts : []) as { type?: string }[];
            const appOnly = parts.some((p) => p.type && !TEXT_ONLY_PARTS.includes(p.type));
            text = (msg?.content ?? '').trim();
            if (!text) text = `Done. See the result in Agent Space: ${chatUrl}`;
            else if (appOnly) text += `\n\nSome of this answer only shows in the app: ${chatUrl}`;
        } else if (status === ReplyStatuses.FAILED) {
            text = `Sorry, that didn't work${run.error ? `: ${run.error.slice(0, 300)}` : '.'} You can try again here or in the app: ${chatUrl}`;
        } else if (status === ReplyStatuses.WAITING_APPROVAL) {
            const approval = await this.prisma.approval.findFirst({ where: { run_id: runId, status: 'PENDING' }, orderBy: { created_at: 'desc' }, select: { id: true, title: true } });
            text = `${run.bot.name} needs your approval to continue${approval ? `: ${approval.title}` : ''}. Approve or reject it in Agent Space: ${approval ? `${this.appUrl}/approvals/${approval.id}` : chatUrl}`;
        } else {
            text = `${run.bot.name} needs something from you to continue. Open the chat in Agent Space: ${chatUrl}`;
        }
        const max = REPLY_MAX_CHARS[meta.channel];
        if (text.length > max) text = `${text.slice(0, max - 80).trimEnd()}…\n\nRead the rest in Agent Space: ${chatUrl}`;
        await this.transport.send(meta, text, run.bot.name);
    }
}
