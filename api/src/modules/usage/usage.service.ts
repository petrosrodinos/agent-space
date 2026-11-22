import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UsageKind } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { paginate } from '@/shared/utils/pagination/pagination.utils';
import { isAdminRole } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { Actor } from '../bots/bots.service';
import type { UsageChargesQuery } from './dto/usage-charges-query.schema';

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

/** Who a spend total is for: the whole organisation, one member or one bot. */
type SpendScope = { user_id?: string; bot_id?: string };

const currentPeriod = () => new Date().toISOString().slice(0, 7);

/** [start, end) of a "YYYY-MM" month in UTC. */
const monthRange = (p: string) => {
    const [y, m] = p.split('-').map(Number);
    return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
};

const n = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);

/**
 * §14.4 usage: every charge (model call, voice session, cloud computer minutes...) is one `usage_charges` row.
 * That table is the only usage store: the overview, limits, alerts and the Charges tab all read from it.
 */
@Injectable()
export class UsageService {
    private readonly logger = new Logger(UsageService.name);
    /** openrouter_id -> ai_models.id, so a charge can point at its model without a lookup per call. */
    private readonly modelIds = new Map<string, string | null>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) { }

    async record(e: UsageEvent) {
        try {
            await this.prisma.usageCharge.create({
                data: {
                    organization_id: e.organization_id,
                    user_id: e.user_id ?? null,
                    bot_id: e.bot_id ?? null,
                    run_id: e.run_id ?? null,
                    model_id: e.model_openrouter_id ? await this.modelId(e.model_openrouter_id) : null,
                    kind: e.kind ?? 'MODEL_TOKENS',
                    quantity: new Prisma.Decimal(e.quantity ?? (e.input_tokens ?? 0) + (e.output_tokens ?? 0)),
                    input_tokens: e.input_tokens ?? null,
                    output_tokens: e.output_tokens ?? null,
                    cost: new Prisma.Decimal(e.cost || 0),
                },
            });
        } catch (err) {
            this.logger.warn(`Usage record failed: ${(err as Error).message}`);
        }
    }

    private async modelId(openrouterId: string) {
        if (!this.modelIds.has(openrouterId)) {
            const row = await this.prisma.aiModel.findUnique({ where: { openrouter_id: openrouterId }, select: { id: true } });
            this.modelIds.set(openrouterId, row?.id ?? null);
        }
        return this.modelIds.get(openrouterId) ?? null;
    }

    /** This month's spend in USD for the organisation, a member or a bot. */
    async monthSpend(orgId: string, scope: SpendScope = {}) {
        const sum = await this.prisma.usageCharge.aggregate({
            where: { organization_id: orgId, created_at: monthRange(currentPeriod()), ...(scope.user_id ? { user_id: scope.user_id } : {}), ...(scope.bot_id ? { bot_id: scope.bot_id } : {}) },
            _sum: { cost: true },
        });
        return n(sum._sum.cost);
    }

    private limitScope(l: { scope: string; user_id: string | null; bot_id: string | null }): SpendScope {
        return l.scope === 'MEMBER' ? { user_id: l.user_id! } : l.scope === 'BOT' ? { bot_id: l.bot_id! } : {};
    }

    /** Checks organisation, member and bot monthly limits (§11, §13.4). Returns the first limit reached, if any. */
    async limitReached(orgId: string, userId: string | null, botId: string): Promise<string | null> {
        const [limits, bot] = await Promise.all([
            this.prisma.usageLimit.findMany({ where: { organization_id: orgId } }),
            this.prisma.bot.findUnique({ where: { id: botId }, select: { monthly_usage_limit: true, name: true } }),
        ]);
        for (const l of limits) {
            if (l.scope === 'MEMBER' && l.user_id !== userId) continue;
            if (l.scope === 'BOT' && l.bot_id !== botId) continue;
            if ((await this.monthSpend(orgId, this.limitScope(l))) < Number(l.monthly_limit)) continue;
            return l.scope === 'ORGANIZATION' ? "The organisation's monthly usage limit has been reached." : l.scope === 'MEMBER' ? 'Your monthly usage limit has been reached.' : `${bot?.name}'s monthly usage limit has been reached.`;
        }
        if (bot?.monthly_usage_limit && (await this.monthSpend(orgId, { bot_id: botId })) >= Number(bot.monthly_usage_limit)) return `${bot.name}'s monthly usage limit has been reached.`;
        return null;
    }

    /**
     * usage.limit-alerts job (§11, §13.4): alerts at 80% and 100% of every monthly limit, once per threshold per month.
     * Organisation and bot limits alert Owners and Admins; member limits alert the member and the Owners and Admins.
     */
    async limitAlerts() {
        const p = currentPeriod();
        const limits = await this.prisma.usageLimit.findMany({ include: { bot: { select: { name: true } } } });
        let sent = 0;
        for (const l of limits) {
            const limit = Number(l.monthly_limit);
            if (!limit) continue;
            const pct = ((await this.monthSpend(l.organization_id, this.limitScope(l))) / limit) * 100;
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

    /** Usage overview (§13.4): totals by type, member, bot, model and day for one month. Members only see their own usage. */
    async overview(actor: Actor, p = currentPeriod()) {
        const range = monthRange(p);
        const own = !isAdminRole(actor.role);
        const where: Prisma.UsageChargeWhereInput = { organization_id: actor.organization_id, created_at: range, ...(own ? { user_id: actor.user_id } : {}) };
        const [byUser, byBot, byModel, byKind, byDay] = await Promise.all([
            this.prisma.usageCharge.groupBy({ by: ['user_id'], where, _sum: { cost: true, quantity: true } }),
            this.prisma.usageCharge.groupBy({ by: ['bot_id'], where, _sum: { cost: true, quantity: true } }),
            this.prisma.usageCharge.groupBy({ by: ['model_id'], where, _sum: { cost: true, quantity: true } }),
            this.prisma.usageCharge.groupBy({ by: ['kind'], where, _sum: { cost: true, quantity: true } }),
            this.prisma.$queryRaw<{ day: Date; cost: Prisma.Decimal }[]>`
                SELECT date_trunc('day', "created_at") AS day, SUM("cost") AS cost
                FROM "usage_charges"
                WHERE "organization_id" = ${actor.organization_id} AND "created_at" >= ${range.gte} AND "created_at" < ${range.lt}
                ${own ? Prisma.sql`AND "user_id" = ${actor.user_id}` : Prisma.empty}
                GROUP BY 1 ORDER BY 1`,
        ]);
        const [users, bots, models, limits] = await Promise.all([
            this.prisma.user.findMany({ where: { id: { in: byUser.map((u) => u.user_id).filter(Boolean) as string[] } }, select: { id: true, name: true, email: true } }),
            this.prisma.bot.findMany({ where: { id: { in: byBot.map((b) => b.bot_id).filter(Boolean) as string[] } }, select: { id: true, name: true, avatar_seed: true, color: true } }),
            this.prisma.aiModel.findMany({ where: { id: { in: byModel.map((m) => m.model_id).filter(Boolean) as string[] } }, select: { id: true, name: true, provider: true } }),
            this.prisma.usageLimit.findMany({ where: { organization_id: actor.organization_id } }),
        ]);
        return {
            period: p,
            total_cost: byKind.reduce((s, k) => s + n(k._sum.cost), 0),
            by_kind: byKind.map((k) => ({ kind: k.kind, cost: n(k._sum.cost), quantity: n(k._sum.quantity) })),
            by_member: byUser.map((u) => ({ user: users.find((x) => x.id === u.user_id) ?? null, cost: n(u._sum.cost), tokens: n(u._sum.quantity) })).sort((a, b) => b.cost - a.cost),
            by_bot: byBot.map((b) => ({ bot: bots.find((x) => x.id === b.bot_id) ?? null, cost: n(b._sum.cost), tokens: n(b._sum.quantity) })).sort((a, b) => b.cost - a.cost),
            by_model: byModel.map((m) => ({ model: models.find((x) => x.id === m.model_id) ?? null, cost: n(m._sum.cost), tokens: n(m._sum.quantity) })).sort((a, b) => b.cost - a.cost),
            by_day: byDay.map((d) => ({ day: d.day, cost: n(d.cost) })),
            limits: limits.map((l) => ({ ...l, monthly_limit: Number(l.monthly_limit) })),
        };
    }

    /** Charges tab: every charge, newest first, with filters. Members only see their own charges. */
    async charges(actor: Actor, q: UsageChargesQuery) {
        const created_at: Prisma.DateTimeFilter = {};
        if (q.from) created_at.gte = new Date(`${q.from}T00:00:00.000Z`);
        if (q.to) created_at.lt = new Date(new Date(`${q.to}T00:00:00.000Z`).getTime() + 86400000);
        const where: Prisma.UsageChargeWhereInput = {
            organization_id: actor.organization_id,
            ...(isAdminRole(actor.role) ? (q.user_id ? { user_id: q.user_id } : {}) : { user_id: actor.user_id }),
            ...(q.kind ? { kind: q.kind } : {}),
            ...(q.bot_id ? { bot_id: q.bot_id } : {}),
            ...(q.model_id ? { model_id: q.model_id } : {}),
            ...(q.from || q.to ? { created_at } : {}),
        };
        const [rows, total, sum] = await Promise.all([
            this.prisma.usageCharge.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip: (q.page - 1) * q.limit,
                take: q.limit,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    bot: { select: { id: true, name: true, avatar_seed: true, color: true } },
                    model: { select: { id: true, name: true, provider: true } },
                },
            }),
            this.prisma.usageCharge.count({ where }),
            this.prisma.usageCharge.aggregate({ where, _sum: { cost: true } }),
        ]);
        const data = rows.map((r) => ({
            id: r.id,
            kind: r.kind,
            quantity: n(r.quantity),
            input_tokens: r.input_tokens,
            output_tokens: r.output_tokens,
            cost: n(r.cost),
            run_id: r.run_id,
            created_at: r.created_at,
            user: r.user,
            bot: r.bot,
            model: r.model,
        }));
        return { ...paginate(data, total, q.page, q.limit), total_cost: n(sum._sum.cost) };
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
