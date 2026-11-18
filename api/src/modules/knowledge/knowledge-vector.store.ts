import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { EMBEDDING_DIMS } from '@/integrations/ai/interfaces/ai.interface';

/** Upper bound of vectors kept in memory (~6 KB each at 1536 dims → ~150 MB). Least recently used items are dropped first. */
const MAX_CACHED_VECTORS = 25_000;

interface CachedItem {
    /** indexed_at in ms: a re-index bumps it and invalidates the entry. */
    version: number;
    positions: number[];
    /** Unit-length vectors, concatenated (positions.length × EMBEDDING_DIMS). */
    vectors: Float32Array;
}

export interface VectorCandidate {
    id: string;
    indexed_at: Date | null;
}

export interface VectorHit {
    item_id: string;
    position: number;
    score: number;
}

/**
 * Embeddings of knowledge passages and exact nearest-neighbour search over them (cosine similarity).
 * Vectors live in Postgres (`knowledge_chunks.embedding`, float32 bytes) and are cached per item in memory, so a search
 * only reads vectors of items that changed since they were last cached. The candidate set is always one bot's knowledge
 * (its own items plus the organisation library), which keeps exact search fast without a vector index.
 */
@Injectable()
export class KnowledgeVectorStore {
    private readonly cache = new Map<string, CachedItem>();
    private cachedVectors = 0;

    constructor(private readonly prisma: PrismaService) { }

    /** Replaces an item's passages inside the caller's transaction. */
    async replaceChunks(tx: Prisma.TransactionClient, itemId: string, chunks: { content: string; embedding: number[] }[]) {
        await tx.knowledgeChunk.deleteMany({ where: { knowledge_item_id: itemId } });
        if (chunks.length) {
            await tx.knowledgeChunk.createMany({
                data: chunks.map((c, position) => ({ knowledge_item_id: itemId, position, content: c.content, embedding: toBytes(c.embedding) })),
            });
        }
        this.evict(itemId);
    }

    /** The `limit` passages most similar to the query vector among the candidate items, best first. */
    async search(candidates: VectorCandidate[], query: number[], limit: number, minScore: number): Promise<VectorHit[]> {
        if (!candidates.length) return [];
        await this.load(candidates);
        const q = normalize(Float32Array.from(query));
        const hits: VectorHit[] = [];
        for (const c of candidates) {
            const item = this.cache.get(c.id);
            if (!item) continue;
            // Map order is LRU order: re-insert to mark as recently used.
            this.cache.delete(c.id);
            this.cache.set(c.id, item);
            for (let i = 0; i < item.positions.length; i++) {
                const score = dot(item.vectors, i * EMBEDDING_DIMS, q);
                if (score >= minScore) hits.push({ item_id: c.id, position: item.positions[i], score });
            }
        }
        return hits.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    evict(itemId: string) {
        const item = this.cache.get(itemId);
        if (!item) return;
        this.cachedVectors -= item.positions.length;
        this.cache.delete(itemId);
    }

    /** Loads vectors for candidates that are not cached or were re-indexed since. */
    private async load(candidates: VectorCandidate[]) {
        const stale = candidates.filter((c) => this.cache.get(c.id)?.version !== (c.indexed_at?.getTime() ?? 0));
        if (!stale.length) return;
        const rows = await this.prisma.knowledgeChunk.findMany({
            where: { knowledge_item_id: { in: stale.map((c) => c.id) } },
            select: { knowledge_item_id: true, position: true, embedding: true },
            orderBy: [{ knowledge_item_id: 'asc' }, { position: 'asc' }],
        });
        const byItem = new Map<string, typeof rows>();
        for (const r of rows) byItem.set(r.knowledge_item_id, [...(byItem.get(r.knowledge_item_id) ?? []), r]);
        for (const c of stale) {
            this.evict(c.id);
            const chunks = byItem.get(c.id) ?? [];
            const vectors = new Float32Array(chunks.length * EMBEDDING_DIMS);
            chunks.forEach((ch, i) => vectors.set(normalize(fromBytes(ch.embedding)), i * EMBEDDING_DIMS));
            this.cache.set(c.id, { version: c.indexed_at?.getTime() ?? 0, positions: chunks.map((ch) => ch.position), vectors });
            this.cachedVectors += chunks.length;
        }
        for (const [id] of this.cache) {
            if (this.cachedVectors <= MAX_CACHED_VECTORS) break;
            this.evict(id);
        }
    }
}

const toBytes = (v: number[]): Uint8Array<ArrayBuffer> => {
    if (v.length !== EMBEDDING_DIMS) throw new Error(`Expected a ${EMBEDDING_DIMS}-dimension embedding, got ${v.length}`);
    return new Uint8Array(Float32Array.from(v).buffer);
};

const fromBytes = (b: Uint8Array): Float32Array => {
    // Copy into an aligned buffer: Prisma's Uint8Array may sit at any byte offset of a shared buffer.
    const copy = new Uint8Array(b.byteLength);
    copy.set(b);
    return new Float32Array(copy.buffer, 0, Math.min(EMBEDDING_DIMS, copy.byteLength / 4));
};

function normalize(v: Float32Array): Float32Array {
    let n = 0;
    for (let i = 0; i < v.length; i++) n += v[i] * v[i];
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
}

function dot(a: Float32Array, offset: number, b: Float32Array): number {
    let s = 0;
    for (let i = 0; i < EMBEDDING_DIMS; i++) s += a[offset + i] * b[i];
    return s;
}
