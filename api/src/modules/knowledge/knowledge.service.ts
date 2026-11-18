import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KnowledgeItem, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { StorageService } from '@/integrations/storage/storage.service';
import { chunkText, extractText, scoreChunk } from '@/shared/utils/files/text-extract.utils';
import { fetchReadable } from '../agent/tools/web.utils';
import { AccessService, isAdminRole } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import type { AddKnowledgeDto } from './dto/knowledge.dto';

const RESTORE_WINDOW_MS = 30 * 86400_000;

/**
 * Bot knowledge and the organisation knowledge library (§6.2, §7.7).
 * Files are stored once in Cloud Storage; their text is extracted into `content` so bots can search and read them.
 */
@Injectable()
export class KnowledgeService {
    private readonly logger = new Logger(KnowledgeService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
    ) { }

    private shape(k: KnowledgeItem & { file?: { id: string; filename: string; mimetype: string; size: bigint } | null; added_by?: { id: string; name: string | null } | null }) {
        return {
            id: k.id,
            scope: k.scope,
            bot_id: k.bot_id,
            kind: k.kind,
            title: k.title,
            url: k.url,
            file: k.file ? { id: k.file.id, filename: k.file.filename, mimetype: k.file.mimetype, size: Number(k.file.size) } : null,
            preview: k.kind === 'TEXT' ? (k.content ?? '').slice(0, 400) : null,
            content: k.kind === 'TEXT' ? k.content : undefined,
            characters: k.content?.length ?? 0,
            readable: k.kind !== 'FILE' || !!k.content,
            indexed_at: k.indexed_at,
            added_by: k.added_by ?? null,
            created_at: k.created_at,
        };
    }

    private include = { file: { select: { id: true, filename: true, mimetype: true, size: true } }, added_by: { select: { id: true, name: true } } } as const;

    async list(actor: Actor, botId: string | null) {
        if (botId) await this.access.requireUsableBot(actor.organization_id, actor.user_id, botId);
        const rows = await this.prisma.knowledgeItem.findMany({
            where: { organization_id: actor.organization_id, deleted_at: null, ...(botId ? { bot_id: botId } : { scope: 'ORGANIZATION' }) },
            include: this.include,
            orderBy: { created_at: 'desc' },
        });
        return rows.map((r) => this.shape(r));
    }

