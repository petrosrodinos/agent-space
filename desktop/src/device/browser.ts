/**
 * Browser tool (§14.3), main-process side.
 *
 * The bot gets its own browser window with its own saved sign-ins (the "persist:agentspace-bot-browser" session). It never
 * touches the person's normal browser profile, cookies or passwords, and it has no access to Agent Space's own session.
 *
 * - The window is visible: the person can watch, scroll, or sign in themselves (passwords are never typed by the bot).
 * - Pages are described to the bot as numbered elements (links, buttons, fields) plus the visible text, so it works
 *   without a vision model; a screenshot is added for models that can see.
 * - Clicks and keys are real input events (DevTools protocol Input.*), so sites treat them like a person's.
 * - Typing into password, card or one-time-code fields is refused here, on the real focused field.
 * - Only http(s) pages open; downloads, permission prompts (camera, location…) and extra windows are blocked.
 */
import { app, BrowserWindow, screen, session, type Session, type WebContents } from 'electron';
import { assertBrowsableUrl, BROWSER_MAX_SCROLL_SCREENS, BROWSER_MAX_TYPE_CHARS, BROWSER_MAX_WAIT_MS, isSecretField, isWebUrl, shotToPage, toCdpKey, type CdpKey, type FieldInfo } from './browser-logic';
import { BrowserActions, type BrowserElement, type BrowserRequest, type BrowserResult, type CapturedImage } from './types';

export const BOT_BROWSER_PARTITION = 'persist:agentspace-bot-browser';
const WINDOW_TITLE = 'Agent Space - bot browser';
const SHOT_MAX_WIDTH = 1280;
const LOAD_TIMEOUT_MS = 20_000;
const SETTLE_MS = 350;
const MAX_ELEMENTS = 70;
const MAX_TEXT = 4000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** True for the bot browser's web contents, so main.ts's "keep the app on its own pages" rules leave it alone. */
export function isBotBrowserSession(s: Session): boolean {
    return s === session.fromPartition(BOT_BROWSER_PARTITION);
}

// ---------------- Page scripts ----------------

/** Numbers the clickable things on the page (data-as-ref) and reports them with the visible text. Runs in the page. */
const SNAPSHOT_JS = `(() => {
  const SEL = 'a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="tab"],[role="menuitem"],[role="switch"],[role="combobox"],[role="option"],[contenteditable=""],[contenteditable="true"],[onclick]';
  document.querySelectorAll('[data-as-ref]').forEach((e) => e.removeAttribute('data-as-ref'));
  const vw = window.innerWidth, vh = window.innerHeight;
  const clean = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
  const labelOf = (el) => {
    const aria = clean(el.getAttribute('aria-label'));
    if (aria) return aria.slice(0, 90);
    if (el.labels && el.labels[0]) { const l = clean(el.labels[0].innerText); if (l) return l.slice(0, 90); }
    const own = clean(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ? '' : el.innerText);
    return (own || clean(el.placeholder) || clean(el.title) || clean(el.alt) || clean(el.name) || clean(el.getAttribute('value') && el.type !== 'password' ? el.getAttribute('value') : '')).slice(0, 90);
  };
  const kindOf = (el) => {
    const t = el.tagName, role = el.getAttribute('role');
    if (t === 'A' || role === 'link') return 'link';
    if (t === 'SELECT' || role === 'combobox') return 'dropdown';
    if (t === 'TEXTAREA' || el.isContentEditable) return 'field';
    if (t === 'INPUT') {
      const ty = (el.type || 'text').toLowerCase();
      if (ty === 'checkbox') return 'checkbox';
      if (ty === 'radio') return 'radio';
      if (['submit', 'button', 'reset', 'image'].includes(ty)) return 'button';
      if (ty === 'password') return 'password field';
      return ty === 'text' ? 'field' : ty + ' field';
    }
    if (role === 'checkbox' || role === 'switch') return 'checkbox';
    if (role === 'tab') return 'tab';
    return 'button';
  };
  const found = [];
  for (const el of document.querySelectorAll(SEL)) {
    if (el.disabled || el.type === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const inView = r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
    found.push({ el, inView, top: r.top });
  }
  found.sort((a, b) => (a.inView === b.inView ? a.top - b.top : a.inView ? -1 : 1));
  const elements = [];
  let offscreen = 0;
  for (const f of found) {
    if (elements.length >= ${MAX_ELEMENTS}) break;
    if (!f.inView && ++offscreen > 15) break;
    const el = f.el, ref = elements.length + 1;
    el.setAttribute('data-as-ref', String(ref));
    const item = { ref, kind: kindOf(el), label: labelOf(el) };
    if (el.tagName === 'A' && el.href) item.href = el.href.slice(0, 160);
    if (el.type === 'checkbox' || el.type === 'radio') item.value = el.checked ? 'checked' : 'not checked';
    else if (el.tagName === 'SELECT') item.value = clean(el.options[el.selectedIndex] && el.options[el.selectedIndex].text).slice(0, 60);
    else if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.type !== 'password' && el.value) item.value = String(el.value).slice(0, 60);
    if (!f.inView) item.label = (item.label ? item.label + ' ' : '') + '(below or above the visible part)';
    elements.push(item);
  }
  const text = (document.body ? document.body.innerText : '').replace(/\\n{3,}/g, '\\n\\n').trim().slice(0, ${MAX_TEXT});
  return { title: document.title || '', url: location.href, text, elements, page: { width: vw, height: vh }, scroll: { y: Math.round(window.scrollY), max: Math.max(0, Math.round(document.documentElement.scrollHeight - vh)) } };
})()`;

