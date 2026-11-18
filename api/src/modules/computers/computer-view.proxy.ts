import { All, Controller, Injectable, Logger, NotFoundException, OnApplicationBootstrap, Param, Req, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import WebSocket = require('ws');
import { RedisService } from '@/core/databases/redis/redis.service';
import { randomToken } from '@/shared/utils/security/crypto.utils';

const PREFIX = '/api/computer-view/';
const TTL_SECONDS = 1800;
/** Daytona shows an interstitial to browsers unless this header is sent; iframes can't send it, so we proxy (§9.2). */
const SKIP_WARNING = { 'X-Daytona-Skip-Preview-Warning': 'true' };
/** RFB client→server input messages: KeyEvent, PointerEvent, ClientCutText. Dropped for watch-only viewers. */
const RFB_INPUT = new Set([4, 5, 6]);

interface ViewGrant {
    base: string;
    view_only: boolean;
}

/** Short-lived live-view grants: an unguessable token maps to the sandbox's signed preview URL (never sent to the client). */
@Injectable()
export class ComputerViewProxy implements OnApplicationBootstrap {
    private readonly logger = new Logger(ComputerViewProxy.name);
    private readonly wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

    constructor(
        private readonly redis: RedisService,
        private readonly http: HttpAdapterHost,
    ) { }

    private key(token: string) {
        return this.redis.key(`computer-view:${token}`);
    }

    async grant(base: string, viewOnly: boolean, apiUrl: string) {
        const token = randomToken(24);
        await this.redis.client.set(this.key(token), JSON.stringify({ base: base.replace(/\/$/, ''), view_only: viewOnly } satisfies ViewGrant), 'EX', TTL_SECONDS);
        const root = apiUrl.replace(/\/$/, '');
        const path = `${new URL(root).pathname.replace(/^\//, '').replace(/\/$/, '')}/computer-view/${token}/websockify`;
        const qs = new URLSearchParams({ autoconnect: 'true', resize: 'scale', reconnect: 'true', show_dot: 'true', view_only: viewOnly ? 'true' : 'false', path });
        return { url: `${root}/computer-view/${token}/vnc.html?${qs}`, token, expires_at: new Date(Date.now() + TTL_SECONDS * 1000).toISOString() };
    }

    async revoke(token: string) {
        await this.redis.client.del(this.key(token));
    }

    async lookup(token: string): Promise<ViewGrant | null> {
        if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
        const v = await this.redis.client.get(this.key(token));
        return v ? (JSON.parse(v) as ViewGrant) : null;
    }

    /** WebSocket (VNC) bridge on the same HTTP server, only for /api/computer-view/<token>/websockify. */
    onApplicationBootstrap() {
        const server = this.http.httpAdapter?.getHttpServer?.();
        if (!server) return;
        server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
            const url = req.url ?? '';
            if (!url.startsWith(PREFIX)) return;
            const token = url.slice(PREFIX.length).split('/')[0];
            void this.lookup(token).then((grant) => {
                if (!grant) {
                    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                    socket.destroy();
                    return;
                }
                const protocols = String(req.headers['sec-websocket-protocol'] ?? '').split(',').map((p) => p.trim()).filter(Boolean);
                const upstream = new WebSocket(`${grant.base.replace(/^http/, 'ws')}/websockify`, protocols.length ? protocols : undefined, { headers: SKIP_WARNING });
                upstream.binaryType = 'nodebuffer';
                const pending: Buffer[] = [];
                this.wss.handleUpgrade(req, socket, head, (client) => {
                    client.on('message', (data: Buffer, isBinary) => {
                        if (grant.view_only && isBinary && data.length && RFB_INPUT.has(data[0])) return;
                        if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
                        else pending.push(data);
                    });
                    upstream.on('open', () => {
                        for (const d of pending.splice(0)) upstream.send(d, { binary: true });
                    });
                    upstream.on('message', (data: Buffer, isBinary) => client.readyState === WebSocket.OPEN && client.send(data, { binary: isBinary }));
                    const close = () => {
                        if (client.readyState === WebSocket.OPEN) client.close();
                        if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
                    };
                    client.on('close', close);
                    upstream.on('close', close);
                    upstream.on('error', (e) => {
                        this.logger.warn(`Live view upstream error: ${e.message}`);
                        close();
                    });
                });
            });
        });
    }
}

/** HTTP side of the live view: noVNC page, scripts and images, fetched from the sandbox with the skip-warning header. */
@ApiExcludeController()
@Controller('computer-view')
export class ComputerViewController {
    constructor(private readonly proxy: ComputerViewProxy) { }

    @All(':token/*path')
    async asset(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
        const grant = await this.proxy.lookup(token);
        if (!grant) throw new NotFoundException('This live view link has expired');
        const rest = req.originalUrl.slice(req.originalUrl.indexOf(token) + token.length);
        const upstream = await fetch(`${grant.base}${rest}`, { headers: { ...SKIP_WARNING, Accept: String(req.headers.accept ?? '*/*') } });
        res.status(upstream.status);
        for (const h of ['content-type', 'cache-control', 'etag', 'last-modified']) {
            const v = upstream.headers.get(h);
            if (v) res.setHeader(h, v);
        }
        // Framed only by the app (the iframe); no referrer leaks of the token.
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.removeHeader('X-Frame-Options');
        res.send(Buffer.from(await upstream.arrayBuffer()));
    }
}
