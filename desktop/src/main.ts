/**
 * Agent Space desktop (§14.2): the bundled app/ build in a locked-down Electron window.
 * - contextIsolation + sandbox on, nodeIntegration off; the page reaches native features only via the typed preload bridge.
 * - Navigation is locked to the app origin; outside links open in the system browser.
 * - Local files, notifications, the global quick-ask shortcut, deep links and updates live here, never in the page.
 */
import { app, BrowserWindow, clipboard, nativeTheme, Tray, dialog, globalShortcut, ipcMain, Menu, net, Notification, protocol, safeStorage, session, shell, type IpcMainInvokeEvent } from 'electron';
import { existsSync, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { registerDeviceIpc } from './device';
import { checkForUpdates, getUpdateState, initUpdater, installUpdate } from './updater';

const DEV = process.argv.includes('--dev') || !!process.env.AGENTSPACE_DEV_URL;
const DEV_URL = process.env.AGENTSPACE_DEV_URL || 'http://localhost:5180';
const SCHEME = 'app';
const HOST = 'agentspace';
const APP_ORIGIN = DEV ? new URL(DEV_URL).origin : `${SCHEME}://${HOST}`;
const DEEP_LINK = 'agentspace';
const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Space';
const MAX_PICK_BYTES = 100 * 1024 * 1024;

let win: BrowserWindow | null = null;
let pendingPath: string | null = null;
let tray: Tray | null = null;
let quitting = false;

function showWindow() {
    if (!win) return createWindow();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
}

/** Tray icon while the app keeps running in the background; click reopens the window. */
function ensureTray() {
    if (tray) return;
    tray = new Tray((app.isPackaged ? path.join(process.resourcesPath, 'tray-icon.png') : path.join(app.getAppPath(), 'build', 'icon.png')));
    tray.setToolTip('Agent Space');
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open Agent Space', click: showWindow },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
    ]));
    tray.on('click', showWindow);
}

function hideToBackground() {
    ensureTray();
    win?.hide();
}

