const ENTITIES: Record<string, string> = {
    nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', euro: '€', pound: '£', yen: '¥', cent: '¢',
    copy: '©', reg: '®', trade: '™', deg: '°', times: '×', divide: '÷', plusmn: '±', para: '¶', sect: '§', shy: '',
};

/** Decodes the common named entities plus numeric (&#123; / &#x1F;) ones. */
export function decodeEntities(s: string): string {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
        if (e[0] === '#') {
            const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
        }
        return ENTITIES[e.toLowerCase()] ?? m;
    });
}

/** The <title> of an HTML document, if any. */
export const htmlTitle = (html: string): string | null => {
    const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
    return t ? decodeEntities(t) : null;
};

/**
 * Turns an HTML document into readable text: drops scripts, styles and page chrome (nav, header, footer, aside),
 * keeps links inline as "text (href)", and keeps paragraph and list structure.
 */
export function htmlToText(html: string): string {
    return decodeEntities(
        html
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<(script|style|noscript|svg|iframe|template|head)[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => {
                const text = inner.replace(/<[^>]+>/g, '').trim();
                return /^(#|javascript:)/i.test(href) || !text ? text : `${text} (${href})`;
            })
            .replace(/<(br|hr)\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|h[1-6]|tr|table|section|article|blockquote|pre|dt|dd)>/gi, '\n')
            .replace(/<h([1-6])[^>]*>/gi, (_m, n: string) => `\n${'#'.repeat(Number(n))} `)
            .replace(/<li[^>]*>/gi, '• ')
            .replace(/<\/t[dh]>/gi, ' | ')
            .replace(/<[^>]+>/g, ' '),
    )
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
