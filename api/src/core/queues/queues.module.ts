import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';
import { REDIS_OPTIONS, redisPrefix } from '../databases/redis/redis.constants';
import { ALL_QUEUES, DEFAULT_JOB_OPTIONS } from './queues.constants';

/** Connects BullMQ to Redis with the shared `as:<env>` prefix and registers every queue in §14.4. */
@Global()
@Module({
    imports: [
        BullModule.forRootAsync({
            inject: [REDIS_OPTIONS, ConfigService],
            useFactory: (redisOptions: RedisOptions | null, config: ConfigService) => {
                if (!redisOptions) throw new Error('BULLMQ not initialized: REDIS_URL missing');
                return {
                    connection: redisOptions,
                    prefix: redisPrefix(config.get('NODE_ENV')).replace(/:$/, ''),
                    defaultJobOptions: DEFAULT_JOB_OPTIONS,
                };
            },
        }),
        BullModule.registerQueue(...ALL_QUEUES.map((name) => ({ name }))),
    ],
    exports: [BullModule],
})
export class QueuesModule { }
