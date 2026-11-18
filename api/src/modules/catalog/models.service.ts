import { Injectable } from '@nestjs/common';
import { AiModel } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { toJsonSafe } from '@/shared/utils/pagination/pagination.utils';
import { VOICES } from './catalog.data';

export interface ResolvedModel {
    model: AiModel;
    fallbacks: string[];
}

@Injectable()
export class ModelsService {
    constructor(private readonly prisma: PrismaService) { }

    /** Models a member may pick, honouring the org's approved list (§6.4). */
    async listForOrg(orgId: string) {
        const [settings, allowed, models] = await Promise.all([
            this.prisma.organizationSettings.findUnique({ where: { organization_id: orgId } }),
            this.prisma.organizationAllowedModel.findMany({ where: { organization_id: orgId } }),
            this.prisma.aiModel.findMany({ where: { is_available: true }, orderBy: [{ is_recommended: 'desc' }, { provider: 'asc' }, { name: 'asc' }] }),
        ]);
        const allowedIds = new Set(allowed.map((a) => a.model_id));
        const restricted = settings?.model_policy === 'APPROVED_LIST';
        return toJsonSafe(
            models.map((m) => ({
                id: m.id,
                openrouter_id: m.openrouter_id,
                name: m.name,
                provider: m.provider,
                labels: m.labels,
                cost_tier: m.cost_tier,
                context_length: m.context_length,
                supports_vision: m.supports_vision,
                is_recommended: m.is_recommended,
                is_org_default: settings?.default_model_id === m.id,
                allowed: !restricted || allowedIds.has(m.id),
                input_price_per_m: m.input_price_per_m,
                output_price_per_m: m.output_price_per_m,
            })),
        );
    }

    async recommended() {
        return this.prisma.aiModel.findFirst({ where: { is_recommended: true, is_available: true } });
    }

    /** Bot model → org default → Recommended, plus a similar fallback model (§6.4). */
    async resolve(orgId: string, modelId: string | null | undefined): Promise<ResolvedModel> {
        let model = modelId ? await this.prisma.aiModel.findFirst({ where: { id: modelId, is_available: true } }) : null;
        if (!model) {
            const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: orgId } });
            if (s?.default_model_id) model = await this.prisma.aiModel.findFirst({ where: { id: s.default_model_id, is_available: true } });
        }
        if (!model) model = await this.recommended();
        if (!model) throw new Error('No AI model available');
        const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: orgId } });
        const fallbacks: string[] = [];
        if (s?.model_auto_fallback !== false && model.fallback_model_id) {
            const fb = await this.prisma.aiModel.findUnique({ where: { id: model.fallback_model_id } });
            if (fb?.is_available) fallbacks.push(fb.openrouter_id);
        }
        return { model, fallbacks };
    }

    voices() {
        return VOICES;
    }
}
