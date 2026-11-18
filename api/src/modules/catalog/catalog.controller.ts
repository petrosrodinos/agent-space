import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ModelsService } from './models.service';

@ApiTags('Catalogue')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, OrgGuard)
export class CatalogController {
    constructor(
        private readonly models: ModelsService,
        private readonly prisma: PrismaService,
    ) { }

    @Get('models')
    @ApiOperation({ summary: 'AI models available to this organisation (§6.4)' })
    listModels(@CurrentMembership('organization_id') orgId: string) {
        return this.models.listForOrg(orgId);
    }

    @Get('voices')
    voices() {
        return this.models.voices();
    }

    @Get('bot-templates')
    @ApiOperation({ summary: 'Bot templates members of this organisation can use (§6.1, §13.4)' })
    async templates(@CurrentMembership('organization_id') orgId: string) {
        const [templates, disabled] = await Promise.all([
            this.prisma.botTemplate.findMany({
                where: { is_active: true },
                include: { model: { select: { id: true, name: true } }, starter_skills: { include: { skill: { select: { id: true, name: true, emoji: true, slug: true } } } } },
                orderBy: { sort_order: 'asc' },
            }),
            this.prisma.organizationTemplate.findMany({ where: { organization_id: orgId, enabled: false } }),
        ]);
        const off = new Set(disabled.map((d) => d.template_id));
        return templates
            .filter((t) => !off.has(t.id))
            .map(({ starter_skills, ...t }) => ({ ...t, skills: starter_skills.map((s) => s.skill) }));
    }
}
