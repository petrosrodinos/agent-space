import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';

interface ThrottlerStorageRecord {
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
}

/** Rate-limit counters in Redis so limits apply across API instances (§14.4). */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
    constructor(private readonly redis: RedisService) { }

    async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
        const hitKey = this.redis.key(RedisKeys.rateLimit(`${throttlerName}:${key}`));
        const blockKey = `${hitKey}:blocked`;

        const blockedTtl = await this.redis.client.pttl(blockKey);
        if (blockedTtl > 0) {
            return { totalHits: limit + 1, timeToExpire: Math.ceil(blockedTtl / 1000), isBlocked: true, timeToBlockExpire: Math.ceil(blockedTtl / 1000) };
        }

        const [[, hits], [, pttl]] = (await this.redis.client.multi().incr(hitKey).pttl(hitKey).exec()) as [[null, number], [null, number]];
        if (pttl < 0) await this.redis.client.pexpire(hitKey, ttl);
        const timeToExpire = Math.ceil((pttl < 0 ? ttl : pttl) / 1000);

        if (hits > limit) {
            await this.redis.client.set(blockKey, '1', 'PX', blockDuration || ttl);
            return { totalHits: hits, timeToExpire, isBlocked: true, timeToBlockExpire: Math.ceil((blockDuration || ttl) / 1000) };
        }
        return { totalHits: hits, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
    }
}
