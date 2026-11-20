import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PDFDocument } from 'pdf-lib';
import { RendererService } from '@/integrations/renderer/renderer.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { ArtifactsService } from './artifacts.service';
import { ExportFormat, ExportFormats } from './dto/artifact.dto';

export interface ExportedFile {
    filename: string;
    mime: string;
    data: Buffer;
}

const MIME: Record<Exclude<ExportFormat, 'html'>, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Download and export (§7.5): PDF and image for any artifact, PowerPoint for slide decks, Word for documents.
 * The live page (with its runtime and saved data) is opened in headless Chrome through a short-lived view token.
 */
@Injectable()
export class ArtifactExportService {
    constructor(
        private readonly artifacts: ArtifactsService,
        private readonly renderer: RendererService,
        private readonly activity: ActivityService,
        private readonly config: ConfigService,
    ) { }

    /** Which formats an artifact type offers, besides the self-contained web page. */
    static formatsFor(type: string): ExportFormat[] {
        return [ExportFormats.HTML, ExportFormats.PDF, ExportFormats.PNG, ...(type === 'PRESENTATION' ? [ExportFormats.PPTX] : []), ...(type === 'DOCUMENT' ? [ExportFormats.DOCX] : [])];
    }

    async export(actor: Actor, id: string, format: Exclude<ExportFormat, 'html'>): Promise<ExportedFile> {
        const { artifact } = await this.artifacts.require(actor, id, 'VIEWER');
        if (!ArtifactExportService.formatsFor(artifact.type).includes(format)) {
            throw new BadRequestException(format === 'pptx' ? 'Only slide decks can be exported as PowerPoint' : format === 'docx' ? 'Only documents can be exported as Word' : 'This format is not available');
        }
        const { url } = await this.artifacts.viewToken(actor, id);
        const local = this.localUrl(url);
        const data = await this.render(local, format, artifact.type, artifact.title);
        await this.activity.log({ organization_id: artifact.organization_id, actor_user_id: actor.user_id, action: 'artifact.exported', target_type: 'artifact', target_id: id, metadata: { format } });
        return { filename: `${artifact.slug}.${format}`, mime: MIME[format], data };
    }

    private async render(url: string, format: Exclude<ExportFormat, 'html'>, type: string, title: string): Promise<Buffer> {
        if (format === 'png') return this.renderer.png(url);
        if (format === 'pdf') {
            if (type !== 'PRESENTATION') return this.renderer.pdf(url);
            return this.imagesToPdf(await this.renderer.slides(url));
        }
        if (format === 'pptx') return this.imagesToPptx(await this.renderer.slides(url), title);
        const { html } = await this.renderer.contentHtml(url);
        const toDocx = (await import('html-to-docx')).default as (html: string, header?: string | null, opts?: Record<string, unknown>) => Promise<Buffer | ArrayBuffer | Blob>;
        const out = await toDocx(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${html}</body></html>`, null, { title, table: { row: { cantSplit: true } }, footer: false, pageNumber: false });
        return Buffer.isBuffer(out) ? out : Buffer.from(out instanceof ArrayBuffer ? out : await (out as Blob).arrayBuffer());
    }

    private async imagesToPdf(images: Buffer[]): Promise<Buffer> {
        const doc = await PDFDocument.create();
        for (const img of images) {
            const png = await doc.embedPng(img);
            const page = doc.addPage([png.width, png.height]);
            page.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
        }
        return Buffer.from(await doc.save());
    }

    private async imagesToPptx(images: Buffer[], title: string): Promise<Buffer> {
        const PptxGenJS = (await import('pptxgenjs')).default;
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';
        pptx.title = title;
        for (const img of images) pptx.addSlide().addImage({ data: `data:image/png;base64,${img.toString('base64')}`, x: 0, y: 0, w: 10, h: 5.625 });
        return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
    }

    /** The renderer runs next to this API, so it opens the page on localhost instead of the public address. */
    private localUrl(publicUrl: string) {
        const u = new URL(publicUrl);
        const port = this.config.get<number>('PORT') ?? 3100;
        return `http://127.0.0.1:${port}${u.pathname}${u.search}`;
    }
}

function escapeHtml(s: string) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
