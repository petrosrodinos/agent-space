import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KnowledgeItem, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { Jobs, Queues } from '@/core/queues/queues.constants';
import { AiService } from '@/integrations/ai/services/ai.service';
import { AccessService, isAdminRole } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import type { AddKnowledgeDto } from './dto/knowledge.dto';
import { KnowledgeVectorStore } from './knowledge-vector.store';
import { KNOWLEDGE_JOB_OPTIONS, KnowledgeErrors, KnowledgeIndexJob, MIN_SEARCH_SCORE, SEARCH_LIMIT } from './knowledge.constants';

const RESTORE_WINDOW_MS = 30 * 86400_000;

/**
 * Bot knowledge and the organisation knowledge library (§6.2, §7.7).
 * Files are stored once in Cloud Storage. Every item is indexed in the background (`knowledge` queue): its text is
 * extracted into `content` (OCR for images and scanned PDFs) and split into embedded passages for vector search.
 */
@Injectable()
export class KnowledgeService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly ai: AiService,
        private readonly vectors: KnowledgeVectorStore,
        @InjectQueue(Queues.KNOWLEDGE) private readonly queue: Queue<KnowledgeIndexJob>,
    ) { }

    /** Queues (re-)indexing; the item shows as PROCESSING until the worker is done. */
    private enqueue(itemId: string, extract: boolean) {
        return this.queue.add(Jobs.knowledge.INDEX, { item_id: itemId, extract }, KNOWLEDGE_JOB_OPTIONS);
    }

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
            status: k.status,
            status_error: k.status_error,
            readable: k.status === 'READY',
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
            item = await this.prisma.knowledgeItem.create({ data: { ...base, kind: 'FILE', title: dto.title?.trim() || file.filename, file_id: file.id } });
        } else if (dto.kind === 'LINK') {
            // The title falls back to the address; indexing replaces it with the page title.
            item = await this.prisma.knowledgeItem.create({ data: { ...base, kind: 'LINK', title: (dto.title?.trim() || dto.url!).slice(0, 200), url: dto.url } });
        } else {
            if (!dto.content?.trim()) throw new BadRequestException('Write some text');
            item = await this.prisma.knowledgeItem.create({ data: { ...base, kind: 'TEXT', title: dto.title?.trim() || dto.content.trim().slice(0, 60), content: dto.content.trim() } });
        }
        await this.enqueue(item.id, item.kind !== 'TEXT');
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
        const titleChanged = data.title !== undefined && data.title !== item.title;
        const urlChanged = !!dto.url && item.kind === 'LINK' && dto.url !== item.url;
        if (urlChanged) data.url = dto.url;
        if (dto.content !== undefined) {
            if (item.kind === 'TEXT' && !dto.content.trim()) throw new BadRequestException('Write some text');
            data.content = item.kind === 'TEXT' ? dto.content : dto.content.trim() || null;
        }
        // A new address re-reads the page unless the text was edited by hand too; any text or title change re-embeds.
        const extract = urlChanged && dto.content === undefined;
        const content = data.content !== undefined ? (data.content as string | null) : item.content;
        const reembed = extract || dto.content !== undefined || (titleChanged && !!content);
        if (reembed) {
            if (!extract && !content) Object.assign(data, { status: 'FAILED', status_error: KnowledgeErrors.NO_TEXT });
            else Object.assign(data, { status: 'PROCESSING', status_error: null });
        }
        const updated = await this.prisma.knowledgeItem.update({ where: { id }, data, include: this.include });
        if (reembed && updated.status === 'PROCESSING') await this.enqueue(id, extract);
        if (reembed && updated.status === 'FAILED') await this.prisma.knowledgeChunk.deleteMany({ where: { knowledge_item_id: id } });
        return this.shape(updated);
    }

    /** Reads the source again (file or web page) and re-indexes; notes are re-embedded. Used to retry failed items. */
    async reindex(actor: Actor, id: string) {
        const item = await this.prisma.knowledgeItem.findFirst({ where: { id, organization_id: actor.organization_id, deleted_at: null } });
        if (!item) throw new NotFoundException('Knowledge not found');
        await this.requireCanEdit(actor, item.bot_id);
        const updated = await this.prisma.knowledgeItem.update({ where: { id }, data: { status: 'PROCESSING', status_error: null }, include: this.include });
        await this.enqueue(id, item.kind !== 'TEXT');
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

    /** Vector search over the bot's knowledge: the passages closest in meaning to the query. */
    async search(orgId: string, bot: { id: string; org_knowledge_enabled: boolean }, query: string, limit = SEARCH_LIMIT) {
        const items = await this.prisma.knowledgeItem.findMany({ where: { ...this.botWhere(orgId, bot), status: 'READY' }, select: { id: true, title: true, kind: true, url: true, indexed_at: true } });
        if (!items.length || !query.trim()) return [];
        const [vector] = await this.ai.embedMany([query]);
        const hits = await this.vectors.search(items, vector, limit, MIN_SEARCH_SCORE);
        if (!hits.length) return [];
        const chunks = await this.prisma.knowledgeChunk.findMany({
            where: { OR: hits.map((h) => ({ knowledge_item_id: h.item_id, position: h.position })) },
            select: { knowledge_item_id: true, position: true, content: true },
        });
        const text = new Map(chunks.map((c) => [`${c.knowledge_item_id}:${c.position}`, c.content]));
        const byId = new Map(items.map((i) => [i.id, i]));
        return hits.map((h) => {
            const it = byId.get(h.item_id)!;
            return { id: it.id, title: it.title, kind: it.kind, url: it.url, chunk: h.position, relevance: Math.round(h.score * 100) / 100, excerpt: text.get(`${h.item_id}:${h.position}`) ?? '' };
        });
    }

    async read(orgId: string, bot: { id: string; org_knowledge_enabled: boolean }, id: string, offset = 0, length = 12_000) {
        const it = await this.prisma.knowledgeItem.findFirst({ where: { id, ...this.botWhere(orgId, bot) } });
        if (!it) throw new Error('That knowledge item does not exist or this bot cannot use it');
        if (!it.content) return { id, title: it.title, error: it.status === 'PROCESSING' ? 'This item is still being read. Try again in a minute.' : it.status_error || 'This item has no readable text.' };
        const text = it.content.slice(offset, offset + length);
        return { id, title: it.title, kind: it.kind, url: it.url, offset, total_characters: it.content.length, text, more: offset + length < it.content.length ? { next_offset: offset + length } : null };
    }
}
