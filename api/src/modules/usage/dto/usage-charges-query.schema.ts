import { z } from 'zod';
import { UsageKind } from 'generated/prisma';
import { PaginationQuerySchema } from '@/shared/utils/pagination/pagination.utils';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const UsageChargesQuerySchema = PaginationQuerySchema.extend({
    kind: z.nativeEnum(UsageKind).optional(),
    user_id: z.string().uuid().optional(),
    bot_id: z.string().uuid().optional(),
    model_id: z.string().uuid().optional(),
    /** Inclusive day range, YYYY-MM-DD (UTC). */
    from: day.optional(),
    to: day.optional(),
});

export type UsageChargesQuery = z.infer<typeof UsageChargesQuerySchema>;
