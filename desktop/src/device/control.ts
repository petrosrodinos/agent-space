/**
 * Control my computer (§14.3), main-process side.
 *
 * - One grant at a time (grant ID, display, bot name, task, expiry), checked on every call; it ends when the app ends it,
 *   the user presses Stop or Ctrl/Cmd+Alt+Shift+S, or at expiresAt (at most 30 minutes).
 * - While active: an always-on-top, click-through coloured border around the chosen display and a small bar at its top
 *   ("<bot> is using your computer", Pause / Stop). Both use content protection so they're left out of screenshots.
 * - Real mouse/keyboard input (uiohook-napi) pauses the grant; events within 150 ms of the tool's own input are ignored.
 * - Before and after each action the frontmost app (get-windows) is checked against the blocked list.
 * - Input is sent with @nut-tree-fork/nut-js. The `type` action types whatever text it is given: this process can't tell
 *   whether the focused field is a password field, so keeping passwords and card numbers out of `type` is enforced by the
 *   server (§14.3 "Passwords and payment details"), not here.
 * - All three native libraries are loaded lazily; if any fails to load, CONTROL_COMPUTER is left out of capabilities().
 */
import { app, BrowserWindow, globalShortcut, ipcMain, screen, systemPreferences, type Display } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { BUILT_IN_BLOCKED_APPS, cleanBlockedList, matchBlockedApp, type FrontApp } from './blocked';
import { assertInShot, dipToPhysical, screenshotSize, shotToDip } from './coords';
import { parseKeyCombo } from './keys';
import { captureDisplay, placeholderImage } from './screen';
import { readDevice, updateDevice } from './store';
import { ControlActions, ControlStates, type ControlEvent, type ControlRequest, type ControlResult, type DisplayInfo } from './types';

type Nut = typeof import('@nut-tree-fork/nut-js');
type Uiohook = typeof import('uiohook-napi');
type GetWindows = typeof import('get-windows');

export const STOP_SHORTCUT = 'CommandOrControl+Alt+Shift+S';
const MAX_GRANT_MS = 30 * 60 * 1000;
const SETTLE_MS = 400;
const SYNTHETIC_IGNORE_MS = 150;
const HAND_BACK_GRACE_MS = 1000;
const MAX_WAIT_MS = 5000;
const MAX_TYPE_CHARS = 5000;
const MAX_SCROLL = 50;
const BORDER_COLOR = '#F97316';
const BAR_WIDTH = 460;
const BAR_HEIGHT = 44;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------- Native libraries (lazy, optional) ----------------

let nut: Nut | null | undefined;
let hookLib: Uiohook | null | undefined;
let getWindows: GetWindows | null | undefined;

/** get-windows is ESM-only: Node 22 (Electron 45) can require() it; older runtimes fall back to import(). */
async function loadEsm<T>(name: string): Promise<T> {
    try {
        return require(name) as T;
    } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== 'ERR_REQUIRE_ESM' && code !== 'ERR_REQUIRE_ASYNC_MODULE') throw e;
        const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<T>;
        return dynamicImport(pathToFileURL(require.resolve(name)).href);
    }
}

async function loadLibraries() {
    if (nut === undefined) {
        try {
            nut = await import('@nut-tree-fork/nut-js');
            nut.keyboard.config.autoDelayMs = 8;
            nut.mouse.config.autoDelayMs = 40;
        } catch (e) {
            console.warn('[device] nut-js unavailable:', (e as Error).message);
            nut = null;
        }
    }
    if (hookLib === undefined) {
        try {
            hookLib = await import('uiohook-napi');
        } catch (e) {
            console.warn('[device] uiohook-napi unavailable:', (e as Error).message);
            hookLib = null;
        }
    }
    if (getWindows === undefined) {
        try {
            getWindows = await loadEsm<GetWindows>('get-windows');
        } catch (e) {
            console.warn('[device] get-windows unavailable:', (e as Error).message);
            getWindows = null;
        }
    }
}

export async function controlAvailable(): Promise<boolean> {
    await loadLibraries();
    return !!(nut && hookLib && getWindows);
}

// ---------------- Front app and blocked list ----------------

const selfPids = () => [process.pid, ...app.getAppMetrics().map((m) => m.pid)];

export async function frontApp(): Promise<FrontApp | null> {
    await loadLibraries();
    if (!getWindows) return null;
    try {
        const w = await getWindows.activeWindow({ accessibilityPermission: false, screenRecordingPermission: false });
        if (!w) return null;
        return { name: w.owner.name, path: w.owner.path, bundleId: 'bundleId' in w.owner ? (w.owner as { bundleId?: string }).bundleId : undefined, title: w.title, processId: w.owner.processId };
    } catch {
        return null;
    }
}