const clickRefJs = (ref: number) => `(() => {
  const el = document.querySelector('[data-as-ref="${ref}"]');
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), tag: el.tagName, type: (el.type || '').toLowerCase() };
})()`;

/** Picks an option of a native dropdown by its visible text (native popups can't be clicked). */
const selectOptionJs = (ref: number, text: string) => `(() => {
  const el = document.querySelector('[data-as-ref="${ref}"]');
  if (!el || el.tagName !== 'SELECT') return null;
  const want = ${JSON.stringify(text)}.trim().toLowerCase();
  const opt = [...el.options].find((o) => o.text.trim().toLowerCase() === want) || [...el.options].find((o) => o.text.trim().toLowerCase().includes(want));
  if (!opt) return { ok: false, options: [...el.options].slice(0, 30).map((o) => o.text.trim()) };
  el.value = opt.value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
})()`;

const ACTIVE_FIELD_JS = `(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  return { tag: a.tagName, type: (a.type || '').toLowerCase(), autocomplete: a.getAttribute('autocomplete') || '', name: a.getAttribute('name') || '', id: a.id || '' };
})()`;

/** Selects what is in the focused field, so typing replaces it instead of adding to it. */
const SELECT_ACTIVE_JS = `(() => {
  const a = document.activeElement;
  if (!a) return;
  if (typeof a.select === 'function') a.select();
  else if (a.isContentEditable) document.execCommand('selectAll');
})()`;

// ---------------- Window ----------------

let win: BrowserWindow | null = null;
/** Page size (CSS pixels) and screenshot size at the last screenshot, to map the bot's x/y back to the page. */
let lastPage = { width: 1280, height: 800 };
let lastShot = { width: 1280, height: 800 };
let sessionReady = false;

function hardenBotSession() {
    if (sessionReady) return;
    sessionReady = true;
    const ses = session.fromPartition(BOT_BROWSER_PARTITION);
    ses.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
    ses.setPermissionCheckHandler(() => false);
    ses.on('will-download', (e) => e.preventDefault());
}

function attachGuards(wc: WebContents) {
    wc.setWindowOpenHandler(({ url }) => {
        // Pop-ups and "open in new tab" links load in the same window, so the bot always has one page to work with.
        if (isWebUrl(url)) void wc.loadURL(url).catch(() => undefined);
        return { action: 'deny' };
    });
    const web = (ev: Electron.Event, url: string) => {
        if (!isWebUrl(url)) ev.preventDefault();
    };
    wc.on('will-navigate', (ev, url) => web(ev, url));
    wc.on('will-redirect', (ev, url) => web(ev, url));
    wc.on('will-attach-webview', (ev) => ev.preventDefault());
    // Screenshots and input go through the DevTools protocol: unlike capturePage and sendInputEvent it works even while
    // other windows cover this one. It also answers JavaScript alert/confirm/prompt, which would otherwise freeze the page.
    wc.debugger.attach('1.3');
    wc.debugger.on('message', (_e, method, params: { type?: string }) => {
        if (method !== 'Page.javascriptDialogOpening') return;
        const accept = params?.type === 'alert' || params?.type === 'beforeunload';
        void wc.debugger.sendCommand('Page.handleJavaScriptDialog', { accept }).catch(() => undefined);
    });
    void wc.debugger.sendCommand('Page.enable').catch(() => undefined);
    // The page behaves as if its window is focused, so fields take focus and key presses even when the window is behind others.
    void wc.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined);
}

