/**
 * Open tool (§14.3): links (http/https/mailto), files inside allowed folders, and apps by name.
 * Nothing is passed through a shell string except on Windows, where `start` is a cmd built-in; there the name is
 * restricted by APP_NAME (no quotes, %, ^, <, >, |) and wrapped in quotes, so it can't break out of the argument.
 */
import { execFile } from 'child_process';
import { shell } from 'electron';
import originalFs from 'original-fs';
import { promises as fsp, constants as fsConstants } from 'fs';
import path from 'path';
import { resolveAllowed, type Fs } from './paths';
import { liveRoots } from './files';

export const APP_NAME = /^[\w .+&()-]{1,60}$/;

/** Files that would run code when opened; "open" is for documents and folders, not for launching programs. */
const EXECUTABLE_EXT = /\.(exe|com|bat|cmd|msi|msix|appx|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|scr|pif|cpl|lnk|url|reg|jar|app|command|sh|tool|pkg|scpt|workflow|desktop|run|appimage)$/i;

const run = (file: string, args: string[], opts: { windowsVerbatimArguments?: boolean } = {}) =>
    new Promise<void>((resolve, reject) => {
        execFile(file, args, { windowsHide: true, timeout: 15_000, ...opts }, (err) => (err ? reject(err) : resolve()));
    });

async function findOnPath(name: string): Promise<string | null> {
    if (name.includes('/')) return null;
    for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
        const full = path.join(dir, name);
        try {
            await fsp.access(full, fsConstants.X_OK);
            if ((await fsp.stat(full)).isFile()) return full;
        } catch {
            /* not here */
        }
    }
    return null;
}

async function openApp(name: string) {
    if (!APP_NAME.test(name)) throw new Error('App names may only contain letters, numbers, spaces and . + & ( ) - (up to 60 characters).');
    try {
        if (process.platform === 'darwin') await run('open', ['-a', name]);
        else if (process.platform === 'win32') {
            // `start "" "<name>"`: /s keeps cmd from stripping our quotes; the name can't contain quotes (APP_NAME).
            await run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `start "" "${name}"`], { windowsVerbatimArguments: true });
        } else {
            const exe = await findOnPath(name.trim());
            if (!exe) throw new Error('not found');
            const child = execFile(exe, [], { windowsHide: true });
            child.on('error', () => undefined);
            child.unref();
        }
    } catch {
        throw new Error(`Couldn't open the app "${name}". Check the name as it appears on this computer.`);
    }
}

export async function openTarget(req: { kind: 'url' | 'path' | 'app'; target: string }, folders: string[]): Promise<{ ok: true }> {
    const target = String(req?.target ?? '').trim();
    if (!target) throw new Error('Nothing to open.');
    switch (req?.kind) {
        case 'url': {
            let u: URL;
            try {
                u = new URL(target);
            } catch {
                throw new Error('That is not a valid link.');
            }
            if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) throw new Error('Only http, https and mailto links can be opened.');
            await shell.openExternal(u.toString());
            return { ok: true };
        }
        case 'path': {
            const fs = originalFs.promises as unknown as Fs;
            const file = await resolveAllowed(target, await liveRoots(folders, fs), fs, { mustExist: true });
            const st = await fs.stat(file.path);
            const unixExecutable = process.platform !== 'win32' && st.isFile() && (st.mode & 0o111) !== 0;
            if (EXECUTABLE_EXT.test(file.path) || unixExecutable) throw new Error("Programs and scripts can't be opened this way; only documents and folders.");
            const err = await shell.openPath(file.path);
            if (err) throw new Error(`Couldn't open ${file.path}: ${err}`);
            return { ok: true };
        }
        case 'app':
            await openApp(target);
            return { ok: true };
        default:
            throw new Error(`Unknown open kind: ${String(req?.kind)}`);
    }
}
