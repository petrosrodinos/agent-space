import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type Redis from 'ioredis';
import type { Namespace, Socket } from 'socket.io';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';
import { AccessService } from '../access/access.service';
import { parseCorsUrls, resolveCorsOrigins } from '@/shared/config/cors';
import type { AccessTokenPayload } from '../auth/interfaces/auth.interface';

interface Sub {
    cursor: string;
    stream: string;
}

const cmpId = (a: string, b: string) => {
    const [am, as] = a.split('-').map(Number);
    const [bm, bs] = b.split('-').map(Number);
    return am - bm || as - bs;
};

/**
 * One real-time connection per client. Workers publish to Redis Streams; this instance reads the streams its
 * connected clients need and forwards them. Reconnecting clients send their last entry ID and get everything after it (§14.4).
 */
@WebSocketGateway({
    namespace: '/realtime',
    cors: {
        origin: resolveCorsOrigins({ nodeEnv: process.env.NODE_ENV, corsUrls: parseCorsUrls(process.env.CORS_URLS), appUrl: process.env.APP_URL, landingUrl: process.env.LANDING_URL }),
        credentials: true,
    },
    pingInterval: 20_000,
    pingTimeout: 20_000,
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
    private readonly logger = new Logger(RealtimeGateway.name);
    @WebSocketServer() server!: Namespace;
    private readonly subs = new Map<string, Sub>(); // redis key → cursor
    private reader?: Redis;
    private running = false;

    constructor(
        private readonly redis: RedisService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly access: AccessService,
    ) { }

    afterInit() {
        this.reader = this.redis.duplicate();
        this.running = true;
        void this.readLoop();
    }

    onModuleDestroy() {
        this.running = false;
        this.reader?.disconnect();
    }

    async handleConnection(socket: Socket) {
        try {
            const token = (socket.handshake.auth?.token as string) || String(socket.handshake.headers.authorization ?? '').replace(/^Bearer /, '');
            const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.config.get('JWT_SECRET') });
            if (payload.typ !== 'access') throw new Error('bad token');
            socket.data.userId = payload.sub;
            socket.emit('ready', { user_id: payload.sub });
        } catch {
            socket.emit('auth_error', { message: 'Session expired' });
            socket.disconnect(true);
        }
    }

    handleDisconnect(socket: Socket) {
        for (const room of socket.rooms) this.maybeDrop(room, socket.id);
    }

    private maybeDrop(room: string, leavingSocketId?: string) {
        const members = this.server?.adapter.rooms.get(room);
        const remaining = members ? [...members].filter((id) => id !== leavingSocketId).length : 0;
        if (!remaining) this.subs.delete(room);
    }

    private async lastId(key: string) {
        const last = await this.redis.client.xrevrange(key, '+', '-', 'COUNT', 1);
        return last[0]?.[0] ?? '0-0';
    }

    private async attach(socket: Socket, key: string, stream: string, lastId?: string) {
        socket.join(key);
        let replayEnd = await this.lastId(key);
        if (lastId) {
            const first = await this.redis.client.xrange(key, '-', '+', 'COUNT', 1);
            if (first[0] && cmpId(first[0][0], lastId) > 0 && lastId !== '0-0') {
                // The client is older than the stream: it must reload from the database.
                socket.emit('resync', { stream });
            } else {
                const entries = await this.redis.client.xrange(key, `(${lastId}`, '+', 'COUNT', 1000);
                for (const [id, fields] of entries) this.emitEntry(socket, stream, id, fields);
                if (entries.length) replayEnd = entries[entries.length - 1][0];
            }
        }
        if (!this.subs.has(key)) this.subs.set(key, { cursor: replayEnd, stream });
        socket.emit('subscribed', { stream, last_id: replayEnd });
    }

    @SubscribeMessage('subscribe')
    async subscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: { stream: 'user' | 'conversation'; conversation_id?: string; last_id?: string }) {
        const userId = socket.data.userId as string | undefined;
        if (!userId) return { ok: false };
        if (body?.stream === 'user') {
            await this.attach(socket, this.redis.key(RedisKeys.userStream(userId)), 'user', body.last_id);
            return { ok: true };
        }
        if (body?.stream === 'conversation' && body.conversation_id) {
            if (!(await this.access.isParticipant(body.conversation_id, userId))) return { ok: false, error: 'not_a_participant' };
            await this.attach(socket, this.redis.key(RedisKeys.convStream(body.conversation_id)), `conversation:${body.conversation_id}`, body.last_id);
            return { ok: true };
        }
        return { ok: false };
    }

    @SubscribeMessage('unsubscribe')
    unsubscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: { conversation_id: string }) {
        const key = this.redis.key(RedisKeys.convStream(body.conversation_id));
        socket.leave(key);
        this.maybeDrop(key);
        return { ok: true };
    }

    private emitEntry(target: Socket | ReturnType<Namespace['to']>, stream: string, id: string, fields: string[]) {
        const raw = fields[fields.indexOf('e') + 1];
        if (!raw) return;
        try {
            const e = JSON.parse(raw);
            target.emit('event', { stream, id, type: e.type, data: e.data, at: e.at });
        } catch { /* ignore malformed */ }
    }

    private async readLoop() {
        while (this.running) {
            const keys = [...this.subs.keys()];
            if (!keys.length) {
                await new Promise((r) => setTimeout(r, 300));
                continue;
            }
            try {
                const res = (await this.reader!.xread('COUNT', 500, 'BLOCK', 1000, 'STREAMS', ...keys, ...keys.map((k) => this.subs.get(k)!.cursor))) as [string, [string, string[]][]][] | null;
                if (!res) continue;
                for (const [key, entries] of res) {
                    const sub = this.subs.get(key);
                    if (!sub) continue;
                    for (const [id, fields] of entries) {
                        if (cmpId(id, sub.cursor) <= 0) continue;
                        this.emitEntry(this.server.to(key), sub.stream, id, fields);
                        sub.cursor = id;
                    }
                }
            } catch (e) {
                if (!this.running) return;
                this.logger.warn(`Stream read failed: ${(e as Error).message}`);
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
    }
}
