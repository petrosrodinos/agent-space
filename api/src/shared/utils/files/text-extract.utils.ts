/** Text-like types the bot can read directly. */
export const TEXT_MIME = /^(text\/|application\/(json|xml|csv|x-yaml|yaml|javascript|typescript|sql|x-sh|markdown))/;
const PDF = /^application\/pdf$/;
const DOCX = /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/;

const MAX_CHARS = 400_000;

/** True when extractText can turn this type into text. */
export const isExtractable = (mimetype: string, filename = '') =>
    TEXT_MIME.test(mimetype) || PDF.test(mimetype) || DOCX.test(mimetype) || /\.(md|txt|csv|json|ya?ml|xml|html?|pdf|docx)$/i.test(filename);

/**
 * Extracts plain text from text files, PDFs and Word documents (knowledge, skill files, chat attachments).
 * Returns null for types that can't be read as text (images, archives, binaries).
 */
export async function extractText(data: Buffer, mimetype: string, filename = ''): Promise<string | null> {
    try {
        if (PDF.test(mimetype) || /\.pdf$/i.test(filename)) {
            const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
            const pdf = await getDocumentProxy(new Uint8Array(data));
            const { text } = await pdfText(pdf, { mergePages: true });
            return clean(Array.isArray(text) ? text.join('\n\n') : text);
        }
        if (DOCX.test(mimetype) || /\.docx$/i.test(filename)) {
            const mammoth = await import('mammoth');
            const { value } = await mammoth.extractRawText({ buffer: data });
            return clean(value);
        }
        if (TEXT_MIME.test(mimetype) || /\.(md|txt|csv|json|ya?ml|xml|html?)$/i.test(filename)) {
            return clean(data.toString('utf8'));
        }
    } catch {
        return null;
    }
    return null;
}

const clean = (s: string) => s.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);

/** Splits text into ~1,500-character chunks on paragraph boundaries, for keyword search. */
export function chunkText(text: string, size = 1500): string[] {
    const paras = text.split(/\n\n+/);
    const chunks: string[] = [];
    let cur = '';
    for (const p of paras) {
        if (cur && cur.length + p.length > size) {
            chunks.push(cur);
            cur = '';
        }
        cur = cur ? `${cur}\n\n${p}` : p;
        while (cur.length > size * 2) {
            chunks.push(cur.slice(0, size));
            cur = cur.slice(size);
        }
    }
    if (cur.trim()) chunks.push(cur);
    return chunks;
}

/** Simple keyword relevance: term frequency of query words (≥3 letters, Greek or Latin), longer terms weigh more. */
export function scoreChunk(chunk: string, query: string): number {
    const terms = query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    if (!terms.length) return 0;
    const hay = chunk.toLowerCase();
    let score = 0;
    for (const t of new Set(terms)) {
        let i = hay.indexOf(t);
        let n = 0;
        while (i !== -1 && n < 20) {
            n++;
            i = hay.indexOf(t, i + t.length);
        }
        if (n) score += (1 + Math.log(n)) * Math.min(t.length, 10);
    }
    return score;
}
