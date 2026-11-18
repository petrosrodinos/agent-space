import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRole, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OpenRouterService } from '@/integrations/openrouter/openrouter.service';
import { toJsonSafe } from '@/shared/utils/pagination/pagination.utils';
import { AccessService, isAdminRole } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import { ModelsService } from '../catalog/models.service';
import { UTILITY_MODEL, VOICES } from '../catalog/catalog.data';
import { DEFAULT_CONVERSATION_STARTERS, defaultWelcomeMessage, welcomeMessageData } from './bot-welcome.utils';
import { CreateBotDto, SetApprovalRulesDto, SetBotConnectionsDto, UpdateBotDto } from './dto/bot.dto';

const BOT_COLORS = ['#6B4EFF', '#FF7A3D', '#FFC83D', '#1FC98E', '#FF5FAE', '#38B6FF', '#9BD62F', '#FF5A5F', '#B18CFF', '#17B5B0', '#3A6BFF', '#4A4560'];
const DEFAULT_INSTRUCTIONS = 'You are a helpful, capable AI co-worker. Be clear and concise, take action with the tools you have, and ask before doing anything hard to undo.';

/** The bot every new account starts with. It greets the user and configures itself through chat (update_bot tool). */
const STARTER_BOT = {
    name: 'Assistant',
    emoji: '🤖',
    color: '#4A4560',
    description: 'Your first bot. Tell it what you need and it will set itself up.',
    instructions:
        DEFAULT_INSTRUCTIONS +
        '\n\nSetup: you were just created as the user\'s first bot and have not been configured yet. Help the user set you up through this chat. ' +
        'Ask, one or two at a time, what they want you to help with, a name they would like to call you, and how you should reply (tone, length). ' +
        'Then use the update_bot tool on "this bot" to apply it: name, emoji, colour, a one-line description, and FULL new instructions describing your role, goals and tone (leave out this setup paragraph). ' +
        'If the user just wants to get on with a task, help them with it and offer setup later.',
    welcome_message: 'Hi! I\'m your new assistant, and I\'m not set up yet. Tell me what you\'d like help with (your inbox, research, writing, sales, anything) and what you\'d like to call me, and I\'ll configure myself right here in the chat.',
    conversation_starters: ['Help me set you up', 'Be my personal assistant for email and calendar', 'Help me with research and writing', 'What can you do?'],
} as const;

export interface Actor {
    user_id: string;
    organization_id: string;
    role: OrganizationRole;
}

const BOT_INCLUDE = {
    model: { select: { id: true, name: true, provider: true, labels: true, cost_tier: true } },
    approval_rules: true,
    bot_connections: { include: { connection: { select: { id: true, label: true, service_key: true, service_name: true, status: true, visibility: true, account_identifier: true } } } },
    bot_skills: { include: { skill: { select: { id: true, name: true, emoji: true, slug: true, description: true } } } },
    created_by: { select: { id: true, name: true, email: true } },
    _count: { select: { memories: true, knowledge_items: true } },
} satisfies Prisma.BotInclude;