/** Close button: quit, keep running in the background, or ask (with "remember my choice"). */
async function handleClose(e: Electron.Event) {
    if (quitting || !win) return;
    const { closeAction } = await readSettings();
    if (closeAction === 'quit') return;
    e.preventDefault();
    if (closeAction === 'background') return hideToBackground();
    const { response, checkboxChecked } = await dialog.showMessageBox(win, {
        type: 'question',
        title: 'Close Agent Space',
        message: 'Quit Agent Space, or keep it running in the background?',
        detail: 'In the background it keeps your notifications and the quick-ask shortcut working.',
        buttons: ['Keep in background', 'Quit', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        checkboxLabel: 'Remember my choice',
    });
    if (response === 2) return;
    if (checkboxChecked) await writeSettings({ ...(await readSettings()), closeAction: response === 0 ? 'background' : 'quit' });
    if (response === 0) hideToBackground();
    else app.quit();
}

// ---------------- Settings (non-sensitive) ----------------

type CloseAction = 'ask' | 'background' | 'quit';
interface Settings {
    quickAskShortcut: string;
    /** What the window's close button does; 'ask' shows the choice dialog. */
    closeAction: CloseAction;
}
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
async function readSettings(): Promise<Settings> {
    try {
        return { quickAskShortcut: DEFAULT_SHORTCUT, closeAction: 'ask', ...JSON.parse(await fs.readFile(settingsFile(), 'utf8')) };
    } catch {
        return { quickAskShortcut: DEFAULT_SHORTCUT, closeAction: 'ask' };
    }
}
async function writeSettings(s: Settings) {
    await fs.writeFile(settingsFile(), JSON.stringify(s, null, 2));
}

// ---------------- Refresh token (OS keychain via safeStorage) ----------------

const tokenFile = () => path.join(app.getPath('userData'), 'session.bin');
let memoryToken: string | null = null;

async function getRefreshToken(): Promise<string | null> {
    if (memoryToken) return memoryToken;
    if (!safeStorage.isEncryptionAvailable()) return null;
    try {
        memoryToken = safeStorage.decryptString(await fs.readFile(tokenFile()));
        return memoryToken;
    } catch {
        return null;
    }
}

async function setRefreshToken(token: string | null) {
    memoryToken = token;
    if (!token) {
        await fs.rm(tokenFile(), { force: true });
        return;
    }
    // Never written in plain text: without OS encryption the token stays in memory for this run only.
    if (safeStorage.isEncryptionAvailable()) await fs.writeFile(tokenFile(), safeStorage.encryptString(token), { mode: 0o600 });
}

// ---------------- Deep links ----------------

/** `agentspace://c/123?x=1` → `/c/123?x=1` */
function deepLinkToPath(url: string): string | null {
    if (!url.startsWith(`${DEEP_LINK}://`)) return null;
    const rest = url.slice(DEEP_LINK.length + 3).replace(/^\/+/, '');
    return `/${rest}`;
}

function openPath(p: string) {
    if (!win) {
        pendingPath = p;
        return;
    }
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send('navigate', p);
}

function handleArgv(argv: string[]) {
    const link = argv.find((a) => a.startsWith(`${DEEP_LINK}://`));
    const p = link ? deepLinkToPath(link) : null;
    if (p) openPath(p);
}

// ---------------- Window and security ----------------

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

/** Node's URL gives custom schemes a "null" origin, so compare the scheme://host prefix directly. */
const isAppUrl = (url: string) => url === APP_ORIGIN || url.startsWith(`${APP_ORIGIN}/`) || url.startsWith(`${APP_ORIGIN}?`) || url.startsWith(`${APP_ORIGIN}#`);

function openExternalSafe(url: string) {
    try {
        const u = new URL(url);
        if (['https:', 'http:', 'mailto:'].includes(u.protocol)) void shell.openExternal(u.toString());
    } catch {
        /* ignore invalid URLs */
    }
}

/** Serves the bundled web app at app://agentspace/… with SPA fallback to index.html and a strict CSP. */
function registerAppProtocol() {
    const root = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.resolve(__dirname, '../../app/dist');
    protocol.handle(SCHEME, async (req) => {
        const url = new URL(req.url);
        if (url.host !== HOST) return new Response('Not found', { status: 404 });
        const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        let file = path.normalize(path.join(root, rel));
        if (!file.startsWith(root) || !existsSync(file) || (await fs.stat(file)).isDirectory()) file = path.join(root, 'index.html');
        const res = await net.fetch(pathToFileURL(file).toString());
        const headers = new Headers(res.headers);
        if (file.endsWith('.html')) {
            headers.set(
                'Content-Security-Policy',
                [
                    "default-src 'self'",
                    "script-src 'self'",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                    "font-src 'self' data: https://fonts.gstatic.com",
                    "img-src 'self' data: blob: https: http://localhost:*",
                    "media-src 'self' data: blob: https: http://localhost:*",
                    "connect-src 'self' https: wss: http://localhost:* ws://localhost:*",
                    'frame-src https: http://localhost:*',
                    "object-src 'none'",
                    "base-uri 'self'",
                ].join('; '),
            );
        }
        return new Response(res.body, { status: res.status, headers });
    });
}

function hardenSession() {
    const allowed = new Set(['media', 'notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen']);
    const fromApp = (wc: Electron.WebContents | null, origin?: string) => (origin ? isAppUrl(origin) : !!wc && isAppUrl(wc.getURL()));
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => cb(allowed.has(permission) && fromApp(wc, details.requestingUrl)));
    session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => allowed.has(permission) && fromApp(wc, origin));
    // Never let the page attach webviews or run with Node.
    app.on('web-contents-created', (_e, contents) => {
        contents.on('will-attach-webview', (ev) => ev.preventDefault());
        contents.setWindowOpenHandler(({ url }) => {
            if (!isAppUrl(url)) openExternalSafe(url);
            return { action: 'deny' };
        });
        contents.on('will-navigate', (ev, url) => {
            if (!isAppUrl(url)) {
                ev.preventDefault();
                openExternalSafe(url);
            }
        });
    });
}

