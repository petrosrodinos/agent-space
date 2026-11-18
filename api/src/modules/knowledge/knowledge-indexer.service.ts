import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { File, KnowledgeItem } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { StorageService } from '@/integrations/storage/storage.service';
import { AiService } from '@/integrations/ai/services/ai.service';
import { chunkText, clean, extractPdfPages, extractText, fileFormat, FileFormats } from '@/shared/utils/files/text-extract.utils';
import { fetchReadable } from '../agent/tools/web.utils';
import { KnowledgeVectorStore } from './knowledge-vector.store';
import {
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    KnowledgeErrors,
    KnowledgeIndexError,
    LINK_MAX_CHARS,
    MAX_IMAGE_BYTES,
    MAX_OCR_PAGES,
    OCR_CONCURRENCY,
    SCANNED_PAGE_MAX_CHARS,
} from './knowledge.constants';

/** Raised when the item changed while it was being indexed; the newer job does the work. */
class SupersededError extends Error { }

/**
 * Turns a knowledge item into searchable passages: reads the source (file text, OCR for scanned PDF pages and images,
 * web page text), splits it into overlapping passages and stores their embeddings (§6.2). Runs in the `knowledge` queue.
 */
@Injectable()
export class KnowledgeIndexerService {
    private readonly logger = new Logger(KnowledgeIndexerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly ai: AiService,
        private readonly vectors: KnowledgeVectorStore,
    ) { }

    async index(itemId: string, extract: boolean): Promise<void> {
        const item = await this.prisma.knowledgeItem.findFirst({ where: { id: itemId, deleted_at: null }, include: { file: true } });
        if (!item) return;
        const startedAt = item.updated_at;
        const source = extract ? await this.readSource(item) : { content: item.content, title: item.title };
        const content = source.content?.trim() ? source.content : null;
        if (!content) throw new KnowledgeIndexError(item.kind === 'FILE' ? KnowledgeErrors.NO_TEXT_FILE : item.kind === 'LINK' ? KnowledgeErrors.NO_TEXT_PAGE : KnowledgeErrors.NO_TEXT);

        const passages = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);
        const embeddings = await this.ai.embedMany(passages.map((p) => `${source.title}\n\n${p}`));

        try {
            await this.prisma.$transaction(
                async (tx) => {
                    // Only commit when nobody edited the item meanwhile (updated_at is bumped by every edit).
                    const { count } = await tx.knowledgeItem.updateMany({
                        where: { id: item.id, updated_at: startedAt, deleted_at: null },
                        data: { content, title: source.title, status: 'READY', status_error: null, indexed_at: new Date() },
                    });
                    if (!count) throw new SupersededError();
                    await this.vectors.replaceChunks(tx, item.id, passages.map((p, i) => ({ content: p, embedding: embeddings[i] })));
                    if (extract && item.kind === 'LINK' && item.url) {
                        await tx.knowledgeLink.create({ data: { knowledge_item_id: item.id, url: item.url, title: source.title, fetched_at: new Date(), fetched_by_id: item.added_by_id } });
                    }
                },
                { timeout: 60_000 },
            );
            this.logger.log(`Indexed knowledge ${item.id}: ${content.length} characters, ${passages.length} passages`);
        } catch (e) {
            if (e instanceof SupersededError) return this.logger.log(`Knowledge ${item.id} changed while indexing; skipped`);
            throw e;
        }
    }

    /** Marks an item as failed with a message people can act on. */
    async fail(itemId: string, message: string) {
        await this.prisma.knowledgeItem.updateMany({ where: { id: itemId, deleted_at: null }, data: { status: 'FAILED', status_error: message } });
    }

    private async readSource(item: KnowledgeItem & { file: File | null }): Promise<{ content: string | null; title: string }> {
        if (item.kind === 'FILE') {
            if (!item.file || item.file.deleted_at) throw new KnowledgeIndexError(KnowledgeErrors.FILE_MISSING);
            return { content: await this.readFile(item.file), title: item.title };
        }
        if (item.kind === 'LINK' && item.url) {
            try {
                const page = await fetchReadable(item.url, LINK_MAX_CHARS);
                // Use the page's own title unless someone named the item.
                const title = item.title === item.url && page.title ? page.title.slice(0, 200) : item.title;
                return { content: page.text, title };
            } catch (e) {
                throw new KnowledgeIndexError(KnowledgeErrors.PAGE_FETCH((e as Error).message));
            }
        }
        return { content: item.content, title: item.title };
    }

    /** File text; images and scanned PDF pages go through the vision model. */
    private async readFile(file: File): Promise<string | null> {
        const format = fileFormat(file.mimetype, file.filename);
        if (format === FileFormats.UNSUPPORTED) throw new KnowledgeIndexError(KnowledgeErrors.UNSUPPORTED);
        const data = await this.storage.read(file.bucket, file.object_path);
        if (format === FileFormats.IMAGE) {
            if (data.length > MAX_IMAGE_BYTES) throw new KnowledgeIndexError(KnowledgeErrors.IMAGE_TOO_LARGE);
            const { text } = await this.ai.transcribe({ data, mediaType: file.mimetype, filename: file.filename });
            return clean(text);
        }
        if (format === FileFormats.PDF) return this.readPdf(data, file.filename);
        return extractText(data, file.mimetype, file.filename);
    }

    /** Text layer per page; pages without one (scans, photos of pages) are read one by one with the vision model. */
    private async readPdf(data: Buffer, filename: string): Promise<string | null> {
        let pages: string[];
        try {
            pages = await extractPdfPages(data);
        } catch (e) {
            this.logger.warn(`PDF text extraction failed for ${filename}: ${(e as Error).message}`);
            throw new KnowledgeIndexError(KnowledgeErrors.NO_TEXT_FILE);
        }
        const scanned = pages.map((t, i) => (t.replace(/\s/g, '').length < SCANNED_PAGE_MAX_CHARS ? i : -1)).filter((i) => i >= 0);
        if (scanned.length) {
            const source = await PDFDocument.load(data, { ignoreEncryption: true });
            const todo = scanned.slice(0, MAX_OCR_PAGES);
            if (scanned.length > todo.length) this.logger.warn(`${filename}: ${scanned.length} scanned pages, reading the first ${MAX_OCR_PAGES}`);
            await runPool(todo, OCR_CONCURRENCY, async (index) => {
                const single = await PDFDocument.create();
                const [page] = await single.copyPages(source, [index]);
                single.addPage(page);
                const { text } = await this.ai.transcribe({ data: Buffer.from(await single.save()), mediaType: 'application/pdf', filename: `${filename} (page ${index + 1})` });
                pages[index] = text;
            });
            this.logger.log(`${filename}: read ${todo.length} of ${pages.length} pages with the vision model`);
        }
        return clean(pages.filter((p) => p.trim()).join('\n\n'));
    }
}

/** Runs `fn` over items with at most `size` in flight. */
async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(size, items.length) }, async () => {
            while (next < items.length) await fn(items[next++]);
        }),
    );
}
