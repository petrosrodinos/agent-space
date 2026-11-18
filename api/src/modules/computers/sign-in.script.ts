import { BROWSER_DEBUG_PORT } from './computers.service';

/** Which parts of a saved website login the sign-in helper types (computer_sign_in `fields`). */
export const SignInFields = {
    USERNAME_AND_PASSWORD: 'username_and_password',
    USERNAME: 'username',
    PASSWORD: 'password',
    TWO_STEP_CODE: 'two_step_code',
} as const;
export type SignInField = (typeof SignInFields)[keyof typeof SignInFields];

/** Field kinds the helper looks for on the page, in order, for each request. */
export const SIGN_IN_STEPS: Record<SignInField, ('username' | 'password' | 'code')[]> = {
    [SignInFields.USERNAME_AND_PASSWORD]: ['username', 'password'],
    [SignInFields.USERNAME]: ['username'],
    [SignInFields.PASSWORD]: ['password'],
    [SignInFields.TWO_STEP_CODE]: ['code'],
};

/** Error codes the helper prints; the tool turns them into guidance for the model. */
export const SignInErrors = {
    NO_BROWSER: 'no_browser',
    NO_PAGE: 'no_page',
    WRONG_SITE: 'wrong_site',
    NOT_HTTPS: 'not_https',
    FIELD_NOT_FOUND: 'field_not_found',
    IN_FRAME: 'in_frame',
    NOT_TYPED: 'not_typed',
    FAILED: 'failed',
} as const;
export type SignInError = (typeof SignInErrors)[keyof typeof SignInErrors];

export interface SignInScriptInput {
    domain: string;
    steps: { kind: 'username' | 'password' | 'code'; text: string }[];
    submit: boolean;
}

export interface SignInScriptResult {
    ok: boolean;
    host?: string;
    filled?: string[];
    missing?: string;
    submitted?: boolean;
    error?: SignInError;
}

/**
 * Runs inside the bot's cloud computer (Node 24, global WebSocket). Reads its input file and deletes it at once, finds the
 * browser's active tab over the local DevTools port, refuses unless that tab is https on the login's own site (or a
 * subdomain), then fills the fields with real input events. Prints JSON without any of the typed values.
 * Only the top-level page is filled: a login form inside a frame from another site is never typed into.
 */
