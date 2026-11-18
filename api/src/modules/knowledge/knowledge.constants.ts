/** Job payload of `knowledge` / `index`. */
export interface KnowledgeIndexJob {
    item_id: string;
    /** true: (re-)read the source (file or web page) first; false: only re-embed the current text. */
    extract: boolean;
}

/** Retries cover provider hiccups (OpenAI rate limits, timeouts); content problems fail at once. */
export const KNOWLEDGE_JOB_OPTIONS = { attempts: 3, backoff: { type: 'exponential', delay: 15_000 } } as const;

/** Passage size for embeddings (characters) and the overlap carried into the next passage. */
export const CHUNK_SIZE = 1500;
export const CHUNK_OVERLAP = 200;

/** Cosine similarity below which a passage is not returned (text-embedding-3-small: unrelated text scores ~0.1–0.25, related 0.4+). */
export const MIN_SEARCH_SCORE = 0.3;
export const SEARCH_LIMIT = 6;

/** A PDF page with fewer readable characters than this is treated as scanned and read with the vision model. */
export const SCANNED_PAGE_MAX_CHARS = 30;
export const MAX_OCR_PAGES = 200;
export const OCR_CONCURRENCY = 4;
/** Vision input limit (OpenAI: 20 MB per image). */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Characters of a web page kept as knowledge. */
export const LINK_MAX_CHARS = 200_000;

/** Messages shown to people when indexing fails (status_error). */
export const KnowledgeErrors = {
    NO_TEXT_FILE: "No text could be found in this file. Edit the item to type the text the bot should use.",
    NO_TEXT_PAGE: "No text could be found on this page. Edit the item to paste the text the bot should use.",
    NO_TEXT: 'There is no text to search. Edit the item to add some.',
    UNSUPPORTED: "This file type can't be read. Supported: PDF, Word, Excel, PowerPoint, text, Markdown, CSV, JSON, HTML and images.",
    IMAGE_TOO_LARGE: 'This image is larger than 20 MB. Upload a smaller version.',
    FILE_MISSING: 'The file is no longer available. Upload it again.',
    PAGE_FETCH: (reason: string) => `The page could not be read: ${reason}`,
    GENERIC: 'Indexing failed. Try again in a few minutes.',
} as const;

/** A content problem people must fix (not retried). */
export class KnowledgeIndexError extends Error { }