    private async requireCanEdit(actor: Actor, botId: string | null) {
        if (botId) return this.access.requireEditableBot(actor.organization_id, actor.user_id, botId);
        if (!isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can change the organisation knowledge library');
    }

    async add(actor: Actor, botId: string | null, dto: AddKnowledgeDto) {
        await this.requireCanEdit(actor, botId);
        const base = { organization_id: actor.organization_id, scope: botId ? ('BOT' as const) : ('ORGANIZATION' as const), bot_id: botId, added_by_id: actor.user_id };
        let item: KnowledgeItem;
        if (dto.kind === 'FILE') {
            const file = await this.prisma.file.findFirst({ where: { id: dto.file_id, organization_id: actor.organization_id, uploaded_by_id: actor.user_id, status: 'READY', deleted_at: null } });
            if (!file) throw new BadRequestException('Upload the file first');
            if (await this.prisma.knowledgeItem.count({ where: { file_id: file.id } })) throw new BadRequestException('This file is already in knowledge');
            if (file.area !== 'KNOWLEDGE') throw new BadRequestException('Upload the file as knowledge');
            await this.prisma.file.update({ where: { id: file.id }, data: { bot_id: botId } });
            const text = await extractText(await this.storage.read(file.bucket, file.object_path), file.mimetype, file.filename);
            item = await this.prisma.knowledgeItem.create({ data: { ...base, kind: 'FILE', title: dto.title?.trim() || file.filename, file_id: file.id, content: text, indexed_at: text ? new Date() : null } });
        } else if (dto.kind === 'LINK') {
            let title = dto.title?.trim() || dto.url!;
            let content: string | null = null;
            try {
                const page = await fetchReadable(dto.url!, 200_000);
                title = dto.title?.trim() || page.title || title;
                content = page.text;
            } catch (e) {
                this.logger.warn(`Knowledge link fetch failed: ${(e as Error).message}`);
            }
            item = await this.prisma.knowledgeItem.create({ data: { ...base, kind: 'LINK', title: title.slice(0, 200), url: dto.url, content, indexed_at: content ? new Date() : null } });
            if (content) await this.prisma.knowledgeLink.create({ data: { knowledge_item_id: item.id, url: dto.url!, title, fetched_at: new Date(), fetched_by_id: actor.user_id } });
        } else {
            if (!dto.content?.trim()) throw new BadRequestException('Write some text');
            item = await this.prisma.knowledgeItem.create({ data: { ...base, kind: 'TEXT', title: dto.title?.trim() || dto.content.trim().slice(0, 60), content: dto.content.trim(), indexed_at: new Date() } });
        }
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'knowledge.added', target_type: botId ? 'bot' : 'organization', target_id: botId ?? actor.organization_id, metadata: { title: item.title, kind: item.kind } });
        return this.shape(await this.prisma.knowledgeItem.findUniqueOrThrow({ where: { id: item.id }, include: this.include }));
    }

    /** One item including its full text (any kind), so the editor can show everything bots read. */
    async one(actor: Actor, id: string) {
        const item = await this.prisma.knowledgeItem.findFirst({ where: { id, organization_id: actor.organization_id, deleted_at: null }, include: this.include });
        if (!item) throw new NotFoundException('Knowledge not found');
        if (item.bot_id) await this.access.requireUsableBot(actor.organization_id, actor.user_id, item.bot_id);
        return { ...this.shape(item), content: item.content ?? '' };
    }

    async update(actor: Actor, id: string, dto: { title?: string; content?: string; url?: string }) {
        const item = await this.prisma.knowledgeItem.findFirst({ where: { id, organization_id: actor.organization_id, deleted_at: null } });
        if (!item) throw new NotFoundException('Knowledge not found');
        await this.requireCanEdit(actor, item.bot_id);
        const data: Prisma.KnowledgeItemUpdateInput = {};
        if (dto.title?.trim()) data.title = dto.title.trim().slice(0, 200);
        if (dto.content !== undefined) {
            if (item.kind === 'TEXT' && !dto.content.trim()) throw new BadRequestException('Write some text');
            data.content = item.kind === 'TEXT' ? dto.content : dto.content.trim() || null;
            data.indexed_at = data.content ? new Date() : null;
        }
        if (dto.url && item.kind === 'LINK' && dto.url !== item.url) {
            data.url = dto.url;
            if (dto.content === undefined) {
                try {
                    const page = await fetchReadable(dto.url, 200_000);
                    data.content = page.text;
                    data.indexed_at = page.text ? new Date() : null;
                } catch (e) {
                    this.logger.warn(`Knowledge link fetch failed: ${(e as Error).message}`);
                    data.content = null;
                    data.indexed_at = null;
                }
            }
        }
        const updated = await this.prisma.knowledgeItem.update({ where: { id }, data, include: this.include });
        return this.shape(updated);
    }

    /** Soft delete: the item and its file can be restored for 30 days (§7.7). */
    async remove(actor: Actor, id: string) {
        const item = await this.prisma.knowledgeItem.findFirst({ where: { id, organization_id: actor.organization_id, deleted_at: null } });
        if (!item) throw new NotFoundException('Knowledge not found');
        await this.requireCanEdit(actor, item.bot_id);
        const now = new Date();
        await this.prisma.knowledgeItem.update({ where: { id }, data: { deleted_at: now } });
        if (item.file_id) await this.prisma.file.update({ where: { id: item.file_id }, data: { deleted_at: now, purge_after: new Date(now.getTime() + RESTORE_WINDOW_MS) } });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'knowledge.removed', target_type: item.bot_id ? 'bot' : 'organization', target_id: item.bot_id ?? actor.organization_id, metadata: { title: item.title } });
        return { ok: true };
    }

    // ---------------- Used by the agent's tools ----------------

    /** Knowledge a bot may use: its own, plus the organisation library when enabled for the bot. */
    private botWhere(orgId: string, bot: { id: string; org_knowledge_enabled: boolean }): Prisma.KnowledgeItemWhereInput {
        return { organization_id: orgId, deleted_at: null, OR: [{ bot_id: bot.id }, ...(bot.org_knowledge_enabled ? [{ scope: 'ORGANIZATION' as const }] : [])] };
    }

    async search(orgId: string, bot: { id: string; org_knowledge_enabled: boolean }, query: string, limit = 6) {
        const items = await this.prisma.knowledgeItem.findMany({ where: { ...this.botWhere(orgId, bot), content: { not: null } }, select: { id: true, title: true, kind: true, url: true, content: true } });
        const hits: { id: string; title: string; kind: string; url: string | null; chunk: number; score: number; excerpt: string }[] = [];
        for (const it of items) {
            chunkText(it.content ?? '').forEach((c, i) => {
                const score = scoreChunk(`${it.title}\n${c}`, query);
                if (score > 0) hits.push({ id: it.id, title: it.title, kind: it.kind, url: it.url, chunk: i, score, excerpt: c });
            });
        }
        return hits.sort((a, b) => b.score - a.score).slice(0, limit).map(({ score: _s, ...h }) => h);
    }

    async read(orgId: string, bot: { id: string; org_knowledge_enabled: boolean }, id: string, offset = 0, length = 12_000) {
        const it = await this.prisma.knowledgeItem.findFirst({ where: { id, ...this.botWhere(orgId, bot) } });
        if (!it) throw new Error('That knowledge item does not exist or this bot cannot use it');
        if (!it.content) return { id, title: it.title, error: 'This file could not be read as text (it may be an image or a scanned document).' };
        const text = it.content.slice(offset, offset + length);
        return { id, title: it.title, kind: it.kind, url: it.url, offset, total_characters: it.content.length, text, more: offset + length < it.content.length ? { next_offset: offset + length } : null };
    }
}
