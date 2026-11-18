import { z } from 'zod';
import { PaginationQuerySchema } from '@/shared/utils/pagination/pagination.utils';

export const ActivityQuerySchema = PaginationQuerySchema.extend({
    action: z.string().max(80).optional(),
    actor_type: z.enum(['USER', 'BOT', 'SYSTEM']).optional(),
    bot_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
});

export type ActivityQuery = z.infer<typeof ActivityQuerySchema>;
