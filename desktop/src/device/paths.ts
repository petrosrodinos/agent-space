/**
 * Allowed-folder path checks (§14.3 Local files). Pure Node: no Electron imports, so scripts/test-device.mjs can load it.
 *
 * Every path the page sends is resolved to its real location (symlinks and junctions followed) and must sit inside one
 * of the allowed folders. Comparison is by path prefix plus separator, case-insensitive on Windows.
 */
import nodePath from 'path';
import type { promises as FsPromises } from 'fs';

export type Fs = typeof FsPromises;

export const pathApi = (platform: NodeJS.Platform) => (platform === 'win32' ? nodePath.win32 : nodePath.posix);

const fold = (s: string, platform: NodeJS.Platform) => (platform === 'win32' ? s.toLowerCase() : s);

/** True when `child` is `root` or lies under it. Both are normalised; no filesystem access. */
export function isInside(child: string, root: string, platform: NodeJS.Platform = process.platform): boolean {
    const p = pathApi(platform);
    const c = fold(p.resolve(child), platform);
    const r = fold(p.resolve(root), platform);
    if (c === r) return true;
    const withSep = r.endsWith(p.sep) ? r : r + p.sep;
    return c.startsWith(withSep);
}

/** The allowed folder that contains `child` (the deepest one), or null. */
export function findRoot(child: string, roots: string[], platform: NodeJS.Platform = process.platform): string | null {
    let best: string | null = null;
    for (const r of roots) if (isInside(child, r, platform) && (!best || r.length > best.length)) best = r;
    return best;
}

export function samePath(a: string, b: string, platform: NodeJS.Platform = process.platform): boolean {
    const p = pathApi(platform);
    return fold(p.resolve(a), platform) === fold(p.resolve(b), platform);
}

const code = (e: unknown) => (e as NodeJS.ErrnoException)?.code;

/**
 * Real path of `abs`. When it doesn't exist yet, the nearest existing ancestor is resolved and the missing segments are
 * appended. A dangling symlink on the way is refused (writing through it would land wherever it points).
 */
export async function realpathLoose(abs: string, fs: Fs, platform: NodeJS.Platform = process.platform): Promise<{ path: string; exists: boolean }> {
    const p = pathApi(platform);
    let cur = p.resolve(abs);
    const missing: string[] = [];
    for (;;) {
        try {
            const real = await fs.realpath(cur);
            return { path: missing.length ? p.join(real, ...missing.reverse()) : real, exists: missing.length === 0 };
        } catch (e) {
            if (code(e) !== 'ENOENT' && code(e) !== 'ENOTDIR') throw e;
            const isLink = await fs.lstat(cur).then(
                (s) => s.isSymbolicLink(),
                () => false,
            );
            if (isLink) throw new Error(`Refusing to follow a broken link: ${cur}`);
            const parent = p.dirname(cur);
            if (parent === cur) throw e;
            missing.push(p.basename(cur));
            cur = parent;
        }
    }
}

export interface ResolvedPath {
    /** Real absolute path. */
    path: string;
    /** The allowed folder it is in. */
    root: string;
    exists: boolean;
}

/**
 * Resolves a path from the page against the allowed folders.
 * - Absolute paths are used as given.
 * - Relative paths are tried against each allowed folder, and also against a folder's parent when the first segment is
 *   that folder's name ("Reports/q3.pdf" with ".../Documents/Reports" allowed). The first existing match wins; for
 *   targets that don't exist yet (write, move destination) the first candidate inside an allowed folder is used.
 */
export async function resolveAllowed(input: string, roots: string[], fs: Fs, opts: { mustExist: boolean; platform?: NodeJS.Platform }): Promise<ResolvedPath> {
    const platform = opts.platform ?? process.platform;
    const p = pathApi(platform);
    const raw = String(input ?? '').trim();
    if (!raw) throw new Error('A path is required.');
    if (raw.includes('\0')) throw new Error('Invalid path.');
    if (platform === 'win32' && /^(\\\\[?.]\\)/.test(raw)) throw new Error('Device paths are not allowed.');
    if (platform === 'win32' && raw.slice(2).includes(':')) throw new Error('Invalid path (":" is only allowed after the drive letter).');
    if (!roots.length) throw new Error('No folders are allowed yet. Add one in Settings → Devices on this computer.');

    const candidates: string[] = [];
    if (p.isAbsolute(raw)) candidates.push(p.resolve(raw));
    else {
        for (const r of roots) candidates.push(p.resolve(r, raw));
        const first = raw.split(/[\\/]/)[0];
        for (const r of roots) if (fold(p.basename(r), platform) === fold(first, platform)) candidates.push(p.resolve(p.dirname(r), raw));
    }

    let fallback: ResolvedPath | null = null;
    let lastError: Error | null = null;
    for (const c of candidates) {
        let real: { path: string; exists: boolean };
        try {
            real = await realpathLoose(c, fs, platform);
        } catch (e) {
            lastError = e as Error;
            continue;
        }
        const root = findRoot(real.path, roots, platform);
        if (!root) continue;
        if (real.exists) return { path: real.path, root, exists: true };
        fallback ??= { path: real.path, root, exists: false };
    }
    if (fallback && !opts.mustExist) return fallback;
    if (fallback) throw new Error(`Not found: ${raw}`);
    if (lastError && /broken link/.test(lastError.message)) throw lastError;
    throw new Error(`That path is outside the folders you've allowed: ${raw}`);
}
