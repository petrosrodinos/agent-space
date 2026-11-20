import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Browser, Page } from 'puppeteer';

const VIEWPORT = { width: 1280, height: 720 };
const IDLE_CLOSE_MS = 5 * 60_000;
const LOAD_TIMEOUT_MS = 45_000;
const SETTLE_MS = 800;
const MAX_SLIDES = 80;
const MAX_CONCURRENT = 2;

/**
 * Headless Chrome for turning a live artifact page into files (§7.5 Download and export). One shared browser,
 * launched on first use and closed after a few idle minutes; at most two pages render at once.
 */
@Injectable()
export class RendererService implements OnModuleDestroy {
    private readonly logger = new Logger(RendererService.name);
    private browser: Promise<Browser> | null = null;
    private idle: NodeJS.Timeout | null = null;
    private active = 0;
    private readonly waiting: (() => void)[] = [];

    constructor(private readonly config: ConfigService) { }

    async onModuleDestroy() {
        await this.close();
    }

    private async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = (async () => {
                const puppeteer = (await import('puppeteer')).default;
                const executablePath = this.config.get<string>('CHROME_PATH') || undefined;
                return puppeteer.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] });
            })().catch((e) => {
                this.browser = null;
                this.logger.error(`Chrome failed to start: ${(e as Error).message}`);
                throw new ServiceUnavailableException('Export is unavailable right now (the renderer could not start).');
            });
        }
        return this.browser;
    }

    private async close() {
        const b = this.browser;
        this.browser = null;
        if (b) await (await b).close().catch(() => undefined);
    }

    /** Opens `url` in a fresh page, waits for it to settle, runs `fn`, and always closes the page. */
    async withPage<T>(url: string, fn: (page: Page) => Promise<T>): Promise<T> {
        if (this.active >= MAX_CONCURRENT) await new Promise<void>((r) => this.waiting.push(r));
        this.active++;
        if (this.idle) clearTimeout(this.idle);
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        try {
            await page.setViewport(VIEWPORT);
            await page.goto(url, { waitUntil: 'networkidle0', timeout: LOAD_TIMEOUT_MS }).catch(async (e) => {
                // Pages that keep a connection open never go idle; what has loaded is usually enough.
                if (!/timeout/i.test((e as Error).message)) throw e;
            });
            await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
            await new Promise((r) => setTimeout(r, SETTLE_MS));
            return await fn(page);
        } finally {
            await page.close().catch(() => undefined);
            this.active--;
            this.waiting.shift()?.();
            if (!this.active) this.idle = setTimeout(() => void this.close(), IDLE_CLOSE_MS);
        }
    }

    async pdf(url: string, opts: { landscape?: boolean } = {}): Promise<Buffer> {
        return this.withPage(url, async (page) => {
            await page.emulateMediaType('print');
            return Buffer.from(await page.pdf({ format: 'A4', landscape: !!opts.landscape, printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } }));
        });
    }

    async png(url: string): Promise<Buffer> {
        return this.withPage(url, async (page) => Buffer.from(await page.screenshot({ type: 'png', fullPage: true })));
    }

    /**
     * Slide images for a deck: screenshot, press the right arrow, repeat until the picture stops changing.
     * Works for any deck with keyboard navigation (the artifact build guide asks for it).
     */
    async slides(url: string): Promise<Buffer[]> {
        return this.withPage(url, async (page) => {
            await page.click('body').catch(() => undefined);
            const shots: Buffer[] = [];
            const seen = new Set<string>();
            for (let i = 0; i < MAX_SLIDES; i++) {
                const shot = Buffer.from(await page.screenshot({ type: 'png' }));
                const hash = createHash('sha1').update(shot).digest('hex');
                if (seen.has(hash)) break;
                seen.add(hash);
                shots.push(shot);
                await page.keyboard.press('ArrowRight');
                await new Promise((r) => setTimeout(r, 450));
            }
            return shots;
        });
    }

    /** The rendered page body as simple HTML (scripts, styles and hidden elements removed), for Word export. */
    async contentHtml(url: string): Promise<{ title: string; html: string }> {
        return this.withPage(url, (page) =>
            page.evaluate(() => {
                const clone = document.body.cloneNode(true) as HTMLElement;
                const live = Array.from(document.body.querySelectorAll('*')) as HTMLElement[];
                const copies = Array.from(clone.querySelectorAll('*')) as HTMLElement[];
                live.forEach((el, i) => {
                    const cs = getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') copies[i]?.setAttribute('data-drop', '1');
                });
                clone.querySelectorAll('[data-drop], script, style, noscript, iframe, svg, canvas, button, input, select, textarea, nav').forEach((n) => n.remove());
                clone.querySelectorAll('*').forEach((n) => {
                    for (const a of Array.from(n.attributes)) if (!['href', 'src', 'colspan', 'rowspan', 'alt'].includes(a.name)) n.removeAttribute(a.name);
                });
                return { title: document.title, html: clone.innerHTML };
            }),
        );
    }
}
