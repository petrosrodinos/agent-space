import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UsageKind } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';
import { isAdminRole } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { Actor } from '../bots/bots.service';

export interface UsageEvent {
    organization_id: string;
    user_id?: string | null;
    bot_id?: string | null;
    run_id?: string | null;
    model_openrouter_id?: string | null;
    kind?: UsageKind;
    input_tokens?: number;
    output_tokens?: number;
    quantity?: number;
    cost: number;
}

const COUNTER_TTL = 40 * 86400;
const period = (d = new Date()) => d.toISOString().slice(0, 7);
const day = (d = new Date()) => d.toISOString().slice(0, 10);

/**
 * §14.4 usage counters: every model call increments Redis counters per org, member and bot for the month.
 * `usage.flush-counters` writes them to the database every minute; the DB is the record for the usage overview.
 */
@Injectable()
export class UsageService {
    private readonly logger = new Logger(UsageService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly notifications: NotificationsService,
    ) { }

    async record(e: UsageEvent) {
        try {
            const p = period();
            const kind = e.kind ?? 'MODEL_TOKENS';
            const quantity = e.quantity ?? (e.input_tokens ?? 0) + (e.output_tokens ?? 0);
            const field = [day(), kind, e.user_id ?? '-', e.bot_id ?? '-', e.model_openrouter_id ?? '-'].join('|');
            const bucket = this.redis.key(RedisKeys.usage(e.organization_id, p, 'pending'));
            const multi = this.redis.client.multi();
            multi.hincrbyfloat(bucket, `${field}|q`, quantity);
            multi.hincrbyfloat(bucket, `${field}|c`, e.cost);
            multi.expire(bucket, COUNTER_TTL);
            multi.sadd(this.redis.key(RedisKeys.usageDirty()), bucket);
            for (const scope of ['total', e.user_id ? `user:${e.user_id}` : null, e.bot_id ? `bot:${e.bot_id}` : null].filter(Boolean) as string[]) {
                const k = this.redis.key(RedisKeys.usage(e.organization_id, p, scope));
                multi.incrbyfloat(k, e.cost);
                multi.expire(k, COUNTER_TTL);
            }
            await multi.exec();
        } catch (err) {
            this.logger.warn(`Usage record failed: ${(err as Error).message}`);
        }
    }

    async monthSpend(orgId: string, scope: 'total' | `user:${string}` | `bot:${string}`) {
        const v = await this.redis.client.get(this.redis.key(RedisKeys.usage(orgId, period(), scope)));
        return Number(v ?? 0);
    }

    /** Checks organisation, member and bot monthly limits (§11, §13.4). Returns the first limit reached, if any. */
    async limitReached(orgId: string, userId: string | null, botId: string): Promise<string | null> {
        const [limits, bot] = await Promise.all([
            this.prisma.usageLimit.findMany({ where: { organization_id: orgId } }),
            this.prisma.bot.findUnique({ where: { id: botId }, select: { monthly_usage_limit: true, name: true } }),
        ]);
        for (const l of limits) {
            const scope = l.scope === 'ORGANIZATION' ? 'total' : l.scope === 'MEMBER' ? (l.user_id === userId ? `user:${userId}` : null) : l.bot_id === botId ? `bot:${botId}` : null;
            if (!scope) continue;
            if ((await this.monthSpend(orgId, scope as any)) >= Number(l.monthly_limit)) return l.scope === 'ORGANIZATION' ? 'The organisation\'s monthly usage limit has been reached.' : l.scope === 'MEMBER' ? 'Your monthly usage limit has been reached.' : `${bot?.name}'s monthly usage limit has been reached.`;
        }
        if (bot?.monthly_usage_limit && (await this.monthSpend(orgId, `bot:${botId}`)) >= Number(bot.monthly_usage_limit)) return `${bot.name}'s monthly usage limit has been reached.`;
        return null;
    }

