import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { Jobs, Queues } from '@/core/queues/queues.constants';
import { KnowledgeIndexerService } from '@/modules/knowledge/knowledge-indexer.service';
import { KNOWLEDGE_JOB_OPTIONS, KnowledgeErrors, KnowledgeIndexError, type KnowledgeIndexJob } from '@/modules/knowledge/knowledge.constants';

/** knowledge queue: extracts text (incl. OCR) and embeds knowledge items (§6.2). */
@Processor(Queues.KNOWLEDGE, { concurrency: 3 })
export class KnowledgeProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly logger = new Logger(KnowledgeProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly indexer: KnowledgeIndexerService,
        @InjectQueue(Queues.KNOWLEDGE) private readonly queue: Queue<KnowledgeIndexJob>,
    ) {
        super();
    }

    /** Picks up items left PROCESSING (worker restarts, items created before embeddings existed). Indexing is idempotent. */
    async onApplicationBootstrap() {
        const pending = await this.prisma.knowledgeItem.findMany({ where: { status: 'PROCESSING', deleted_at: null }, select: { id: true, kind: true, content: true } });
        if (!pending.length) return;
        // Re-read the source only when there is no text yet, so hand-edited text is kept.
        await this.queue.addBulk(pending.map((k) => ({ name: Jobs.knowledge.INDEX, data: { item_id: k.id, extract: k.kind !== 'TEXT' && !k.content }, opts: KNOWLEDGE_JOB_OPTIONS })));
        this.logger.log(`Queued ${pending.length} knowledge item(s) for indexing`);
    }

    async process(job: Job<KnowledgeIndexJob>) {
        if (job.name !== Jobs.knowledge.INDEX) return;
        const { item_id, extract } = job.data;
        try {
            await this.indexer.index(item_id, extract);
        } catch (e) {
            if (e instanceof KnowledgeIndexError) return this.indexer.fail(item_id, e.message);
            const last = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
            this.logger.warn(`Indexing knowledge ${item_id} failed (attempt ${job.attemptsMade + 1}): ${(e as Error).message}`);
            if (last) await this.indexer.fail(item_id, KnowledgeErrors.GENERIC);
            throw e;
        }
    }
}
