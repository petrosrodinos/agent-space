import { decodeEntities, htmlToText } from './html-to-text.utils';

/** Text-like types the bot can read directly. */
export const TEXT_MIME = /^(text\/|application\/(json|xml|csv|x-yaml|yaml|javascript|typescript|sql|x-sh|markdown))/;

/** How a file is turned into text. */
export const FileFormats = {
    PDF: 'PDF',
    DOCX: 'DOCX',
    SPREADSHEET: 'SPREADSHEET',
    PRESENTATION: 'PRESENTATION',
    HTML: 'HTML',
    TEXT: 'TEXT',
    /** Needs a vision model (see DocumentVisionService). */
    IMAGE: 'IMAGE',
    UNSUPPORTED: 'UNSUPPORTED',
} as const;
export type FileFormat = (typeof FileFormats)[keyof typeof FileFormats];

/** Image types vision models accept. */
export const VISION_IMAGE_MIME = /^image\/(png|jpe?g|webp|gif)$/;

const MAX_CHARS = 400_000;

const FORMAT_RULES: { format: FileFormat; mime: RegExp; ext: RegExp }[] = [
    { format: FileFormats.PDF, mime: /^application\/pdf$/, ext: /\.pdf$/i },
    { format: FileFormats.DOCX, mime: /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/, ext: /\.docx$/i },
    {
        format: FileFormats.SPREADSHEET,
        mime: /^application\/(vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel|vnd\.oasis\.opendocument\.spreadsheet)$/,
        ext: /\.(xlsx|xlsm|xls|ods)$/i,
    },
    { format: FileFormats.PRESENTATION, mime: /^application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation$/, ext: /\.pptx$/i },
    { format: FileFormats.HTML, mime: /^(text\/html|application\/xhtml\+xml)$/, ext: /\.(html?|xhtml)$/i },
    { format: FileFormats.IMAGE, mime: VISION_IMAGE_MIME, ext: /\.(png|jpe?g|webp|gif)$/i },
    { format: FileFormats.TEXT, mime: TEXT_MIME, ext: /\.(md|markdown|txt|csv|tsv|json|ya?ml|xml|log|sql)$/i },
];

/** Picks the reader for a file from its type, falling back to the extension. */
export function fileFormat(mimetype: string, filename = ''): FileFormat {
    return FORMAT_RULES.find((r) => r.mime.test(mimetype))?.format ?? FORMAT_RULES.find((r) => r.ext.test(filename))?.format ?? FileFormats.UNSUPPORTED;
}

/** True when extractText can turn this type into text without a vision model. */
export const isExtractable = (mimetype: string, filename = '') => {
    const f = fileFormat(mimetype, filename);
    return f !== FileFormats.IMAGE && f !== FileFormats.UNSUPPORTED;
};

/**
 * Extracts plain text from text, HTML, PDF, Word, Excel/ODS and PowerPoint files (knowledge, skill files, chat attachments).
 * Returns null for types that can't be read as text (images, archives, binaries) or when the file is unreadable.
 * Scanned PDFs come back empty; knowledge indexing runs those pages through a vision model.
 */
export async function extractText(data: Buffer, mimetype: string, filename = ''): Promise<string | null> {
    try {
        switch (fileFormat(mimetype, filename)) {
            case FileFormats.PDF:
                return clean((await extractPdfPages(data)).join('\n\n'));
            case FileFormats.DOCX: {
                const mammoth = await import('mammoth');
                const { value } = await mammoth.extractRawText({ buffer: data });
                return clean(value);
            }
            case FileFormats.SPREADSHEET:
                return clean(await extractSpreadsheet(data));
            case FileFormats.PRESENTATION:
                return clean(await extractPresentation(data));
            case FileFormats.HTML:
                return clean(htmlToText(data.toString('utf8')));
            case FileFormats.TEXT:
                return clean(data.toString('utf8'));
            default:
                return null;
        }
    } catch {
        return null;
    }
}