    /**
     * usage.limit-alerts job (§11, §13.4): alerts at 80% and 100% of every monthly limit, once per threshold per month.
     * Organisation and bot limits alert Owners and Admins; member limits alert the member and the Owners and Admins.
     */
    async limitAlerts() {
        const p = period();
        const limits = await this.prisma.usageLimit.findMany({ include: { bot: { select: { name: true } } } });
        let sent = 0;
        for (const l of limits) {
            const scope = l.scope === 'ORGANIZATION' ? 'total' : l.scope === 'MEMBER' ? `user:${l.user_id}` : `bot:${l.bot_id}`;
            const limit = Number(l.monthly_limit);
            if (!limit) continue;
            const pct = ((await this.monthSpend(l.organization_id, scope as 'total')) / limit) * 100;
            const threshold = pct >= 100 ? 100 : pct >= 80 ? 80 : null;
            if (!threshold) continue;
            try {
                await this.prisma.usageAlert.create({ data: { organization_id: l.organization_id, scope: l.scope, user_id: l.user_id, bot_id: l.bot_id, period: p, threshold } });
            } catch {
                continue; // already alerted for this threshold this month
            }
            const member = l.user_id ? await this.prisma.user.findUnique({ where: { id: l.user_id }, select: { name: true, email: true } }) : null;
            const subject = l.scope === 'ORGANIZATION' ? 'The organisation' : l.scope === 'MEMBER' ? (member?.name ?? member?.email ?? 'A member') : (l.bot?.name ?? 'A bot');
            const title = threshold === 100 ? `${subject} reached the monthly usage limit` : `${subject} used 80% of the monthly usage limit`;
            const body = `$${limit.toFixed(2)} monthly limit.${threshold === 100 ? ' Bots stop replying until the limit is raised or the month ends.' : ''}`;
            const admins = await this.prisma.organizationMember.findMany({ where: { organization_id: l.organization_id, role: { in: ['OWNER', 'ADMIN'] } }, select: { user_id: true } });
            const recipients = new Set(admins.map((a) => a.user_id));
            if (l.scope === 'MEMBER' && l.user_id) recipients.add(l.user_id);
            await this.notifications.notifyMany([...recipients], { organization_id: l.organization_id, event: 'USAGE_LIMIT', title, body, link_path: '/settings/usage', is_urgent: threshold === 100 });
            sent++;
        }
        return { limits: limits.length, sent };
    }

    /** usage.flush-counters job. */
    async flush() {
        const dirtyKey = this.redis.key(RedisKeys.usageDirty());
        const buckets = await this.redis.client.smembers(dirtyKey);
        let rows = 0;
        for (const bucket of buckets) {
            const tmp = `${bucket}:flushing:${Date.now()}`;
            try {
                await this.redis.client.rename(bucket, tmp);
            } catch {
                await this.redis.client.srem(dirtyKey, bucket);
                continue;
            }
            await this.redis.client.srem(dirtyKey, bucket);
            const data = await this.redis.client.hgetall(tmp);
            await this.redis.client.del(tmp);
            const orgId = bucket.split('usage:')[1].split(':')[0];
            const p = bucket.split('usage:')[1].split(':')[1];
            const grouped = new Map<string, { q: number; c: number }>();
            for (const [k, v] of Object.entries(data)) {
                const field = k.slice(0, -2);
                const g = grouped.get(field) ?? { q: 0, c: 0 };
                if (k.endsWith('|q')) g.q += Number(v);
                else g.c += Number(v);
                grouped.set(field, g);
            }
            for (const [field, g] of grouped) {
                const [d, kind, user, bot, model] = field.split('|');
                const modelRow = model !== '-' ? await this.prisma.aiModel.findUnique({ where: { openrouter_id: model }, select: { id: true } }) : null;
                const where = { organization_id: orgId, period: p, day: new Date(d), kind: kind as UsageKind, user_id: user === '-' ? null : user, bot_id: bot === '-' ? null : bot, model_id: modelRow?.id ?? null, artifact_id: null };
                const existing = await this.prisma.usageRecord.findFirst({ where });
                if (existing) {
                    await this.prisma.usageRecord.update({ where: { id: existing.id }, data: { quantity: { increment: new Prisma.Decimal(g.q) }, cost: { increment: new Prisma.Decimal(g.c) } } });
                } else {
                    await this.prisma.usageRecord.create({ data: { ...where, quantity: new Prisma.Decimal(g.q), cost: new Prisma.Decimal(g.c) } });
                }
                rows++;
            }
        }
        return { buckets: buckets.length, rows };
    }