const TITLEBAR_HEIGHT = 36;

function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 380,
        minHeight: 560,
        title: 'Agent Space',
        backgroundColor: '#FFFBF5',
        show: false,
        autoHideMenuBar: true,
        // Custom title bar: the app draws it (drag strip) and we colour the native window controls to match.
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
        ...(process.platform === 'darwin' ? {} : { titleBarOverlay: { color: '#FFFFFF', symbolColor: '#0D0D0F', height: TITLEBAR_HEIGHT } }),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
            spellcheck: true,
        },
    });
    win.once('ready-to-show', () => win?.show());
    win.on('close', (e) => void handleClose(e));
    win.on('closed', () => (win = null));
    win.webContents.on('did-finish-load', () => {
        if (pendingPath) {
            win?.webContents.send('navigate', pendingPath);
            pendingPath = null;
        }
    });
    void win.loadURL(DEV ? DEV_URL : `${SCHEME}://${HOST}/`);
}

// ---------------- Quick-ask shortcut ----------------

let quickAskAccelerator: string | null = null;

/** Replaces only the quick-ask shortcut, so the control-my-computer stop shortcut (device/control.ts) stays registered. */
function registerShortcut(accelerator: string): boolean {
    if (quickAskAccelerator) globalShortcut.unregister(quickAskAccelerator);
    quickAskAccelerator = null;
    try {
        const ok = globalShortcut.register(accelerator, () => openPath('/'));
        if (ok) quickAskAccelerator = accelerator;
        return ok;
    } catch {
        return false;
    }
}

// ---------------- IPC (bridge) ----------------

function guard(e: Pick<IpcMainInvokeEvent, 'senderFrame'>) {
    const url = e.senderFrame?.url ?? '';
    if (!isAppUrl(url)) throw new Error('Blocked: not the app');
}

const MIME: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', html: 'text/html', xml: 'application/xml', yaml: 'application/x-yaml', yml: 'application/x-yaml',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip: 'application/zip', mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm',
};

/** ".pdf,.docx,image/*" → dialog filter extensions. */
function acceptToExtensions(accept?: string): string[] | null {
    if (!accept) return null;
    const out = new Set<string>();
    for (const raw of accept.split(',').map((s) => s.trim().toLowerCase())) {
        if (raw.startsWith('.')) out.add(raw.slice(1));
        else if (raw.endsWith('/*')) Object.entries(MIME).forEach(([ext, m]) => m.startsWith(raw.slice(0, -1)) && out.add(ext));
        else Object.entries(MIME).forEach(([ext, m]) => m === raw && out.add(ext));
    }
    return out.size ? [...out] : null;
}

