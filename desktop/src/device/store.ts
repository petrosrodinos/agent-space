/**
 * Device tool settings kept by the main process in userData/device.json (§14.3): allowed folders, local tool servers
 * (environment values encrypted with safeStorage) and the user's extra blocked apps. The page never writes this file
 * directly; it only reaches it through the checked IPC handlers in index.ts.
 */
import { app, safeStorage } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

export interface StoredToolServer {
    id: string;
    name: string;
    command: string;
    args: string[];
    /** name → base64 of safeStorage-encrypted value. */
    env: Record<string, string>;
    enabled: boolean;
}

export interface DeviceSettings {
    folders: string[];
    toolServers: StoredToolServer[];
    blockedApps: string[];
}

const file = () => path.join(app.getPath('userData'), 'device.json');
const empty = (): DeviceSettings => ({ folders: [], toolServers: [], blockedApps: [] });

let cache: DeviceSettings | null = null;
let writing: Promise<void> = Promise.resolve();

export async function readDevice(): Promise<DeviceSettings> {
    if (cache) return cache;
    try {
        const raw = JSON.parse(await fs.readFile(file(), 'utf8')) as Partial<DeviceSettings>;
        cache = {
            folders: Array.isArray(raw.folders) ? raw.folders.filter((f) => typeof f === 'string') : [],
            toolServers: Array.isArray(raw.toolServers) ? raw.toolServers : [],
            blockedApps: Array.isArray(raw.blockedApps) ? raw.blockedApps.filter((f) => typeof f === 'string') : [],
        };
    } catch {
        cache = empty();
    }
    return cache;
}

/** Applies a change and saves it. Writes are serialised so concurrent calls can't lose each other's changes. */
export async function updateDevice(change: (s: DeviceSettings) => void | Promise<void>): Promise<DeviceSettings> {
    const run = writing.then(async () => {
        const s = structuredClone(await readDevice());
        await change(s);
        const tmp = `${file()}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
        await fs.rename(tmp, file());
        cache = s;
    });
    writing = run.catch(() => undefined);
    await run;
    return cache!;
}

export function encryptValue(value: string): string {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("This computer's secure storage isn't available, so environment values can't be saved.");
    return safeStorage.encryptString(value).toString('base64');
}

export function decryptValue(stored: string): string {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
}