function ensureWindow(): BrowserWindow {
    if (win && !win.isDestroyed()) return win;
    hardenBotSession();
    const work = screen.getPrimaryDisplay().workAreaSize;
    win = new BrowserWindow({
        width: Math.min(1280, Math.max(640, work.width - 80)),
        height: Math.min(860, Math.max(480, work.height - 80)),
        useContentSize: true,
        title: WINDOW_TITLE,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#FFFFFF',
        webPreferences: { partition: BOT_BROWSER_PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false },
    });
    win.on('page-title-updated', (e) => e.preventDefault());
    win.on('closed', () => {
        win = null;
    });
    attachGuards(win.webContents);
    win.showInactive();
    return win;
}

export function closeBotBrowser() {
    if (win && !win.isDestroyed()) win.destroy();
    win = null;
}

app.on('before-quit', closeBotBrowser);

// ---------------- Page helpers ----------------

async function waitForLoad(wc: WebContents, timeoutMs = LOAD_TIMEOUT_MS) {
    const until = Date.now() + timeoutMs;
    await sleep(SETTLE_MS);
    while (wc.isLoading() && Date.now() < until) await sleep(120);
    await sleep(SETTLE_MS);
}

async function runInPage<T>(wc: WebContents, js: string): Promise<T> {
    return (await wc.executeJavaScript(js, true)) as T;
}

const cdp = <T = unknown>(wc: WebContents, method: string, params?: Record<string, unknown>) => wc.debugger.sendCommand(method, params) as Promise<T>;

async function screenshot(wc: WebContents): Promise<CapturedImage | null> {
    try {
        const scale = Math.min(1, SHOT_MAX_WIDTH / lastPage.width);
        const { data } = await cdp<{ data: string }>(wc, 'Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: lastPage.width, height: lastPage.height, scale } });
        if (!data) return null;
        const width = Math.max(1, Math.round(lastPage.width * scale));
        const height = Math.max(1, Math.round(lastPage.height * scale));
        lastShot = { width, height };
        return { dataUrl: `data:image/png;base64,${data}`, width, height };
    } catch (e) {
        console.warn('[device] browser screenshot failed:', (e as Error).message);
        return null;
    }
}

interface PageSnapshot {
    title: string;
    url: string;
    text: string;
    elements: BrowserElement[];
    page: { width: number; height: number };
    scroll: { y: number; max: number };
}

async function describe(wc: WebContents, extra: { ok?: boolean; error?: string } = {}): Promise<BrowserResult> {
    let snap: PageSnapshot | null = null;
    try {
        snap = await runInPage<PageSnapshot>(wc, SNAPSHOT_JS);
    } catch {
        snap = null;
    }
    if (snap) lastPage = snap.page;
    const shot = await screenshot(wc);
    let text = snap?.text ?? '';
    if (snap && snap.scroll.max > 0) text = `${text}\n\n[Scrolled ${snap.scroll.y}px of ${snap.scroll.max}px]`.trim();
    return {
        ok: extra.ok ?? true,
        url: snap?.url ?? wc.getURL(),
        title: snap?.title ?? wc.getTitle(),
        text,
        elements: snap?.elements ?? [],
        screenshot: shot,
        ...(extra.error ? { error: extra.error } : {}),
    };
}

async function clickAt(wc: WebContents, x: number, y: number) {
    const base = { x, y, button: 'left', clickCount: 1 };
    await cdp(wc, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await sleep(40);
    await cdp(wc, 'Input.dispatchMouseEvent', { ...base, type: 'mousePressed' });
    await sleep(40);
    await cdp(wc, 'Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' });
}

async function pressKey(wc: WebContents, k: CdpKey) {
    const common = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk, modifiers: k.modifiers };
    await cdp(wc, 'Input.dispatchKeyEvent', { ...common, type: k.text ? 'keyDown' : 'rawKeyDown', ...(k.text ? { text: k.text, unmodifiedText: k.text } : {}), ...(k.commands ? { commands: k.commands } : {}) });
    await cdp(wc, 'Input.dispatchKeyEvent', { ...common, type: 'keyUp' });
}

/** Where a click goes: the element's centre for a ref, or the bot's position in the screenshot. */
async function target(wc: WebContents, req: BrowserRequest): Promise<{ x: number; y: number; tag?: string } | null> {
    if (req.ref !== undefined && req.ref !== null) {
        const ref = Math.floor(Number(req.ref));
        if (!Number.isFinite(ref) || ref < 1) throw new Error('ref must be an element number from the latest snapshot.');
        const at = await runInPage<{ x: number; y: number; tag: string } | null>(wc, clickRefJs(ref));
        if (!at) throw new Error(`There is no element ${ref} on this page any more. Use the snapshot action to get fresh numbers.`);
        return at;
    }
    if (req.x !== undefined && req.y !== undefined) return shotToPage(req.x, req.y, lastShot, lastPage);
    return null;
}