function registerIpc() {
    ipcMain.on('app:info', (e) => {
        e.returnValue = { version: app.getVersion(), os: process.platform, deviceName: `${os.hostname()} (${process.platform === 'darwin' ? 'Mac' : process.platform === 'win32' ? 'Windows' : 'Linux'} app)` };
    });
    ipcMain.on('window:theme', (e, t: { dark: boolean; color: string; symbolColor: string }) => {
        guard(e);
        const hex = /^#[0-9a-fA-F]{6}$/;
        const color = hex.test(t?.color) ? t.color : t?.dark ? '#0A0A0A' : '#FFFFFF';
        const symbolColor = hex.test(t?.symbolColor) ? t.symbolColor : t?.dark ? '#F5F5F5' : '#0D0D0F';
        nativeTheme.themeSource = t?.dark ? 'dark' : 'light';
        win?.setBackgroundColor(color);
        if (process.platform !== 'darwin') win?.setTitleBarOverlay({ color, symbolColor, height: TITLEBAR_HEIGHT });
    });
    ipcMain.handle('token:get', (e) => (guard(e), getRefreshToken()));
    ipcMain.handle('token:set', (e, token: string | null) => (guard(e), setRefreshToken(typeof token === 'string' ? token : null)));
    ipcMain.handle('files:pick', async (e, opts: { accept?: string; multiple?: boolean }) => {
        guard(e);
        const exts = acceptToExtensions(opts?.accept);
        const r = await dialog.showOpenDialog(win!, { properties: ['openFile', ...(opts?.multiple ? (['multiSelections'] as const) : [])], filters: exts ? [{ name: 'Files', extensions: exts }] : undefined });
        if (r.canceled) return [];
        const out = [];
        for (const p of r.filePaths.slice(0, 10)) {
            const st = await fs.stat(p);
            if (st.size > MAX_PICK_BYTES) continue;
            const buf = await fs.readFile(p);
            const ext = path.extname(p).slice(1).toLowerCase();
            out.push({ name: path.basename(p), type: MIME[ext] ?? 'application/octet-stream', data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
        }
        return out;
    });
    ipcMain.handle('files:download', (e, url: string) => {
        guard(e);
        if (/^https?:\/\//.test(url)) win?.webContents.downloadURL(url);
    });
    ipcMain.handle('notify', (e, n: { title: string; body?: string; tag?: string }) => {
        guard(e);
        if (!Notification.isSupported()) return;
        const notification = new Notification({ title: String(n.title).slice(0, 200), body: String(n.body ?? '').slice(0, 500), silent: false });
        notification.on('click', () => {
            if (win) {
                win.show();
                win.focus();
                win.webContents.send('notification-click', n.tag ?? null);
            }
        });
        notification.show();
    });
    ipcMain.handle('clipboard:write', (e, text: string) => (guard(e), clipboard.writeText(String(text))));
    ipcMain.handle('clipboard:read', (e) => (guard(e), clipboard.readText()));
    ipcMain.handle('open-external', (e, url: string) => (guard(e), openExternalSafe(String(url))));
    ipcMain.handle('startup:get', (e) => (guard(e), app.getLoginItemSettings().openAtLogin));
    ipcMain.handle('startup:set', (e, on: boolean) => (guard(e), app.setLoginItemSettings({ openAtLogin: !!on })));
    ipcMain.handle('shortcut:get', async (e) => (guard(e), (await readSettings()).quickAskShortcut));
    ipcMain.handle('shortcut:set', async (e, accelerator: string) => {
        guard(e);
        const ok = registerShortcut(String(accelerator));
        const s = await readSettings();
        if (ok) await writeSettings({ ...s, quickAskShortcut: String(accelerator) });
        else registerShortcut(s.quickAskShortcut);
        return ok;
    });
    ipcMain.handle('updates:check', (e) => (guard(e), checkForUpdates({ force: true })));
    ipcMain.handle('updates:state', (e) => (guard(e), getUpdateState()));
    ipcMain.handle('updates:install', (e) => (guard(e), installUpdate()));
    registerDeviceIpc(() => win, guard);
}

// ---------------- App lifecycle ----------------

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient(DEEP_LINK, process.execPath, [path.resolve(process.argv[1])]);
    else app.setAsDefaultProtocolClient(DEEP_LINK);

    app.on('second-instance', (_e, argv) => {
        handleArgv(argv);
        showWindow();
    });
    app.on('open-url', (e, url) => {
        e.preventDefault();
        const p = deepLinkToPath(url);
        if (p) openPath(p);
    });

    void app.whenReady().then(async () => {
        if (process.platform === 'win32') app.setAppUserModelId('com.agentspace.desktop');
        if (!DEV) Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]) : null);
        registerAppProtocol();
        hardenSession();
        registerIpc();
        createWindow();
        handleArgv(process.argv);
        registerShortcut((await readSettings()).quickAskShortcut);
        initUpdater(() => win);
        app.on('activate', () => {
            if (!BrowserWindow.getAllWindows().length) createWindow();
        });
    });

    app.on('before-quit', () => (quitting = true));
    app.on('will-quit', () => globalShortcut.unregisterAll());
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin' && quitting) app.quit();
    });
}