export async function getBlockedApps() {
    return { builtIn: [...BUILT_IN_BLOCKED_APPS], extra: (await readDevice()).blockedApps };
}

export async function setBlockedApps(extra: string[]) {
    const s = await updateDevice((d) => {
        d.blockedApps = cleanBlockedList(extra);
    });
    return { builtIn: [...BUILT_IN_BLOCKED_APPS], extra: s.blockedApps };
}

// ---------------- Displays ----------------

export function displays(): DisplayInfo[] {
    const primary = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((d, i) => ({
        id: String(d.id),
        label: d.label || (d.id === primary ? 'Main display' : `Display ${i + 1}`),
        width: Math.round(d.bounds.width * d.scaleFactor),
        height: Math.round(d.bounds.height * d.scaleFactor),
        primary: d.id === primary,
    }));
}

const findDisplay = (id: string): Display | undefined => screen.getAllDisplays().find((d) => String(d.id) === String(id));

// ---------------- Grant state ----------------

interface Grant {
    id: string;
    displayId: string;
    botName: string;
    task: string;
    expiresAt: number;
    state: typeof ControlStates.RUNNING | typeof ControlStates.PAUSED;
    note?: string;
    timer: NodeJS.Timeout;
    border: BrowserWindow | null;
    bar: BrowserWindow | null;
    minimizedMain: boolean;
}

let grant: Grant | null = null;
let getMainWin: () => BrowserWindow | null = () => null;
/** True while the tool is sending input; uiohook events then are ours. */
let busy = false;
let actionInFlight = false;
let lastSyntheticAt = 0;
let ignoreInputUntil = 0;
let hookRunning = false;

function emit(ev: ControlEvent) {
    const w = getMainWin();
    if (w && !w.isDestroyed()) w.webContents.send('device:control-event', ev);
}

function pushBarState() {
    const g = grant;
    if (!g?.bar || g.bar.isDestroyed()) return;
    g.bar.webContents.send('control-bar:state', { botName: g.botName, state: g.state, note: g.note });
}

function pause(reason: string, note?: string) {
    const g = grant;
    if (!g || g.state !== ControlStates.RUNNING) return;
    g.state = ControlStates.PAUSED;
    g.note = note;
    pushBarState();
    emit({ grantId: g.id, state: ControlStates.PAUSED, reason });
}

function resume(reason: string) {
    const g = grant;
    if (!g || g.state !== ControlStates.PAUSED) return;
    g.state = ControlStates.RUNNING;
    g.note = undefined;
    ignoreInputUntil = Date.now() + HAND_BACK_GRACE_MS;
    pushBarState();
    emit({ grantId: g.id, state: ControlStates.RUNNING, reason });
}

/** Ends the active grant. `event` is emitted when the end didn't come from the page itself. */
function finish(event?: { state: typeof ControlStates.STOPPED | typeof ControlStates.EXPIRED; reason: string }) {
    const g = grant;
    if (!g) return;
    grant = null;
    clearTimeout(g.timer);
    for (const w of [g.border, g.bar]) if (w && !w.isDestroyed()) w.destroy();
    globalShortcut.unregister(STOP_SHORTCUT);
    stopHook();
    if (g.minimizedMain) {
        const w = getMainWin();
        if (w && !w.isDestroyed() && w.isMinimized()) w.restore();
    }
    if (event) emit({ grantId: g.id, ...event });
}

// ---------------- Input hook ----------------

function onUserInput() {
    if (!grant || grant.state !== ControlStates.RUNNING) return;
    const now = Date.now();
    if (busy || now - lastSyntheticAt < SYNTHETIC_IGNORE_MS || now < ignoreInputUntil) return;
    pause('user_input');
}

function startHook() {
    if (!hookLib || hookRunning) return;
    const { uIOhook } = hookLib;
    uIOhook.on('mousemove', onUserInput);
    uIOhook.on('mousedown', onUserInput);
    uIOhook.on('wheel', onUserInput);
    uIOhook.on('keydown', onUserInput);
    try {
        uIOhook.start();
        hookRunning = true;
    } catch (e) {
        uIOhook.removeAllListeners();
        throw new Error(`Couldn't watch for your mouse and keyboard, so control can't start safely: ${(e as Error).message}`);
    }
}

function stopHook() {
    if (!hookLib || !hookRunning) return;
    hookRunning = false;
    hookLib.uIOhook.removeAllListeners();
    try {
        hookLib.uIOhook.stop();
    } catch {
        /* already stopped */
    }
}

