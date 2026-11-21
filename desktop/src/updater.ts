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
/** Waits before retrying a check that failed for a temporary reason (server error, network blip). */
const RETRY_DELAYS_MS = [2_000, 6_000];

/** electron-updater puts the HTTP status first in its message ("502 \"method: GET url: …"). */
const httpStatus = (message: string): number | undefined => {
    const m = /^(\d{3})\b/.exec(message.trim());
    return m ? Number(m[1]) : undefined;
};
const NETWORK_ERROR = /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|net::ERR_|socket hang up|timeout/i;

const isTransient = (message: string) => {
    const status = httpStatus(message);
    return (status !== undefined && (status >= 500 || status === 429)) || NETWORK_ERROR.test(message);
};

/** A short message for the page instead of electron-updater's raw request/response dump. */
function friendlyError(message: string): string {
    const status = httpStatus(message);
    if (status !== undefined && (status >= 500 || status === 429)) return 'The update server is temporarily unavailable. Try again in a few minutes.';
    if (status === 404) return 'No update information was found on the server.';
    if (status !== undefined) return `The update server returned an error (${status}).`;
    if (NETWORK_ERROR.test(message)) return "Couldn't reach the update server. Check your internet connection.";
    const firstLine = message.split('\n')[0].trim();
    return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine || 'Unknown error';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let state: UpdateState = { status: UpdateStatus.idle };
let getWindow: () => BrowserWindow | null = () => null;
let lastCheckAt = 0;
let inFlight: Promise<UpdateState> | null = null;
/** True while a check (with its retries) runs; its own catch reports the final error. */
let checkRunning = false;

const isEnabled = () => app.isPackaged && existsSync(path.join(process.resourcesPath, 'app-update.yml'));

/** An update is already downloaded and waiting for a restart; background re-checks must not hide it. */
const holdingDownload = () => state.status === UpdateStatus.downloaded;

function setState(next: UpdateState) {
    state = next;
    getWindow()?.webContents.send(UPDATE_STATUS_CHANNEL, state);
}

export const getUpdateState = (): UpdateState => state;

export function checkForUpdates(opts: { force?: boolean } = {}): Promise<UpdateState> {
    if (!isEnabled()) return Promise.resolve(state);
    // A download is in progress. A finished one does NOT stop checking: a newer release may have come out while the
    // user postponed the restart, and installing the older one would force a second update right after.
    if (state.status === UpdateStatus.downloading) return Promise.resolve(state);
    if (inFlight) return inFlight;
    if (!opts.force && Date.now() - lastCheckAt < MIN_CHECK_GAP_MS) return Promise.resolve(state);
    lastCheckAt = Date.now();
    inFlight = (async () => {
        checkRunning = true;
        try {
            for (let attempt = 0; ; attempt++) {
                try {
                    const r = await autoUpdater.checkForUpdates();
                    // The events below have already updated the state; this covers a check that returned nothing.
                    if (!r?.isUpdateAvailable && state.status === UpdateStatus.checking) setState({ status: UpdateStatus.none, checkedAt: Date.now() });
                    break;
                } catch (e) {
                    const message = (e as Error)?.message ?? String(e);
                    if (attempt < RETRY_DELAYS_MS.length && isTransient(message)) {
                        console.warn(`[updates] check failed (${message.split('\n')[0]}), retrying`);
                        await sleep(RETRY_DELAYS_MS[attempt]);
                        continue;
                    }
                    if (!holdingDownload()) setState({ status: UpdateStatus.error, message: friendlyError(message), checkedAt: Date.now() });
                    break;
                }
            }
        } finally {
            checkRunning = false;
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
    // While a downloaded update waits for a restart, a re-check may find an even newer one. Keep offering the
    // downloaded one (so "Restart to update" stays usable) until the newer one has finished downloading, then
    // `update-downloaded` replaces it and the restart installs the latest version in one step.
    autoUpdater.on('checking-for-update', () => {
        if (!holdingDownload()) setState({ ...state, status: UpdateStatus.checking });
    });
    autoUpdater.on('update-not-available', () => {
        if (!holdingDownload()) setState({ status: UpdateStatus.none, checkedAt: Date.now() });
    });
    autoUpdater.on('update-available', (i) => {
        if (!holdingDownload()) setState({ status: UpdateStatus.available, version: version(i), checkedAt: Date.now() });
    });
    autoUpdater.on('download-progress', (p) => {
        if (!holdingDownload()) setState({ ...state, status: UpdateStatus.downloading, percent: Math.round(p.percent) });
    });
    autoUpdater.on('update-downloaded', (i) => setState({ status: UpdateStatus.downloaded, version: version(i), checkedAt: Date.now() }));
    autoUpdater.on('error', (e) => {
        // A failed background download should not hide an update that is already waiting.
        // Errors during a check are handled (retried, then reported) by checkForUpdates itself.
        if (checkRunning) return;
        if (state.status !== UpdateStatus.downloaded) setState({ ...state, status: UpdateStatus.error, message: friendlyError(e?.message ?? String(e)) });
    });

    setTimeout(() => void checkForUpdates({ force: true }), FIRST_CHECK_DELAY_MS);
    setInterval(() => void checkForUpdates({ force: true }), CHECK_INTERVAL_MS);
    powerMonitor.on('resume', () => void checkForUpdates());
}