    /** Usage overview (§13.4): by member, bot and model. Members only see their own usage. */
    async overview(actor: Actor, p = period()) {
        const where: Prisma.UsageRecordWhereInput = { organization_id: actor.organization_id, period: p, ...(isAdminRole(actor.role) ? {} : { user_id: actor.user_id }) };
        const [byUser, byBot, byModel, byKind, byDay] = await Promise.all([
            this.prisma.usageRecord.groupBy({ by: ['user_id'], where, _sum: { cost: true, quantity: true } }),
            this.prisma.usageRecord.groupBy({ by: ['bot_id'], where, _sum: { cost: true, quantity: true } }),
            this.prisma.usageRecord.groupBy({ by: ['model_id'], where, _sum: { cost: true, quantity: true } }),
            this.prisma.usageRecord.groupBy({ by: ['kind'], where, _sum: { cost: true, quantity: true } }),
            this.prisma.usageRecord.groupBy({ by: ['day'], where, _sum: { cost: true }, orderBy: { day: 'asc' } }),
        ]);
        const [users, bots, models, limits] = await Promise.all([
            this.prisma.user.findMany({ where: { id: { in: byUser.map((u) => u.user_id).filter(Boolean) as string[] } }, select: { id: true, name: true, email: true } }),
            this.prisma.bot.findMany({ where: { id: { in: byBot.map((b) => b.bot_id).filter(Boolean) as string[] } }, select: { id: true, name: true, avatar_seed: true, color: true } }),
            this.prisma.aiModel.findMany({ where: { id: { in: byModel.map((m) => m.model_id).filter(Boolean) as string[] } }, select: { id: true, name: true, provider: true } }),
            this.prisma.usageLimit.findMany({ where: { organization_id: actor.organization_id } }),
        ]);
        const n = (d: Prisma.Decimal | null | undefined) => Number(d ?? 0);
        return {
            period: p,
            total_cost: byKind.reduce((s, k) => s + n(k._sum.cost), 0),
            by_kind: byKind.map((k) => ({ kind: k.kind, cost: n(k._sum.cost), quantity: n(k._sum.quantity) })),
            by_member: byUser.map((u) => ({ user: users.find((x) => x.id === u.user_id) ?? null, cost: n(u._sum.cost), tokens: n(u._sum.quantity) })).sort((a, b) => b.cost - a.cost),
            by_bot: byBot.map((b) => ({ bot: bots.find((x) => x.id === b.bot_id) ?? null, cost: n(b._sum.cost), tokens: n(b._sum.quantity) })).sort((a, b) => b.cost - a.cost),
            by_model: byModel.map((m) => ({ model: models.find((x) => x.id === m.model_id) ?? null, cost: n(m._sum.cost), tokens: n(m._sum.quantity) })).sort((a, b) => b.cost - a.cost),
            by_day: byDay.map((d) => ({ day: d.day, cost: n(d._sum.cost) })),
            limits: limits.map((l) => ({ ...l, monthly_limit: Number(l.monthly_limit) })),
        };
    }

    async setLimit(actor: Actor, input: { scope: 'ORGANIZATION' | 'MEMBER' | 'BOT'; user_id?: string; bot_id?: string; monthly_limit: number | null }) {
        const where = { organization_id: actor.organization_id, scope: input.scope, user_id: input.user_id ?? null, bot_id: input.bot_id ?? null };
        const existing = await this.prisma.usageLimit.findFirst({ where });
        if (input.monthly_limit === null) {
            if (existing) await this.prisma.usageLimit.delete({ where: { id: existing.id } });
            return { ok: true };
        }
        if (existing) await this.prisma.usageLimit.update({ where: { id: existing.id }, data: { monthly_limit: new Prisma.Decimal(input.monthly_limit) } });
        else await this.prisma.usageLimit.create({ data: { ...where, monthly_limit: new Prisma.Decimal(input.monthly_limit) } });
        return { ok: true };
    }
}