async function assertNotSecret(wc: WebContents) {
    const field = await runInPage<FieldInfo | null>(wc, ACTIVE_FIELD_JS);
    if (isSecretField(field)) throw new Error('This is a password, card or code field. Never type it: ask the person to enter it themselves in the browser window, then continue.');
}

// ---------------- Actions ----------------

export async function runBrowser(req: BrowserRequest): Promise<BrowserResult> {
    const action = req?.action;
    if (action === BrowserActions.CLOSE) {
        closeBotBrowser();
        return { ok: true, url: '', title: '', text: 'The browser window was closed.', elements: [], screenshot: null };
    }
    if (action === BrowserActions.OPEN) {
        const url = assertBrowsableUrl(req.url);
        const w = ensureWindow();
        const wc = w.webContents;
        let error: string | undefined;
        try {
            await Promise.race([wc.loadURL(url), sleep(LOAD_TIMEOUT_MS).then(() => { throw new Error('The page took too long to load.'); })]);
        } catch (e) {
            const msg = (e as Error).message || '';
            // ERR_ABORTED (-3) is a redirect or a download starting, not a failure.
            if (!/ERR_ABORTED/.test(msg)) error = /ERR_NAME_NOT_RESOLVED/.test(msg) ? 'That address could not be found.' : /ERR_INTERNET_DISCONNECTED|ERR_CONNECTION/.test(msg) ? 'The page could not be reached.' : msg.slice(0, 200);
        }
        await waitForLoad(wc, 8000);
        return describe(wc, error ? { ok: false, error } : {});
    }

    if (!win || win.isDestroyed()) throw new Error('The browser is not open. Use the open action with a web address first.');
    const wc = win.webContents;

    switch (action) {
        case BrowserActions.SNAPSHOT:
            return describe(wc);

        case BrowserActions.CLICK: {
            const at = await target(wc, req);
            if (!at) throw new Error('click needs "ref" (an element number) or "x" and "y".');
            await clickAt(wc, at.x, at.y);
            await waitForLoad(wc, 10_000);
            return describe(wc);
        }

        case BrowserActions.TYPE: {
            const text = String(req.text ?? '');
            if (text.length > BROWSER_MAX_TYPE_CHARS) throw new Error(`Type at most ${BROWSER_MAX_TYPE_CHARS} characters at a time.`);
            const at = await target(wc, req);
            // A native dropdown can't be clicked open in a headless-style capture: choose by its visible text.
            if (at?.tag === 'SELECT' && req.ref !== undefined) {
                const r = await runInPage<{ ok: boolean; options?: string[] } | null>(wc, selectOptionJs(Math.floor(Number(req.ref)), text));
                if (!r?.ok) throw new Error(`No option matches "${text}".${r?.options ? ` Options: ${r.options.join(' | ')}` : ''}`);
                await sleep(SETTLE_MS);
                return describe(wc);
            }
            if (at) {
                await clickAt(wc, at.x, at.y);
                await sleep(120);
            }
            await assertNotSecret(wc);
            if (text) {
                await runInPage(wc, SELECT_ACTIVE_JS);
                await cdp(wc, 'Input.insertText', { text });
            }
            if (req.press_enter) {
                await pressKey(wc, toCdpKey('Enter'));
                await waitForLoad(wc, 10_000);
            } else await sleep(SETTLE_MS);
            return describe(wc);
        }

        case BrowserActions.KEY: {
            const key = toCdpKey(req.keys);
            // Shortcuts like ctrl+v would paste into a password field without "typing" it; keep those fields off-limits too.
            if (key.modifiers || key.text) await assertNotSecret(wc);
            await pressKey(wc, key);
            await waitForLoad(wc, 8000);
            return describe(wc);
        }

        case BrowserActions.SCROLL: {
            const screens = Math.min(Math.max(Number(req.amount) || 1, 0.1), BROWSER_MAX_SCROLL_SCREENS);
            const sign = req.direction === 'up' ? -1 : 1;
            await runInPage(wc, `window.scrollBy({ top: ${sign} * Math.round(window.innerHeight * ${screens} * 0.9), behavior: 'instant' })`);
            await sleep(SETTLE_MS);
            return describe(wc);
        }

        case BrowserActions.BACK: {
            if (!wc.navigationHistory.canGoBack()) throw new Error('There is no earlier page to go back to.');
            wc.navigationHistory.goBack();
            await waitForLoad(wc, 10_000);
            return describe(wc);
        }

        case BrowserActions.WAIT: {
            await sleep(Math.min(Math.max(Number(req.ms) || 1000, 100), BROWSER_MAX_WAIT_MS));
            return describe(wc);
        }

        default:
            throw new Error(`Unknown browser action: ${String(action)}`);
    }
}
