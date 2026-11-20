import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { reportPage, messagePageCsp } from './artifact-runtime';
import { ArtifactViewService, MAX_UPLOAD_BYTES, RenderResult } from './artifact-view.service';

const MAX_BODY = 64_000;

/** Reads a `text/plain` JSON body: the sandboxed page sends simple requests so no CORS preflight is needed. */
async function readJson(req: Request): Promise<Record<string, unknown>> {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) return req.body as Record<string, unknown>;
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_BODY) throw new Error('Body too large');
        chunks.push(chunk as Buffer);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
        return {};
    }
}

function send(res: Response, r: RenderResult) {
    for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
    res.status(r.status).type('html').send(r.html);
}

/** Opaque-origin pages call these with `Origin: null`; responses carry no credentials, so `*` is safe. */
function openCors(res: Response) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Vary', 'Origin');
}

/**
 * The isolated artifact host (§7.5). Not behind auth: access is decided per request from the sharing settings,
 * a member view token, a public-link unlock token, or a per-page session token.
 */
@ApiExcludeController()
@Controller()
export class ArtifactViewController {
    constructor(private readonly view: ArtifactViewService) { }

    @Get('a/:org/:slug')
    @Throttle({ default: { limit: 120, ttl: 60_000 } })
    async render(@Param('org') org: string, @Param('slug') slug: string, @Query('t') t: string | undefined, @Query('k') k: string | undefined, @Res() res: Response) {
        send(res, await this.view.render(org, slug, { t, k }));
    }

    @Post('a/:org/:slug/unlock')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    async unlock(@Param('org') org: string, @Param('slug') slug: string, @Body() body: { password?: string }, @Res() res: Response) {
        const r = await this.view.unlock(org, slug, String(body?.password ?? ''));
        if (r.redirect) return res.redirect(303, r.redirect);
        send(res, r.result!);
    }

    @Post('ax/:id/records')
    @Throttle({ default: { limit: 30, ttl: 60_000 } })
    async save(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        openCors(res);
        return this.view.saveRecord(id, await readJson(req));
    }

    @Get('ax/:id/records')
    @Throttle({ default: { limit: 120, ttl: 60_000 } })
    list(@Param('id', ParseUUIDPipe) id: string, @Query('session') session: string | undefined, @Query('collection') collection: string | undefined, @Res({ passthrough: true }) res: Response) {
        openCors(res);
        return this.view.listRecords(id, session, collection);
    }

    /** `agentspace.upload(file)`: a multipart form post (a simple request, so no CORS preflight). */
    @Post('ax/:id/files')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
    upload(@Param('id', ParseUUIDPipe) id: string, @Query('session') session: string | undefined, @UploadedFile() file: Express.Multer.File | undefined, @Res({ passthrough: true }) res: Response) {
        openCors(res);
        return this.view.uploadFile(id, session, file);
    }

    @Post('ax/:id/live')
    @Throttle({ default: { limit: 120, ttl: 60_000 } })
    async live(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        openCors(res);
        return this.view.live(id, await readJson(req));
    }

    @Post('ax/:id/ai')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    async ai(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        openCors(res);
        return this.view.ai(id, await readJson(req));
    }

    @Get('ax/:id/report')
    @Throttle({ default: { limit: 30, ttl: 60_000 } })
    async reportForm(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res() res: Response) {
        const title = await this.view.titleOf(id);
        res.setHeader('Content-Security-Policy', messagePageCsp([]));
        res.setHeader('X-Robots-Tag', 'noindex');
        res.type('html').send(reportPage(title, `${req.originalUrl.split('?')[0]}`));
    }

    @Post('ax/:id/report')
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    async report(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res() res: Response) {
        const body = await readJson(req);
        const a = await this.view.report(id, String(body.reason ?? ''), body.email ? String(body.email) : undefined);
        if (req.is('application/x-www-form-urlencoded')) {
            res.setHeader('Content-Security-Policy', messagePageCsp([]));
            return res.type('html').send(reportPage(a.title, '', true));
        }
        openCors(res);
        res.json({ ok: true });
    }
}
