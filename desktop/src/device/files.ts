/**
 * Local files tool (§14.3): list, search, read, write, move/rename and delete (to the OS trash), only inside allowed
 * folders. Pure Node: the filesystem and the trash are injected, so this runs without Electron in scripts/test-device.mjs.
 * In the app, index.ts passes `original-fs` (Electron's fs treats .asar files as folders) and `shell.trashItem`.
 */
import type { Stats } from 'fs';
import { isInside, pathApi, resolveAllowed, samePath, type Fs } from './paths';
import { LocalFileActions, type LocalFileEntry, type LocalFilesRequest, type LocalFilesResult } from './types';

export const FILE_LIMITS = {
    LIST_MAX: 500,
    SEARCH_MAX: 200,
    SEARCH_DEPTH: 6,
    SEARCH_MAX_DIRS: 20_000,
    READ_MAX_BYTES: 5 * 1024 * 1024,
    TEXT_MAX_BYTES: 200 * 1024,
    WRITE_MAX_BYTES: 10 * 1024 * 1024,
} as const;

const SEARCH_SKIP = new Set(['node_modules', '.git']);

export const MIME: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
    txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', html: 'text/html', htm: 'text/html', css: 'text/css',
    xml: 'application/xml', yaml: 'application/x-yaml', yml: 'application/x-yaml', js: 'text/javascript', mjs: 'text/javascript', ts: 'text/plain', tsx: 'text/plain', jsx: 'text/plain',
    py: 'text/x-python', rb: 'text/plain', go: 'text/plain', rs: 'text/plain', java: 'text/plain', c: 'text/plain', h: 'text/plain', cpp: 'text/plain', cs: 'text/plain', sh: 'text/plain',
    ps1: 'text/plain', bat: 'text/plain', sql: 'text/plain', log: 'text/plain', ini: 'text/plain', toml: 'text/plain', env: 'text/plain', rtf: 'application/rtf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip: 'application/zip', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
};

const TEXT_MIMES = new Set(['application/json', 'application/xml', 'application/x-yaml', 'image/svg+xml', 'application/rtf']);

export function mimeFor(file: string): string {
    const ext = file.toLowerCase().split('.').pop() ?? '';
    return file.includes('.') ? (MIME[ext] ?? 'application/octet-stream') : 'application/octet-stream';
}

const isTextMime = (m: string) => m.startsWith('text/') || TEXT_MIMES.has(m);

/** Unknown types: treat as text when the first 8 KB has no NUL byte and decodes as UTF-8. */
function looksLikeText(buf: Buffer): boolean {
    const head = buf.subarray(0, 8192);
    if (head.includes(0)) return false;
    try {
        new TextDecoder('utf-8', { fatal: true }).decode(head.length === buf.length ? head : head.subarray(0, Math.max(0, head.length - 4)));
        return true;
    } catch {
        return false;
    }
}

export interface FilesDeps {
    fs: Fs;
    /** Moves a file to the OS trash (shell.trashItem in the app). */
    trash(path: string): Promise<void>;
    platform?: NodeJS.Platform;
}

function entry(p: string, s: Stats, platform: NodeJS.Platform): LocalFileEntry {
    return { path: p, name: pathApi(platform).basename(p) || p, kind: s.isDirectory() ? 'folder' : 'file', size: s.isDirectory() ? 0 : s.size, modified: s.mtime.toISOString() };
}

/** Allowed folders that still exist, by their real paths. */
export async function liveRoots(folders: string[], fs: Fs): Promise<string[]> {
    const out: string[] = [];
    for (const f of folders) {
        try {
            if ((await fs.stat(f)).isDirectory()) out.push(await fs.realpath(f));
        } catch {
            /* folder removed or unplugged: skip */
        }
    }
    return out;
}