// ---------------- Border and bar windows ----------------

const overlayPrefs = { sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false } as const;

function borderHtml() {
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}body{box-sizing:border-box;border:5px solid ${BORDER_COLOR}}</style></head><body></body></html>`;
}

function barHtml() {
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden;font:13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;user-select:none;-webkit-user-select:none}
.bar{box-sizing:border-box;height:100%;display:flex;align-items:center;gap:8px;padding:0 6px 0 14px;background:#111;color:#fff;border:1px solid ${BORDER_COLOR};border-radius:22px}
.dot{width:8px;height:8px;border-radius:50%;background:${BORDER_COLOR};flex:none}
.msg{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
button{font:inherit;border:0;border-radius:16px;padding:7px 14px;cursor:pointer;background:#2a2a2a;color:#fff}
button:hover{background:#3a3a3a}
#stop{background:#fff;color:#111}#stop:hover{background:#e5e5e5}
</style></head><body><div class="bar"><span class="dot"></span><span class="msg" id="msg"></span><button id="primary">Pause</button><button id="stop">Stop</button></div>
<script>
const msg=document.getElementById('msg'),primary=document.getElementById('primary');let state='running';
primary.addEventListener('click',()=>window.controlBar.send(state==='running'?'pause':'handback'));
document.getElementById('stop').addEventListener('click',()=>window.controlBar.send('stop'));
window.controlBar.onState((s)=>{state=s.state;msg.textContent=s.state==='running'?s.botName+' is using your computer':(s.note||'You have control');primary.textContent=s.state==='running'?'Pause':'Hand back';});
</script></body></html>`;
}