/** The text of each PDF page (empty strings for scanned pages). */
export async function extractPdfPages(data: Buffer): Promise<string[]> {
    const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await pdfText(pdf, { mergePages: false });
    return (Array.isArray(text) ? text : [text]).map((t) => t.replace(/\r/g, '').trim());
}

/** Every sheet as CSV under a "## Sheet: name" heading (xlsx, xlsm, xls, ods). */
async function extractSpreadsheet(data: Buffer): Promise<string> {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(data, { type: 'buffer', cellDates: true, dense: true });
    return wb.SheetNames.map((name) => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false, strip: true, dateNF: 'yyyy-mm-dd' });
        return csv.trim() ? `## Sheet: ${name}\n${csv.trim()}` : '';
    })
        .filter(Boolean)
        .join('\n\n');
}

/** Slide text in order, each under a "## Slide n" heading, followed by its speaker notes. */
async function extractPresentation(data: Buffer): Promise<string> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(data);
    const slideNo = (path: string) => Number(/slide(\d+)\.xml$/.exec(path)?.[1] ?? 0);
    const slides = Object.keys(zip.files)
        .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
        .sort((a, b) => slideNo(a) - slideNo(b));
    const out: string[] = [];
    for (const path of slides) {
        const n = slideNo(path);
        const text = drawingText(await zip.file(path)!.async('string'));
        const rels = await zip.file(`ppt/slides/_rels/slide${n}.xml.rels`)?.async('string');
        const notesTarget = rels && /Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/.exec(rels)?.[1];
        const notesXml = notesTarget ? await zip.file(`ppt/notesSlides/${notesTarget}`)?.async('string') : undefined;
        // Notes slides repeat the slide number as a field; drop bare numbers.
        const notes = notesXml ? drawingText(notesXml).replace(/^\d+$/gm, '').trim() : '';
        if (text || notes) out.push(`## Slide ${n}${text ? `\n${text}` : ''}${notes ? `\n\nSpeaker notes:\n${notes}` : ''}`);
    }
    return out.join('\n\n');
}

/** DrawingML text: one line per <a:p> paragraph, runs joined. */
const drawingText = (xml: string) =>
    (xml.match(/<a:p>[\s\S]*?<\/a:p>|<a:p\s[\s\S]*?<\/a:p>/g) ?? [])
        .map((p) => decodeEntities((p.match(/<a:t>([\s\S]*?)<\/a:t>|<a:t\s[^>]*>([\s\S]*?)<\/a:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('')).trim())
        .filter(Boolean)
        .join('\n');

export const clean = (s: string) => s.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);

/**
 * Splits text into ~`size`-character chunks for embedding: paragraphs are kept whole where possible, long paragraphs are
 * cut on sentence or word boundaries, and each chunk repeats the tail of the previous one (`overlap`) so a passage that
 * straddles a boundary is still found.
 */
export function chunkText(text: string, size = 1500, overlap = 200): string[] {
    const pieces: string[] = [];
    for (const para of text.split(/\n{2,}/)) {
        const p = para.trim();
        if (!p) continue;
        if (p.length <= size) {
            pieces.push(p);
            continue;
        }
        let rest = p;
        while (rest.length > size) {
            const window = rest.slice(0, size);
            const cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('\n'), window.lastIndexOf('? '), window.lastIndexOf('! '));
            const at = cut > size * 0.5 ? cut + 1 : window.lastIndexOf(' ') > size * 0.5 ? window.lastIndexOf(' ') : size;
            pieces.push(rest.slice(0, at).trim());
            rest = rest.slice(at).trim();
        }
        if (rest) pieces.push(rest);
    }
    const chunks: string[] = [];
    let cur = '';
    for (const piece of pieces) {
        if (cur && cur.length + piece.length + 2 > size) {
            chunks.push(cur);
            const tail = cur.slice(-overlap);
            const start = tail.search(/\s/);
            cur = start >= 0 ? tail.slice(start + 1) : '';
        }
        cur = cur ? `${cur}\n\n${piece}` : piece;
    }
    if (cur.trim()) chunks.push(cur);
    return chunks;
}
