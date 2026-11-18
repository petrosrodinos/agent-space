import { z } from 'zod';

export const PaginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export function paginate<T>(data: T[], total: number, page: number, limit: number) {
    const total_pages = Math.max(1, Math.ceil(total / limit));
    return {
        data,
        pagination: {
            total,
            page,
            limit,
            total_pages,
            has_next: page < total_pages,
            has_prev: page > 1,
        },
    };
}

/** JSON-safe conversion for Prisma rows (BigInt and Decimal). */
export function toJsonSafe<T>(value: T): T {
    return JSON.parse(
        JSON.stringify(value, (_k, v) => {
            if (typeof v === 'bigint') return Number(v);
            if (v && typeof v === 'object' && v.constructor?.name === 'Decimal') return Number(v);
            return v;
        }),
    );
}