export async function runFiles(req: LocalFilesRequest, folders: string[], deps: FilesDeps): Promise<LocalFilesResult> {
    const { fs } = deps;
    const platform = deps.platform ?? process.platform;
    const p = pathApi(platform);
    const roots = await liveRoots(folders, fs);
    const isRoot = (x: string) => roots.some((r) => samePath(r, x, platform));
    const resolve = (x: string | undefined, mustExist: boolean) => resolveAllowed(x ?? '', roots, fs, { mustExist, platform });

    switch (req?.action) {
        case LocalFileActions.LIST: {
            if (!req.path?.trim()) {
                const entries: LocalFileEntry[] = [];
                for (const r of roots) entries.push(entry(r, await fs.stat(r), platform));
                return { action: 'list', entries, truncated: false };
            }
            const dir = await resolve(req.path, true);
            const st = await fs.stat(dir.path);
            if (!st.isDirectory()) throw new Error(`Not a folder: ${req.path}`);
            const names = await fs.readdir(dir.path);
            names.sort((a, b) => a.localeCompare(b));
            const entries: LocalFileEntry[] = [];
            for (const n of names.slice(0, FILE_LIMITS.LIST_MAX)) {
                const full = p.join(dir.path, n);
                try {
                    entries.push(entry(full, await fs.stat(full), platform));
                } catch {
                    /* broken link or no access: skip */
                }
            }
            return { action: 'list', entries, truncated: names.length > FILE_LIMITS.LIST_MAX };
        }

        case LocalFileActions.SEARCH: {
            const q = String(req.query ?? '').trim().toLowerCase();
            if (!q) throw new Error('Search needs a query.');
            const starts = req.path?.trim() ? [(await resolve(req.path, true)).path] : roots;
            const entries: LocalFileEntry[] = [];
            let truncated = false;
            let dirsSeen = 0;
            const queue: { dir: string; depth: number }[] = starts.map((dir) => ({ dir, depth: 0 }));
            while (queue.length && !truncated) {
                const { dir, depth } = queue.shift()!;
                if (++dirsSeen > FILE_LIMITS.SEARCH_MAX_DIRS) {
                    truncated = true;
                    break;
                }
                let items;
                try {
                    items = await fs.readdir(dir, { withFileTypes: true });
                } catch {
                    continue;
                }
                for (const it of items) {
                    const full = p.join(dir, it.name);
                    // Dirent.isDirectory() is false for symlinks, so links are never followed out of the folder.
                    if (it.isDirectory() && !SEARCH_SKIP.has(it.name) && depth < FILE_LIMITS.SEARCH_DEPTH) queue.push({ dir: full, depth: depth + 1 });
                    if (!it.name.toLowerCase().includes(q) || SEARCH_SKIP.has(it.name)) continue;
                    if (!it.isDirectory() && !it.isFile()) continue;
                    if (entries.length >= FILE_LIMITS.SEARCH_MAX) {
                        truncated = true;
                        break;
                    }
                    try {
                        entries.push(entry(full, await fs.stat(full), platform));
                    } catch {
                        /* vanished */
                    }
                }
            }
            return { action: 'search', entries, truncated };
        }

        case LocalFileActions.READ: {
            const file = await resolve(req.path, true);
            const st = await fs.stat(file.path);
            if (st.isDirectory()) throw new Error(`That's a folder, not a file: ${req.path}. Use list instead.`);
            if (st.size > FILE_LIMITS.READ_MAX_BYTES) throw new Error(`File is too large to read (${Math.round(st.size / 1024 / 1024)} MB; the limit is 5 MB).`);
            const buf = await fs.readFile(file.path);
            let mimetype = mimeFor(file.path);
            const text = isTextMime(mimetype) || (mimetype === 'application/octet-stream' && looksLikeText(buf));
            if (text && mimetype === 'application/octet-stream') mimetype = 'text/plain';
            if (!text) return { action: 'read', path: file.path, size: st.size, mimetype, encoding: 'base64', content: buf.toString('base64'), truncated: false };
            const truncated = buf.length > FILE_LIMITS.TEXT_MAX_BYTES;
            return { action: 'read', path: file.path, size: st.size, mimetype, encoding: 'utf8', content: buf.subarray(0, FILE_LIMITS.TEXT_MAX_BYTES).toString('utf8'), truncated };
        }

        case LocalFileActions.WRITE: {
            if (typeof req.content !== 'string') throw new Error('Write needs content.');
            const encoding = req.encoding === 'base64' ? 'base64' : 'utf8';
            const data = Buffer.from(req.content, encoding);
            if (data.length > FILE_LIMITS.WRITE_MAX_BYTES) throw new Error('Content is too large to write (the limit is 10 MB).');
            const target = await resolve(req.path, false);
            if (isRoot(target.path)) throw new Error('Cannot write over an allowed folder.');
            if (target.exists) {
                if ((await fs.stat(target.path)).isDirectory()) throw new Error(`A folder already exists at ${target.path}.`);
                if (!req.overwrite) throw new Error(`A file already exists at ${target.path}. Replacing it needs the user's approval; then write again with overwrite.`);
            }
            await fs.mkdir(p.dirname(target.path), { recursive: true });
            // Re-check after creating folders: the parent must still resolve inside the allowed folder.
            const again = await resolve(target.path, false);
            if (!samePath(again.path, target.path, platform)) throw new Error('Write target moved outside the allowed folders.');
            await fs.writeFile(target.path, data, { flag: req.overwrite ? 'w' : 'wx' });
            return { action: 'write', ok: true, path: target.path };
        }

        case LocalFileActions.MOVE: {
            const from = await resolve(req.path, true);
            if (isRoot(from.path)) throw new Error('Cannot move an allowed folder itself. Remove it in Settings → Devices instead.');
            const rawTo = String(req.to ?? '').trim();
            if (!rawTo) throw new Error('Move needs a destination ("to").');
            // A bare name renames in place.
            const toInput = !/[\\/]/.test(rawTo) && !p.isAbsolute(rawTo) ? p.join(p.dirname(from.path), rawTo) : rawTo;
            const to = await resolve(toInput, false);
            const caseOnlyRename = platform === 'win32' && samePath(from.path, to.path, platform) && from.path !== to.path;
            if (samePath(from.path, to.path, platform) && !caseOnlyRename) throw new Error('Source and destination are the same.');
            if (to.exists && !caseOnlyRename) throw new Error(`Something already exists at ${to.path}. Choose another name.`);
            if (isRoot(to.path)) throw new Error('Cannot move over an allowed folder.');
            if (!caseOnlyRename && isInside(to.path, from.path, platform)) throw new Error('Cannot move a folder into itself.');
            await fs.mkdir(p.dirname(to.path), { recursive: true });
            try {
                await fs.rename(from.path, to.path);
            } catch (e) {
                if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
                await fs.cp(from.path, to.path, { recursive: true, errorOnExist: true, force: false });
                await fs.rm(from.path, { recursive: true });
            }
            return { action: 'move', ok: true, path: to.path };
        }

        case LocalFileActions.DELETE: {
            const file = await resolve(req.path, true);
            if (isRoot(file.path)) throw new Error('Cannot delete an allowed folder.');
            if (!(await fs.stat(file.path)).isFile()) throw new Error('Only files can be deleted, not folders.');
            await deps.trash(file.path);
            return { action: 'delete', ok: true, path: file.path };
        }

        default:
            throw new Error(`Unknown local files action: ${String(req?.action)}`);
    }
}
