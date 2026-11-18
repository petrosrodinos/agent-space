/**
 * Automatic updates (§14.2) through electron-updater and the generic feed on Google Cloud Storage.
 * The feed URL is baked into `resources/app-update.yml` by `npm run release` (scripts/release.mjs); builds made
 * without it (local `package:*`, `npm start`) report "disabled".
 *
 * Flow: check shortly after launch, every few hours and when the computer wakes up → download in the background →
 * tell the page ("Restart to update") → install on restart, or on the next quit if the user ignores it.
 */
import { app, powerMonitor, type BrowserWindow } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { existsSync } from 'fs';
import path from 'path';

export const UpdateStatus = {
    disabled: 'disabled',
    idle: 'idle',
    checking: 'checking',
    none: 'none',
    available: 'available',
    downloading: 'downloading',
    downloaded: 'downloaded',
    error: 'error',
} as const;
export type UpdateStatus = (typeof UpdateStatus)[keyof typeof UpdateStatus];

export interface UpdateState {
    status: UpdateStatus;
    /** The new version, once one is found. */
    version?: string;
    /** Download progress 0–100 while downloading. */
    percent?: number;
    message?: string;
    checkedAt?: number;
}

export const UPDATE_STATUS_CHANNEL = 'updates:status';

const FIRST_CHECK_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
/** Ignore wake-up / manual checks that come right after another one. */
const MIN_CHECK_GAP_MS = 60_000;

let state: UpdateState = { status: UpdateStatus.idle };
let getWindow: () => BrowserWindow | null = () => null;
let lastCheckAt = 0;
let inFlight: Promise<UpdateState> | null = null;

const isEnabled = () => app.isPackaged && existsSync(path.join(process.resourcesPath, 'app-update.yml'));

function setState(next: UpdateState) {
    state = next;
    getWindow()?.webContents.send(UPDATE_STATUS_CHANNEL, state);
}

export const getUpdateState = (): UpdateState => state;

export function checkForUpdates(opts: { force?: boolean } = {}): Promise<UpdateState> {
    if (!isEnabled()) return Promise.resolve(state);
    // Already found and downloaded — nothing more to do until restart.
    if (state.status === UpdateStatus.downloaded || state.status === UpdateStatus.downloading) return Promise.resolve(state);
    if (inFlight) return inFlight;
    if (!opts.force && Date.now() - lastCheckAt < MIN_CHECK_GAP_MS) return Promise.resolve(state);
    lastCheckAt = Date.now();
    inFlight = (async () => {
        try {
            const r = await autoUpdater.checkForUpdates();
            // The events below have already updated the state; this covers a check that returned nothing.
            if (!r?.isUpdateAvailable && state.status === UpdateStatus.checking) setState({ status: UpdateStatus.none, checkedAt: Date.now() });
        } catch (e) {
            setState({ status: UpdateStatus.error, message: (e as Error).message, checkedAt: Date.now() });
        } finally {
            inFlight = null;
        }
        return state;
    })();
    return inFlight;
}

/** Quits and runs the installer for the downloaded version. */
export function installUpdate(): boolean {
    if (state.status !== UpdateStatus.downloaded) return false;
    // isSilent=false (show the Windows installer progress), isForceRunAfter=true (reopen the app afterwards).
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return true;
}

export function initUpdater(windowGetter: () => BrowserWindow | null) {
    getWindow = windowGetter;
    if (!isEnabled()) {
        console.log('[updates] disabled: this build has no update feed (build it with `npm run release`)');
        state = { status: UpdateStatus.disabled };
        return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.logger = {
        info: (m: unknown) => console.log('[updates]', m),
        warn: (m: unknown) => console.warn('[updates]', m),
        error: (m: unknown) => console.error('[updates]', m),
        debug: () => undefined,
    };

    const version = (i: UpdateInfo) => i.version;
    autoUpdater.on('checking-for-update', () => setState({ ...state, status: UpdateStatus.checking }));
    autoUpdater.on('update-not-available', () => setState({ status: UpdateStatus.none, checkedAt: Date.now() }));
    autoUpdater.on('update-available', (i) => setState({ status: UpdateStatus.available, version: version(i), checkedAt: Date.now() }));
    autoUpdater.on('download-progress', (p) => setState({ ...state, status: UpdateStatus.downloading, percent: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (i) => setState({ status: UpdateStatus.downloaded, version: version(i), checkedAt: Date.now() }));
    autoUpdater.on('error', (e) => {
        // A failed background download should not hide an update that is already waiting.
        if (state.status !== UpdateStatus.downloaded) setState({ ...state, status: UpdateStatus.error, message: e?.message ?? String(e) });
    });

    setTimeout(() => void checkForUpdates({ force: true }), FIRST_CHECK_DELAY_MS);
    setInterval(() => void checkForUpdates({ force: true }), CHECK_INTERVAL_MS);
    powerMonitor.on('resume', () => void checkForUpdates());
}