const dataUrl = (html: string) => `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

function makeOverlay(bounds: Electron.Rectangle, opts: { preload?: string; clickThrough: boolean }) {
    const w = new BrowserWindow({
        ...bounds,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        alwaysOnTop: true,
        focusable: false,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        hasShadow: false,
        enableLargerThanScreen: true,
        title: 'Agent Space control',
        webPreferences: { ...overlayPrefs, preload: opts.preload },
    });
    w.setAlwaysOnTop(true, 'screen-saver');
    w.setContentProtection(true);
    w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (opts.clickThrough) w.setIgnoreMouseEvents(true);
    w.setBounds(bounds);
    return w;
}

function showOverlays(g: Grant, d: Display) {
    g.border = makeOverlay(d.bounds, { clickThrough: true });
    const barBounds = { x: Math.round(d.bounds.x + (d.bounds.width - BAR_WIDTH) / 2), y: d.bounds.y + 8, width: BAR_WIDTH, height: BAR_HEIGHT };
    g.bar = makeOverlay(barBounds, { preload: path.join(__dirname, 'bar-preload.js'), clickThrough: false });
    g.bar.webContents.on('did-finish-load', pushBarState);
    g.border.once('ready-to-show', () => g.border?.showInactive());
    g.bar.once('ready-to-show', () => g.bar?.showInactive());
    void g.border.loadURL(dataUrl(borderHtml()));
    void g.bar.loadURL(dataUrl(barHtml()));
}

/** Hides the overlays around a capture where content protection isn't reliable (macOS, see screen.ts). */
function hideOverlays(hidden: boolean) {
    for (const w of [grant?.border, grant?.bar]) if (w && !w.isDestroyed()) w.setOpacity(hidden ? 0 : 1);
}

// ---------------- IPC from the bar ----------------

export function registerControlBarIpc() {
    ipcMain.on('control-bar:action', (e, action: string) => {
        // Only the bar window may send these (it isn't the app origin, so guard() doesn't apply).
        if (!grant?.bar || grant.bar.isDestroyed() || e.sender !== grant.bar.webContents) return;
        if (action === 'pause') pause('pause_button');
        else if (action === 'handback') resume('hand_back');
        else if (action === 'stop') finish({ state: ControlStates.STOPPED, reason: 'stop_button' });
    });
    screen.on('display-removed', (_e, d) => {
        if (grant && grant.displayId === String(d.id)) finish({ state: ControlStates.STOPPED, reason: 'display_removed' });
    });
}

// ---------------- Begin / end ----------------

export async function beginControl(req: { grantId: string; displayId: string; botName: string; task: string; expiresAt: number }, getWin: () => BrowserWindow | null): Promise<{ ok: true }> {
    getMainWin = getWin;
    const grantId = String(req?.grantId ?? '').trim();
    if (!grantId || grantId.length > 200) throw new Error('Invalid grant.');
    const expiresAt = Math.min(Number(req.expiresAt), Date.now() + MAX_GRANT_MS);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('This permission has already expired.');
    const d = findDisplay(req.displayId);
    if (!d) throw new Error('That screen is not connected.');
    if (!(await controlAvailable())) throw new Error("Control my computer isn't available in this build.");

    if (process.platform === 'darwin') {
        if (!systemPreferences.isTrustedAccessibilityClient(false)) {
            systemPreferences.isTrustedAccessibilityClient(true);
            throw new Error('Allow Agent Space in System Settings → Privacy & Security → Accessibility, then try again.');
        }
        if (systemPreferences.getMediaAccessStatus('screen') !== 'granted')
            throw new Error('Allow Agent Space in System Settings → Privacy & Security → Screen Recording, then try again.');
    }

    if (grant && grant.id !== grantId) finish({ state: ControlStates.STOPPED, reason: 'replaced' });
    if (grant) finish();

    const g: Grant = {
        id: grantId,
        displayId: String(d.id),
        botName: String(req.botName ?? 'Your bot').trim().slice(0, 60) || 'Your bot',
        task: String(req.task ?? '').trim().slice(0, 300),
        expiresAt,
        state: ControlStates.RUNNING,
        timer: setTimeout(() => {
            if (grant === g) finish({ state: ControlStates.EXPIRED, reason: 'expired' });
        }, expiresAt - Date.now()),
        border: null,
        bar: null,
        minimizedMain: false,
    };
    grant = g;
    try {
        startHook();
    } catch (e) {
        finish();
        throw e;
    }
    if (!globalShortcut.register(STOP_SHORTCUT, () => finish({ state: ControlStates.STOPPED, reason: 'stop_shortcut' })))
        console.warn(`[device] couldn't register ${STOP_SHORTCUT}; the bar's Stop button still works.`);
    showOverlays(g, d);

    // Agent Space itself is a blocked app: step out of the way on the chosen screen so the bot can work.
    const main = getWin();
    if (main && !main.isDestroyed() && main.isVisible() && !main.isMinimized() && screen.getDisplayMatching(main.getBounds()).id === d.id) {
        main.minimize();
        g.minimizedMain = true;
    }
    ignoreInputUntil = Date.now() + HAND_BACK_GRACE_MS;
    return { ok: true };
}

export function endControl(grantId: string): { ok: true } {
    if (grant && grant.id === String(grantId)) finish();
    return { ok: true };
}

export function resumeControl(grantId: string): { ok: true } {
    if (!grant || grant.id !== String(grantId)) throw new Error('There is no active permission to control this computer.');
    resume('hand_back');
    return { ok: true };
}

export function stopControlOnQuit() {
    finish({ state: ControlStates.STOPPED, reason: 'app_quit' });
}

// ---------------- Actions ----------------

function toScreenPoint(pt: { x: number; y: number }, d: Display): { x: number; y: number } {
    if (process.platform === 'win32') return screen.dipToScreenPoint(pt);
    if (process.platform === 'linux') return dipToPhysical(pt, d.scaleFactor);
    return pt;
}

async function perform(req: ControlRequest, d: Display) {
    const n = nut!;
    const shot = screenshotSize(d);
    const at = (x: unknown, y: unknown, label?: string) => {
        const s = assertInShot(x, y, shot, label);
        const p = toScreenPoint(shotToDip(s.x, s.y, d, shot), d);
        return new n.Point(p.x, p.y);
    };
    const moveIfGiven = async () => {
        if (req.x !== undefined || req.y !== undefined) await n.mouse.setPosition(at(req.x, req.y));
    };

    switch (req.action) {
        case ControlActions.SCREENSHOT:
            return;
        case ControlActions.MOVE:
            await n.mouse.setPosition(at(req.x, req.y));
            return;
        case ControlActions.CLICK:
            await moveIfGiven();
            await n.mouse.click(n.Button.LEFT);
            return;
        case ControlActions.DOUBLE_CLICK:
            await moveIfGiven();
            await n.mouse.doubleClick(n.Button.LEFT);
            return;
        case ControlActions.RIGHT_CLICK:
            await moveIfGiven();
            await n.mouse.click(n.Button.RIGHT);
            return;
        case ControlActions.DRAG: {
            const from = at(req.x, req.y, 'x/y');
            const to = at(req.to_x, req.to_y, 'to_x/to_y');
            await n.mouse.setPosition(from);
            await n.mouse.pressButton(n.Button.LEFT);
            try {
                const steps = 12;
                for (let i = 1; i <= steps; i++) {
                    await n.mouse.setPosition(new n.Point(Math.round(from.x + ((to.x - from.x) * i) / steps), Math.round(from.y + ((to.y - from.y) * i) / steps)));
                    await sleep(15);
                }
            } finally {
                await n.mouse.releaseButton(n.Button.LEFT);
            }
            return;
        }
        case ControlActions.TYPE: {
            if (typeof req.text !== 'string' || !req.text) throw new Error('type needs "text".');
            if (req.text.length > MAX_TYPE_CHARS) throw new Error(`text is too long (max ${MAX_TYPE_CHARS} characters).`);
            await n.keyboard.type(req.text);
            return;
        }
        case ControlActions.KEY: {
            const byName = n.Key as unknown as Record<string, Parameters<typeof n.keyboard.pressKey>[0] | undefined>;
            const keys = parseKeyCombo(req.keys ?? '').map((name) => {
                const k = byName[name];
                if (k === undefined) throw new Error(`Unsupported key: ${name}`);
                return k;
            });
            try {
                await n.keyboard.pressKey(...keys);
            } finally {
                await n.keyboard.releaseKey(...keys.slice().reverse());
            }
            return;
        }
        case ControlActions.SCROLL: {
            const amount = Math.trunc(Number(req.amount ?? 0));
            if (!amount) throw new Error('scroll needs a non-zero "amount" (positive = down).');
            await moveIfGiven();
            const steps = Math.min(MAX_SCROLL, Math.abs(amount));
            if (amount > 0) await n.mouse.scrollDown(steps);
            else await n.mouse.scrollUp(steps);
            return;
        }
        case ControlActions.WAIT:
            await sleep(Math.max(0, Math.min(MAX_WAIT_MS, Number(req.ms ?? 1000) || 0)));
            return;
        default:
            throw new Error(`Unknown action: ${String((req as { action?: unknown })?.action)}`);
    }
}

function refused(error: string, frontAppName: string | null = null): ControlResult {
    return { ok: false, screenshot: placeholderImage(), frontApp: frontAppName, error };
}

async function blockedCheck(): Promise<{ front: FrontApp | null; blocked: string | null }> {
    const front = await frontApp();
    const blocked = matchBlockedApp(front, (await readDevice()).blockedApps, selfPids());
    return { front, blocked };
}

function blockedResult(front: FrontApp | null, blocked: string): ControlResult {
    const name = front?.name || blocked;
    pause('blocked_app', `Switch away from ${name}, then hand back`);
    return refused(`${name} is in front, and bots can't use it (blocked app: ${blocked}). Ask the user to switch to another app and hand back control.`, front?.name ?? null);
}