export const SIGN_IN_SCRIPT = String.raw`
const fs = require('fs');
const PORT = ${BROWSER_DEBUG_PORT};
const inputPath = process.argv[2];
let input;
try { input = JSON.parse(fs.readFileSync(inputPath, 'utf8')); } finally { try { fs.unlinkSync(inputPath); } catch (e) {} }
const done = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
const hostOk = (h) => { h = String(h || '').toLowerCase().replace(/\.$/, ''); const d = input.domain.toLowerCase(); return h === d || h.endsWith('.' + d); };

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0; const pending = new Map();
    ws.onmessage = (e) => { const m = JSON.parse(e.data); const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); };
    ws.onerror = () => reject(new Error('connect'));
    ws.onopen = () => resolve({
      send: (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); }),
      close: () => { try { ws.close(); } catch (e) {} },
    });
  });
}
async function evaluate(c, expression) {
  const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('evaluate');
  return r.result.value;
}

const FIND = function (kind) {
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.disabled && !el.readOnly; };
  const type = (el) => (el.getAttribute('type') || 'text').toLowerCase();
  const hint = (el) => [el.name, el.id, el.getAttribute('autocomplete'), el.getAttribute('aria-label'), el.getAttribute('placeholder')].join(' ').toLowerCase();
  const inputs = Array.from(document.querySelectorAll('input')).filter(visible);
  const active = document.activeElement;
  if (active && active.tagName === 'IFRAME') return 'frame';
  const activeInput = active && active.tagName === 'INPUT' && visible(active) ? active : null;
  let el = null;
  if (kind === 'password') {
    el = activeInput && type(activeInput) === 'password' ? activeInput : inputs.find((i) => type(i) === 'password');
  } else if (kind === 'username') {
    const textual = (i) => ['text', 'email', 'tel'].includes(type(i));
    const looksLikeUser = (i) => textual(i) && /user|email|login|account|identifier|phone/.test(hint(i) + ' ' + type(i));
    if (activeInput && textual(activeInput)) el = activeInput;
    else el = inputs.find((i) => i.getAttribute('autocomplete') === 'username') || inputs.find(looksLikeUser);
    if (!el) { const pwd = inputs.findIndex((i) => type(i) === 'password'); if (pwd > 0) el = inputs.slice(0, pwd).reverse().find(textual) || null; }
  } else {
    const codeLike = (i) => ['text', 'tel', 'number'].includes(type(i)) && (i.getAttribute('autocomplete') === 'one-time-code' || /otp|totp|code|2fa|mfa|token|verif|pin/.test(hint(i)));
    el = activeInput && codeLike(activeInput) ? activeInput : inputs.find(codeLike) || (activeInput && ['text', 'tel', 'number'].includes(type(activeInput)) ? activeInput : null);
  }
  if (!el) return 'missing';
  el.focus();
  try { el.select(); } catch (e) {}
  return 'ok';
};
const LOCATION = '({ host: location.hostname, protocol: location.protocol })';

(async () => {
  let pages;
  try { pages = (await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()).filter((t) => t.type === 'page' && t.webSocketDebuggerUrl && /^https?:/.test(t.url)); }
  catch (e) { return done({ ok: false, error: '${SignInErrors.NO_BROWSER}' }); }
  if (!pages.length) return done({ ok: false, error: '${SignInErrors.NO_PAGE}' });

  // The tab the person sees: the one whose document has focus, else the visible one, else the most recently active.
  let chosen = null; let fallback = null;
  for (const p of pages.slice(0, 15)) {
    let c;
    try { c = await connect(p.webSocketDebuggerUrl); } catch (e) { continue; }
    const st = await evaluate(c, '({ focus: document.hasFocus(), visible: document.visibilityState === "visible" })').catch(() => null);
    if (st && st.focus) { chosen = c; break; }
    if (st && st.visible && !fallback) { fallback = c; continue; }
    c.close();
  }
  const c = chosen || fallback;
  if (!c) return done({ ok: false, error: '${SignInErrors.NO_PAGE}' });

  const filled = [];
  for (const step of input.steps) {
    const loc = await evaluate(c, LOCATION);
    if (!hostOk(loc.host)) return done({ ok: false, host: loc.host, filled, error: '${SignInErrors.WRONG_SITE}' });
    if (loc.protocol !== 'https:') return done({ ok: false, host: loc.host, filled, error: '${SignInErrors.NOT_HTTPS}' });
    const found = await evaluate(c, '(' + FIND.toString() + ')(' + JSON.stringify(step.kind) + ')');
    if (found === 'frame') return done({ ok: false, host: loc.host, filled, error: '${SignInErrors.IN_FRAME}' });
    if (found !== 'ok') {
      if (!filled.length) return done({ ok: false, host: loc.host, filled, missing: step.kind, error: '${SignInErrors.FIELD_NOT_FOUND}' });
      if (input.submit) await pressEnter(c);
      return done({ ok: true, host: loc.host, filled, missing: step.kind, submitted: input.submit });
    }
    await c.send('Input.insertText', { text: step.text });
    const length = await evaluate(c, '(document.activeElement && typeof document.activeElement.value === "string") ? document.activeElement.value.length : -1');
    if (length !== step.text.length) return done({ ok: false, host: loc.host, filled, error: '${SignInErrors.NOT_TYPED}' });
    filled.push(step.kind);
  }
  if (input.submit) await pressEnter(c);
  const loc = await evaluate(c, LOCATION).catch(() => ({ host: input.domain }));
  done({ ok: true, host: loc.host, filled, submitted: input.submit });
})().catch(() => done({ ok: false, error: '${SignInErrors.FAILED}' }));

async function pressEnter(c) {
  const key = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
  await c.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown', text: '\r' }, key));
  await c.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, key));
}
`;
