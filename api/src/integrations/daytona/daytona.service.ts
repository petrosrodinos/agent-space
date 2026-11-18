import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Daytona, Sandbox } from '@daytonaio/sdk';

/**
 * Daytona sandboxes (§9): one persistent sandbox per bot with a desktop (Xvfb + noVNC) for live view and computer use.
 * The API key never leaves the server; clients only receive short-lived signed preview URLs.
 */
@Injectable()
export class DaytonaService {
    private readonly logger = new Logger(DaytonaService.name);
    private client?: Daytona;

    constructor(private readonly config: ConfigService) { }

    get configured() {
        return !!this.config.get<string>('DAYTONA_API_KEY');
    }

    private daytona(): Daytona {
        if (!this.configured) throw new ServiceUnavailableException('Cloud computers are not set up on this server');
        this.client ??= new Daytona({
            apiKey: this.config.get<string>('DAYTONA_API_KEY'),
            apiUrl: this.config.get<string>('DAYTONA_API_URL') || undefined,
            target: this.config.get<string>('DAYTONA_TARGET') || undefined,
        });
        return this.client;
    }

    async create(labels: Record<string, string>, autoStopMinutes: number): Promise<Sandbox> {
        return this.daytona().create({ labels, autoStopInterval: autoStopMinutes, autoArchiveInterval: 60 * 24 * 7, public: false }, { timeout: 180 });
    }

    async get(id: string): Promise<Sandbox | null> {
        try {
            return await this.daytona().get(id);
        } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || /not found/i.test((e as Error).message)) return null;
            throw e;
        }
    }

    /** Starts a stopped/archived sandbox and the desktop processes. Returns the running sandbox. */
    async ensureRunning(sb: Sandbox): Promise<Sandbox> {
        await sb.refreshData();
        const state = String(sb.state ?? '').toLowerCase();
        if (state !== 'started') {
            if (state === 'error' || state === 'build_failed') await sb.recover(120);
            else await sb.start(180);
        }
        try {
            const st = await sb.computerUse.getStatus();
            if (String((st as { status?: string }).status ?? '').toLowerCase() !== 'active') await sb.computerUse.start();
        } catch {
            await sb.computerUse.start();
        }
        return sb;
    }

    async stop(sb: Sandbox) {
        await sb.refreshData();
        if (String(sb.state).toLowerCase() === 'started') await sb.stop(120);
    }

    async remove(id: string) {
        const sb = await this.get(id);
        if (sb) await sb.delete(120);
    }

    /** Signed preview URL of the sandbox's noVNC desktop (port 6080). Only the API uses it — clients go through our proxy. */
    async previewBase(sb: Sandbox, seconds = 3600) {
        const signed = await sb.getSignedPreviewUrl(6080, seconds);
        return signed.url.replace(/\/$/, '');
    }

    async expireLiveView(sb: Sandbox, token: string) {
        await sb.expireSignedPreviewUrl(6080, token).catch((e) => this.logger.warn(`Could not expire preview token: ${(e as Error).message}`));
    }
}
