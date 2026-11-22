import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { MODEL_SEEDS, STARTER_SKILLS, TEMPLATE_SEEDS, VOICES } from './catalog.data';

/** Upserts the platform catalogue (models, templates, starter skills) at start-up. Idempotent; one instance does it per deploy. */
@Injectable()
export class CatalogService implements OnApplicationBootstrap {
    private readonly logger = new Logger(CatalogService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async onApplicationBootstrap() {
        const lock = await this.redis.acquireLock('lock:catalog-seed', 60_000);
        if (!lock) return;
        try {
            await this.seed();
        } catch (e) {
            this.logger.error(`Catalogue seed failed: ${(e as Error).message}`);
        } finally {
            await lock.release();
        }
    }

    async seed() {
        // Models
        for (const m of MODEL_SEEDS) {
            const data = {
                name: m.name,
                provider: m.provider,
                labels: m.labels,
                cost_tier: m.cost_tier,
                input_price_per_m: new Prisma.Decimal(m.input),
                output_price_per_m: new Prisma.Decimal(m.output),
                context_length: m.context,
                supports_vision: m.vision,
                supports_tools: true,
                is_recommended: !!m.recommended,
                is_available: true,
            };
            await this.prisma.aiModel.upsert({ where: { openrouter_id: m.openrouter_id }, create: { openrouter_id: m.openrouter_id, ...data }, update: data });
        }
        await this.prisma.aiModel.updateMany({ where: { openrouter_id: { notIn: MODEL_SEEDS.map((m) => m.openrouter_id) } }, data: { is_available: false, is_recommended: false } });
        const models = await this.prisma.aiModel.findMany();
        const byKey = new Map(models.map((m) => [m.openrouter_id, m.id]));
        for (const m of MODEL_SEEDS) {
            if (m.fallback && byKey.get(m.fallback)) {
                await this.prisma.aiModel.update({ where: { openrouter_id: m.openrouter_id }, data: { fallback_model_id: byKey.get(m.fallback) } });
            }
        }

        // Starter skills (platform-level: organization_id null)
        const skillIds = new Map<string, string>();
        for (const s of STARTER_SKILLS) {
            const data = {
                name: s.name,
                emoji: s.emoji,
                slug: s.key,
                description: s.description,
                instructions: s.instructions,
                questions: s.questions as unknown as Prisma.InputJsonValue,
                required_tools: s.required_tools as unknown as Prisma.InputJsonValue,
                result: s.result,
                is_starter: true,
                sharing_level: 'ORGANIZATION' as const,
            };
            const row = await this.prisma.skill.upsert({ where: { starter_key: s.key }, create: { starter_key: s.key, ...data }, update: data });
            const v = await this.prisma.skillVersion.findUnique({ where: { skill_id_version: { skill_id: row.id, version: 1 } } });
            if (!v) {
                await this.prisma.skillVersion.create({
                    data: { skill_id: row.id, version: 1, name: s.name, emoji: s.emoji, description: s.description, instructions: s.instructions, questions: data.questions, required_tools: data.required_tools, result: s.result, change_summary: 'Starter skill' },
                });
            }
            skillIds.set(s.key, row.id);
        }

        // Templates
        for (const [i, t] of TEMPLATE_SEEDS.entries()) {
            const data = {
                name: t.name,
                avatar_seed: t.avatar_seed,
                color: t.color,
                description: t.description,
                instructions: t.instructions,
                welcome_message: t.welcome_message,
                conversation_starters: t.conversation_starters,
                suggested_services: t.suggested_services,
                model_id: byKey.get(t.model) ?? null,
                voice: VOICES.includes(t.voice) ? t.voice : null,
                approval_level: t.approval_level,
                cloud_computer: t.cloud_computer,
                sort_order: i,
                is_active: true,
            };
            const tpl = await this.prisma.botTemplate.upsert({ where: { key: t.key }, create: { key: t.key, ...data }, update: data });
            await this.prisma.botTemplateSkill.deleteMany({ where: { template_id: tpl.id } });
            const links = t.starter_skills.map((k) => skillIds.get(k)).filter(Boolean) as string[];
            if (links.length) await this.prisma.botTemplateSkill.createMany({ data: links.map((skill_id) => ({ template_id: tpl.id, skill_id })), skipDuplicates: true });
        }

        // App version policy (§14.1)
        for (const platform of ['WEB', 'DESKTOP', 'ANDROID'] as const) {
            await this.prisma.appVersionPolicy.upsert({ where: { platform }, create: { platform, minimum_version: '1.0.0', latest_version: '1.0.0' }, update: {} });
        }
        this.logger.log(`Catalogue ready: ${MODEL_SEEDS.length} models, ${TEMPLATE_SEEDS.length} templates, ${STARTER_SKILLS.length} starter skills`);
    }
}
