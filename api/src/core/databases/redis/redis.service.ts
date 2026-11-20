import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';
import { randomBytes } from 'crypto';
import { REDIS_OPTIONS, redisPrefix } from './redis.constants';

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

const RENEW_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end`;

export interface HeldLock {
    key: string;
    token: string;
    release: () => Promise<void>;
}

/**
 * Shared Redis access. Every key goes through `key()` so it carries the `as:<env>:` prefix.
 * Holds one command client; blocking readers get their own connection via `duplicate()`.
 * Never stores secret values, decrypted tokens or signed URLs (§14.4).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    readonly client: Redis;
    readonly prefix: string;
    private readonly extra: Redis[] = [];

    constructor(
        @Inject(REDIS_OPTIONS) private readonly options: RedisOptions | null,
        config: ConfigService,
    ) {
        this.prefix = redisPrefix(config.get('NODE_ENV'));
        if (!options) throw new Error('REDIS_URL is required');
        this.client = new Redis({ ...options, reconnectOnError: () => true });
        this.client.on('error', (e) => this.logger.error(`Redis error: ${e.message}`));
    }

    key(suffix: string) {
        return `${this.prefix}${suffix}`;
    }

    /** A dedicated connection (for XREAD BLOCK / BLPOP) that is closed on shutdown. */
    duplicate(): Redis {
        const conn = new Redis({ ...this.options, reconnectOnError: () => true });
        conn.on('error', (e) => this.logger.error(`Redis (dup) error: ${e.message}`));
        this.extra.push(conn);
        // Short-lived blocking readers (device replies) disconnect after use; don't keep them around.
        conn.once('end', () => {
            const i = this.extra.indexOf(conn);
            if (i >= 0) this.extra.splice(i, 1);
        });
        return conn;
    }

    /** SET NX PX lock with a random token, released only by the holder (Lua). §14.4 */
    async acquireLock(suffix: string, ttlMs = 30_000): Promise<HeldLock | null> {
        const key = this.key(suffix);
        const token = randomBytes(16).toString('hex');
        const ok = await this.client.set(key, token, 'PX', ttlMs, 'NX');
        if (ok !== 'OK') return null;
        return { key, token, release: () => this.releaseLock(key, token) };
    }

    async renewLock(lock: HeldLock, ttlMs = 30_000): Promise<boolean> {
        const res = await this.client.eval(RENEW_LOCK_LUA, 1, lock.key, lock.token, String(ttlMs));
        return res === 1;
    }

    private async releaseLock(key: string, token: string) {
        await this.client.eval(RELEASE_LOCK_LUA, 1, key, token).catch(() => undefined);
    }

    async onModuleDestroy() {
        for (const c of this.extra) c.disconnect();
        this.client.disconnect();
    }
}