@Injectable()
export class BotsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly models: ModelsService,
        private readonly openrouter: OpenRouterService,
    ) { }

    async list(actor: Actor, search?: string) {
        const bots = await this.prisma.bot.findMany({
            where: {
                ...this.access.usableBotsWhere(actor.organization_id, actor.user_id),
                is_archived: false,
                ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
            },
            include: { model: { select: { id: true, name: true } }, created_by: { select: { id: true, name: true } }, _count: { select: { bot_skills: true, bot_connections: true } } },
            orderBy: [{ created_at: 'asc' }],
        });
        return toJsonSafe(bots.map((b) => ({ ...b, can_edit: b.created_by_id === actor.user_id || (b.visibility === 'ORGANIZATION' && isAdminRole(actor.role)) })));
    }

    async get(actor: Actor, id: string) {
        const bot = await this.prisma.bot.findFirst({
            where: { id, ...this.access.usableBotsWhere(actor.organization_id, actor.user_id) },
            include: BOT_INCLUDE,
        });
        if (!bot) throw new NotFoundException('Bot not found');
        return toJsonSafe({ ...bot, can_edit: await this.access.canEditBot(actor.organization_id, actor.user_id, bot) });
    }

    private async checkCreateAllowed(actor: Actor) {
        const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } });
        if (s?.who_can_create_bots === 'OWNERS_ADMINS' && !isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can create bots in this organisation');
        if (s?.max_bots_per_member) {
            const n = await this.prisma.bot.count({ where: { organization_id: actor.organization_id, created_by_id: actor.user_id, deleted_at: null } });
            if (n >= s.max_bots_per_member) throw new ForbiddenException(`You can have at most ${s.max_bots_per_member} bots in this organisation`);
        }
    }

    /** Owners/Admins only: organisation-wide visibility and Sensitive (§5.3, §6.5). */
    private checkPrivileged(actor: Actor, dto: Partial<CreateBotDto>) {
        if (!isAdminRole(actor.role)) {
            if (dto.visibility === 'ORGANIZATION') throw new ForbiddenException('Only Owners and Admins can make a bot available to the whole organisation');
            if (dto.is_sensitive) throw new ForbiddenException('Only Owners and Admins can mark a bot as Sensitive');
        }
    }

    private async checkModelAllowed(orgId: string, modelId?: string | null) {
        if (!modelId) return;
        const list = await this.models.listForOrg(orgId);
        const m = list.find((x) => x.id === modelId);
        if (!m) throw new BadRequestException('Unknown model');
        if (!m.allowed) throw new ForbiddenException('That model is not on your organisation\'s approved list');
    }

    async create(actor: Actor, dto: CreateBotDto) {
        await this.checkCreateAllowed(actor);
        this.checkPrivileged(actor, dto);
        await this.checkModelAllowed(actor.organization_id, dto.model_id);
        if (dto.voice && !VOICES.includes(dto.voice)) throw new BadRequestException('Unknown voice');

        const template = dto.template_id ? await this.prisma.botTemplate.findUnique({ where: { id: dto.template_id }, include: { starter_skills: true } }) : null;
        if (dto.template_id && !template) throw new BadRequestException('Unknown template');
        const userSettings = await this.prisma.userSettings.findUnique({ where: { user_id: actor.user_id } });

        const bot = await this.prisma.$transaction(async (tx) => {
            const created = await tx.bot.create({
                data: {
                    organization_id: actor.organization_id,
                    created_by_id: actor.user_id,
                    template_id: template?.id,
                    name: dto.name.trim(),
                    emoji: dto.emoji || template?.emoji || '🤖',
                    color: dto.color || template?.color || BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)],
                    description: dto.description ?? template?.description,
                    instructions: dto.instructions?.trim() || template?.instructions || DEFAULT_INSTRUCTIONS,
                    welcome_message: dto.welcome_message?.trim() || template?.welcome_message || defaultWelcomeMessage({ name: dto.name.trim(), description: dto.description ?? template?.description }),
                    conversation_starters: dto.conversation_starters?.length ? dto.conversation_starters : template?.conversation_starters?.length ? template.conversation_starters : DEFAULT_CONVERSATION_STARTERS,
                    model_id: dto.model_id ?? template?.model_id ?? null,
                    voice: dto.voice ?? template?.voice ?? null,
                    approval_level: dto.approval_level ?? template?.approval_level ?? userSettings?.default_approval_level ?? 'IMPORTANT_ACTIONS',
                    cloud_computer_enabled: dto.cloud_computer_enabled ?? template?.cloud_computer ?? false,
                    ...this.pickSettings(dto),
                },
            });
            if (template?.starter_skills.length) {
                await tx.botSkill.createMany({ data: template.starter_skills.map((s) => ({ bot_id: created.id, skill_id: s.skill_id })), skipDuplicates: true });
            }
            return created;
        });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'bot.created', target_type: 'bot', target_id: bot.id, metadata: { name: bot.name, template: template?.key } });
        return this.get(actor, bot.id);
    }

    /**
     * Sign-up: creates the user's first bot, makes it their default, opens a direct chat with it and
     * posts its welcome message asking the user to set it up in the chat. Runs inside the sign-up transaction.
     */
    async createStarterBot(userId: string, organizationId: string, tx: Prisma.TransactionClient) {
        const bot = await tx.bot.create({
            data: {
                organization_id: organizationId,
                created_by_id: userId,
                is_starter: true,
                name: STARTER_BOT.name,
                emoji: STARTER_BOT.emoji,
                color: STARTER_BOT.color,
                description: STARTER_BOT.description,
                instructions: STARTER_BOT.instructions,
                welcome_message: STARTER_BOT.welcome_message,
                conversation_starters: [...STARTER_BOT.conversation_starters],
            },
        });
        await tx.userSettings.update({ where: { user_id: userId }, data: { default_bot_id: bot.id } });
        const now = new Date();
        const conversation = await tx.conversation.create({
            data: {
                organization_id: organizationId,
                type: 'DIRECT',
                created_by_id: userId,
                lead_bot_id: bot.id,
                last_message_at: now,
                message_count: 1,
                participants: { create: [{ user_id: userId, unread_count: 1 }, { bot_id: bot.id }] },
            },
        });
        await tx.message.create({ data: welcomeMessageData(organizationId, conversation.id, bot, now) });
        return { bot, conversation };
    }

    private pickSettings(dto: Partial<CreateBotDto>) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { name, emoji, color, description, instructions, welcome_message, conversation_starters, model_id, template_id, voice, approval_level, cloud_computer_enabled, monthly_usage_limit, ...rest } = dto;
        return { ...rest, ...(monthly_usage_limit !== undefined ? { monthly_usage_limit: monthly_usage_limit === null ? null : new Prisma.Decimal(monthly_usage_limit) } : {}) };
    }

    async update(actor: Actor, id: string, dto: UpdateBotDto, source: 'settings' | 'chat' = 'settings') {
        const bot = await this.access.requireEditableBot(actor.organization_id, actor.user_id, id);
        this.checkPrivileged(actor, dto);
        if (dto.model_id) await this.checkModelAllowed(actor.organization_id, dto.model_id);
        if (dto.voice && !VOICES.includes(dto.voice)) throw new BadRequestException('Unknown voice');
        // Org-wide → private by a non-admin, or sensitive changes, are privileged too.
        if (!isAdminRole(actor.role) && bot.is_sensitive && dto.is_sensitive === false) throw new ForbiddenException('Only Owners and Admins can change Sensitive');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { template_id, ...rest } = dto;
        await this.prisma.bot.update({
            where: { id },
            data: {
                ...rest,
                name: dto.name?.trim(),
                monthly_usage_limit: dto.monthly_usage_limit === undefined ? undefined : dto.monthly_usage_limit === null ? null : new Prisma.Decimal(dto.monthly_usage_limit),
            },
        });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'bot.updated', target_type: 'bot', target_id: id, metadata: { fields: Object.keys(dto), via: source } });
        return this.get(actor, id);
    }

    async remove(actor: Actor, id: string) {
        const bot = await this.access.requireEditableBot(actor.organization_id, actor.user_id, id);
        if (bot.is_starter) throw new ForbiddenException('Your starter bot can\'t be deleted. You can rename and reconfigure it instead.');
        await this.prisma.bot.update({ where: { id }, data: { deleted_at: new Date(), is_archived: true } });
        await this.prisma.userSettings.updateMany({ where: { default_bot_id: id }, data: { default_bot_id: null } });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'bot.deleted', target_type: 'bot', target_id: id });
        return { ok: true };
    }

    async duplicate(actor: Actor, id: string) {
        await this.checkCreateAllowed(actor);
        const src = await this.prisma.bot.findFirst({
            where: { id, ...this.access.usableBotsWhere(actor.organization_id, actor.user_id) },
            include: { approval_rules: true, bot_skills: true },
        });
        if (!src) throw new NotFoundException('Bot not found');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, created_at, updated_at, deleted_at, approval_rules, bot_skills, image_file_id, created_by_id, organization_id, duplicated_from_id, ...fields } = src;
        const copy = await this.prisma.bot.create({
            data: {
                ...fields,
                organization_id: actor.organization_id,
                created_by_id: actor.user_id,
                duplicated_from_id: src.id,
                is_starter: false,
                name: `${src.name} (copy)`.slice(0, 60),
                visibility: 'PRIVATE',
                is_sensitive: false,
                approval_rules: { create: approval_rules.map((r) => ({ action_type: r.action_type, override: r.override })) },
                bot_skills: { create: bot_skills.map((s) => ({ skill_id: s.skill_id })) },
            },
        });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'bot.duplicated', target_type: 'bot', target_id: copy.id, metadata: { from: src.id } });
        return this.get(actor, copy.id);
    }

    /** §6.1 "Describing it in plain words" — drafts a bot for the user to review (not saved). */
    async draftFromDescription(actor: Actor, description: string) {
        const [templates, models] = await Promise.all([
            this.prisma.botTemplate.findMany({ where: { is_active: true }, select: { id: true, key: true, name: true } }),
            this.models.listForOrg(actor.organization_id),
        ]);
        const result = await this.openrouter.complete({
            model: UTILITY_MODEL,
            json: true,
            temperature: 0.4,
            messages: [
                {
                    role: 'system',
                    content:
                        'You design AI assistant bots for a workplace app. Return ONLY a JSON object with keys: name (max 30 chars, friendly, may be alliterative like "Sales Sam"), emoji (one emoji), color (one of ' +
                        BOT_COLORS.join(', ') +
                        '), description (one line, max 120 chars), instructions (role, goals, rules and tone in plain language, 80-200 words, second person "You are..."), conversation_starters (array of 4 short prompts), suggested_services (array of lowercase service slugs like gmail, googlecalendar, hubspot, slack, notion, googledrive, github, linear), template_key (closest of: ' +
                        templates.map((t) => t.key).join(', ') +
                        ' or null), model_hint ("fast" or "smart").',
                },
                { role: 'user', content: description },
            ],
        });
        let draft: any;
        try {
            draft = JSON.parse(result.content.replace(/^```(?:json)?|```$/g, '').trim());
        } catch {
            throw new BadRequestException('Could not draft a bot from that description. Try describing it differently.');
        }
        const allowed = models.filter((m) => m.allowed);
        const model = draft.model_hint === 'fast' ? allowed.find((m) => m.labels.includes('fast')) : allowed.find((m) => m.is_recommended) ?? allowed[0];
        return {
            name: String(draft.name ?? 'New bot').slice(0, 60),
            emoji: String(draft.emoji ?? '🤖').slice(0, 16),
            color: BOT_COLORS.includes(draft.color) ? draft.color : BOT_COLORS[0],
            description: String(draft.description ?? '').slice(0, 160),
            instructions: String(draft.instructions ?? DEFAULT_INSTRUCTIONS).slice(0, 20000),
            conversation_starters: (Array.isArray(draft.conversation_starters) ? draft.conversation_starters : []).slice(0, 4).map(String),
            suggested_services: (Array.isArray(draft.suggested_services) ? draft.suggested_services : []).slice(0, 8).map(String),
            template_id: templates.find((t) => t.key === draft.template_key)?.id ?? null,
            model_id: model?.id ?? null,
        };
    }

    async setApprovalRules(actor: Actor, id: string, dto: SetApprovalRulesDto) {
        await this.access.requireEditableBot(actor.organization_id, actor.user_id, id);
        await this.prisma.$transaction(async (tx) => {
            for (const r of dto.rules) {
                if (r.override === 'DEFAULT') await tx.botApprovalRule.deleteMany({ where: { bot_id: id, action_type: r.action_type } });
                else await tx.botApprovalRule.upsert({ where: { bot_id_action_type: { bot_id: id, action_type: r.action_type } }, create: { bot_id: id, action_type: r.action_type, override: r.override }, update: { override: r.override } });
            }
        });
        return this.get(actor, id);
    }

    /** §8.2/§13.3 — which connected accounts the bot may use and the default per service. */
    async setConnections(actor: Actor, id: string, dto: SetBotConnectionsDto) {
        await this.access.requireEditableBot(actor.organization_id, actor.user_id, id);
        const ids = dto.connections.map((c) => c.connection_id);
        const usable = await this.prisma.connection.findMany({ where: { id: { in: ids }, ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id, id) } });
        if (usable.length !== new Set(ids).size) throw new ForbiddenException('You can only give a bot connections you can use');
        await this.prisma.$transaction([
            this.prisma.botConnection.deleteMany({ where: { bot_id: id } }),
            this.prisma.botConnection.createMany({ data: dto.connections.map((c) => ({ bot_id: id, connection_id: c.connection_id, is_default_for_service: !!c.is_default_for_service })) }),
        ]);
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'bot.connections_changed', target_type: 'bot', target_id: id, metadata: { connections: ids } });
        return this.get(actor, id);
    }

    // ---- Memory panel (§6.3) ----

    async listMemories(actor: Actor, botId: string) {
        const bot = await this.access.requireUsableBot(actor.organization_id, actor.user_id, botId);
        const canEdit = await this.access.canEditBot(actor.organization_id, actor.user_id, bot);
        return this.prisma.memory.findMany({
            where: {
                organization_id: actor.organization_id,
                bot_id: botId,
                OR: [{ kind: 'BOT_USER', user_id: actor.user_id }, ...(canEdit || bot.memory_scope === 'SHARED' ? [{ kind: 'BOT_SHARED' as const }] : [])],
            },
            orderBy: { updated_at: 'desc' },
        });
    }

    private async ownMemory(actor: Actor, id: string) {
        const m = await this.prisma.memory.findFirst({ where: { id, organization_id: actor.organization_id } });
        if (!m) throw new NotFoundException('Memory not found');
        if (m.kind === 'BOT_USER' && m.user_id !== actor.user_id) throw new NotFoundException('Memory not found');
        if (m.kind === 'BOT_SHARED' && m.bot_id) await this.access.requireEditableBot(actor.organization_id, actor.user_id, m.bot_id);
        if (m.kind === 'ORGANIZATION' && !isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can edit organisation memory');
        return m;
    }

    async updateMemory(actor: Actor, id: string, content: string) {
        await this.ownMemory(actor, id);
        return this.prisma.memory.update({ where: { id }, data: { content } });
    }

    async deleteMemory(actor: Actor, id: string) {
        await this.ownMemory(actor, id);
        await this.prisma.memory.delete({ where: { id } });
        return { ok: true };
    }

    async clearMyMemories(actor: Actor, botId?: string) {
        await this.prisma.memory.deleteMany({ where: { organization_id: actor.organization_id, user_id: actor.user_id, kind: 'BOT_USER', ...(botId ? { bot_id: botId } : {}) } });
        return { ok: true };
    }

    // ---- Organisation memory (§6.3) ----
    listOrgMemories(orgId: string) {
        return this.prisma.memory.findMany({ where: { organization_id: orgId, kind: 'ORGANIZATION' }, orderBy: { updated_at: 'desc' } });
    }

    async addOrgMemory(actor: Actor, content: string) {
        if (!isAdminRole(actor.role)) throw new ForbiddenException('Owners and Admins only');
        return this.prisma.memory.create({ data: { organization_id: actor.organization_id, kind: 'ORGANIZATION', content, user_id: actor.user_id } });
    }
}