export async function control(grantId: string, req: ControlRequest): Promise<ControlResult> {
    const g = grant;
    if (!g || g.id !== String(grantId)) throw new Error('There is no active permission to control this computer. Ask the user again.');
    if (Date.now() >= g.expiresAt) {
        finish({ state: ControlStates.EXPIRED, reason: 'expired' });
        throw new Error('Permission to control this computer has expired. Ask the user again.');
    }
    if (g.state !== ControlStates.RUNNING) return refused(g.note ? `Paused: ${g.note}.` : 'The user has taken control. Wait until they hand back.');
    if (actionInFlight) throw new Error('Another action is still running.');
    const d = findDisplay(g.displayId);
    if (!d) {
        finish({ state: ControlStates.STOPPED, reason: 'display_removed' });
        throw new Error('The chosen screen is no longer connected.');
    }

    const before = await blockedCheck();
    if (before.blocked) return blockedResult(before.front, before.blocked);

    let error: string | undefined;
    const acts = req?.action !== ControlActions.SCREENSHOT && req?.action !== ControlActions.WAIT;
    actionInFlight = true;
    busy = true;
    if (g.bar && !g.bar.isDestroyed()) g.bar.setIgnoreMouseEvents(true);
    try {
        await perform(req ?? ({} as ControlRequest), d);
    } catch (e) {
        error = (e as Error).message;
    } finally {
        lastSyntheticAt = Date.now();
        busy = false;
        actionInFlight = false;
        if (g.bar && !g.bar.isDestroyed()) g.bar.setIgnoreMouseEvents(false);
    }
    if (acts && !error) await sleep(SETTLE_MS);

    if (grant !== g) throw new Error('Control was stopped.');
    if (g.state !== ControlStates.RUNNING) return refused('The user has taken control. Wait until they hand back.');
    const after = await blockedCheck();
    if (after.blocked) return blockedResult(after.front, after.blocked);
    const screenshot = await captureDisplay(d, hideOverlays);
    return { ok: !error, screenshot, frontApp: after.front?.name ?? null, ...(error ? { error } : {}) };
}
