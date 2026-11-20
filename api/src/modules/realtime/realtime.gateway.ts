import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type Redis from 'ioredis';
import type { Namespace, Socket } from 'socket.io';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RedisKeys } from '@/core/databases/redis/redis.constants';
import { AccessService } from '../access/access.service';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

/** A device counts as online while its socket is connected; the marker is refreshed every 30 s and expires after 90 s. */
const DEVICE_ONLINE_TTL = 90;
const MAX_DEVICE_REPLY = 6 * 1024 * 1024;
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
    // Device tool answers can carry a screenshot or a file (§14.3).
    maxHttpBufferSize: 8 * 1024 * 1024,
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
    private readonly logger = new Logger(RealtimeGateway.name);
    @WebSocketServer() server!: Namespace;
    private readonly subs = new Map<string, Sub>(); // redis key → cursor
    private reader?: Redis;
    private deviceSub?: Redis;
    private running = false;
    private readonly deviceBeats = new Map<string, NodeJS.Timeout>(); // socket id → online refresher

    constructor(
        private readonly redis: RedisService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly access: AccessService,
        private readonly prisma: PrismaService,
    ) { }

    afterInit() {
        this.reader = this.redis.duplicate();
        this.running = true;
        void this.readLoop();
        void this.listenForDeviceCalls();
    }

    onModuleDestroy() {
        this.running = false;
        this.reader?.disconnect();
        this.deviceSub?.disconnect();
        for (const t of this.deviceBeats.values()) clearInterval(t);
    }

    // ---------------- Device tools (§14.3) ----------------

    /** Calls published by the tool layer go to the socket(s) of that device on this instance (other instances have none). */
    private async listenForDeviceCalls() {
        this.deviceSub = this.redis.duplicate();
        const pattern = this.redis.key(RedisKeys.deviceChannelPattern());
        await this.deviceSub.psubscribe(pattern);
        this.deviceSub.on('pmessage', (_p, channel, message) => {
            const deviceId = channel.slice(this.redis.key('device:').length);
            if (!deviceId || deviceId.includes(':')) return;
            try {
                this.server.to(`device:${deviceId}`).emit('device:call', JSON.parse(message));
            } catch { /* ignore malformed */ }
        });
    }

    private async markDevice(deviceId: string, online: boolean) {
        const key = this.redis.key(RedisKeys.deviceOnline(deviceId));
        if (online) await this.redis.client.set(key, '1', 'EX', DEVICE_ONLINE_TTL);
        else await this.redis.client.del(key);
        await this.prisma.device.update({ where: { id: deviceId }, data: { is_online: online, last_seen_at: new Date() } }).catch(() => undefined);
    }

    /**
     * The desktop/mobile app announces itself after connecting: which device tools it supports, its local tool servers'
     * tools and its allowed folders. From then on it is "online" and receives `device:call` events.
     */
    @SubscribeMessage('device:hello')
    async deviceHello(@ConnectedSocket() socket: Socket, @MessageBody() body: { capabilities?: string[]; local_tools?: unknown[]; allowed_folders?: string[]; blocked_apps?: string[] }) {
        const deviceId = socket.data.deviceId as string | undefined;
        if (!deviceId) return { ok: false, error: 'not_a_device' };
        const capabilities = (Array.isArray(body?.capabilities) ? body.capabilities : []).filter((c): c is string => typeof c === 'string').slice(0, 20);
        await this.prisma.device.update({
            where: { id: deviceId },
            data: {
                capabilities,
                ...(Array.isArray(body?.allowed_folders) ? { allowed_folders: body.allowed_folders.filter((f): f is string => typeof f === 'string').slice(0, 50).map((f) => f.slice(0, 500)) } : {}),
                ...(Array.isArray(body?.blocked_apps) ? { blocked_apps: body.blocked_apps.filter((f): f is string => typeof f === 'string').slice(0, 100).map((f) => f.slice(0, 120)) } : {}),
            },
        });
        const toolsKey = this.redis.key(RedisKeys.deviceLocalTools(deviceId));
        if (Array.isArray(body?.local_tools) && body.local_tools.length) await this.redis.client.set(toolsKey, JSON.stringify(body.local_tools.slice(0, 60)).slice(0, 200_000), 'EX', 86400);
        else await this.redis.client.del(toolsKey);
        socket.join(`device:${deviceId}`);
        await this.markDevice(deviceId, true);
        if (!this.deviceBeats.has(socket.id)) this.deviceBeats.set(socket.id, setInterval(() => void this.markDevice(deviceId, true), (DEVICE_ONLINE_TTL * 1000) / 3));
        return { ok: true, device_id: deviceId };
    }

    /** The device's answer to a call; only accepted from the device the call was sent to. */
    @SubscribeMessage('device:result')
    async deviceResult(@ConnectedSocket() socket: Socket, @MessageBody() body: { request_id?: string; ok?: boolean; data?: unknown; error?: string }) {
        const deviceId = socket.data.deviceId as string | undefined;
        const requestId = String(body?.request_id ?? '');
        if (!deviceId || !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) return { ok: false };
        const owner = await this.redis.client.get(this.redis.key(RedisKeys.deviceRequest(requestId)));
        if (owner !== deviceId) return { ok: false, error: 'unknown_request' };
        const reply = JSON.stringify({ ok: !!body.ok, data: body.data ?? null, error: body.error ? String(body.error).slice(0, 1000) : undefined });
        if (reply.length > MAX_DEVICE_REPLY) return { ok: false, error: 'too_large' };
        const key = this.redis.key(RedisKeys.deviceReply(requestId));
        await this.redis.client.multi().lpush(key, reply).expire(key, 120).del(this.redis.key(RedisKeys.deviceRequest(requestId))).exec();
        return { ok: true };
    }

    async handleConnection(socket: Socket) {
        try {
            const token = (socket.handshake.auth?.token as string) || String(socket.handshake.headers.authorization ?? '').replace(/^Bearer /, '');
            const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.config.get('JWT_SECRET') });
            if (payload.typ !== 'access') throw new Error('bad token');
            socket.data.userId = payload.sub;
            // Desktop/mobile apps are devices that can run device tools (§14.3); browsers are not.
            const session = payload.sid ? await this.prisma.session.findUnique({ where: { id: payload.sid }, select: { device: { select: { id: true, platform: true, user_id: true } } } }) : null;
            if (session?.device && session.device.user_id === payload.sub && session.device.platform !== 'WEB') socket.data.deviceId = session.device.id;
            socket.emit('ready', { user_id: payload.sub, device_id: socket.data.deviceId ?? null });
        } catch {
            socket.emit('auth_error', { message: 'Session expired' });
            socket.disconnect(true);
        }
    }

    handleDisconnect(socket: Socket) {
        for (const room of socket.rooms) this.maybeDrop(room, socket.id);
        const beat = this.deviceBeats.get(socket.id);
        if (beat) {
            clearInterval(beat);
            this.deviceBeats.delete(socket.id);
        }
        const deviceId = socket.data.deviceId as string | undefined;
        if (deviceId && !this.server?.adapter.rooms.get(`device:${deviceId}`)?.size) void this.markDevice(deviceId, false);
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
