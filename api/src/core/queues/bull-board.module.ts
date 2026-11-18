import { Module, Global } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { ALL_QUEUES, BULL_BOARD_ADAPTER } from './queues.constants';

/** Bull Board at /admin/queues (basic auth), with every queue registered (§14.4 Operations). */
@Global()
@Module({
    providers: [
        {
            provide: BULL_BOARD_ADAPTER,
            inject: ALL_QUEUES.map((q) => getQueueToken(q)),
            useFactory: (...queues: Queue[]) => {
                const serverAdapter = new ExpressAdapter();
                serverAdapter.setBasePath('/admin/queues');
                createBullBoard({ queues: queues.map((q) => new BullMQAdapter(q)), serverAdapter });
                return serverAdapter;
            },
        },
    ],
    exports: [BULL_BOARD_ADAPTER],
})
export class BullBoardModule { }
