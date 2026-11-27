/**
 * Browser tool helpers (§14.3) that need no Electron, so they can be tested on their own. Pure.
 */

export const BROWSER_MAX_WAIT_MS = 5000;
export const BROWSER_MAX_TYPE_CHARS = 5000;
export const BROWSER_MAX_SCROLL_SCREENS = 10;

/** Only web pages can be opened in the bot's browser: no file:, chrome:, devtools:, data: or javascript: addresses. */
export function assertBrowsableUrl(raw: unknown): string {
    const text = String(raw ?? '').trim();
    if (!text) throw new Error('open needs a "url".');
    let u: URL;
    try {
        u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    } catch {
        throw new Error('That is not a valid web address.');
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http and https pages can be opened in the browser.');
    if (u.username || u.password) throw new Error('Addresses with a user name or password in them are not allowed.');
    return u.toString();
}

export function isWebUrl(raw: string): boolean {
    try {
        const u = new URL(raw);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

export interface FieldInfo {
    tag?: string;
    type?: string;
    autocomplete?: string;
    name?: string;
    id?: string;
}

/**
 * Fields the bot must never type into: passwords, card details and one-time codes. The person types those themselves
 * in the browser window. Checked in the main process on the real focused field, whatever the bot asked for.
 */
export function isSecretField(f: FieldInfo | null | undefined): boolean {
    if (!f) return false;
    const type = String(f.type ?? '').toLowerCase();
    const auto = String(f.autocomplete ?? '').toLowerCase();
    const label = `${f.name ?? ''} ${f.id ?? ''}`;
    if (type === 'password') return true;
    if (/(^|\s)(cc-|one-time-code|current-password|new-password)/.test(auto)) return true;
    return /passw|passcode|\bcvv\b|\bcvc\b|card[-_ ]?(number|num|no)|\botp\b|security[-_ ]?code/i.test(label);
}

/** One key press for Input.dispatchKeyEvent (Chrome DevTools protocol). */
export interface CdpKey {
    key: string;
    code: string;
    /** Windows virtual key code. */
    vk: number;
    /** Text the key types, when it types any (not with ctrl/alt/meta held). */
    text?: string;
    /** Bit mask: alt 1, ctrl 2, meta 4, shift 8. */
    modifiers: number;
    /** Editing commands Chrome runs for shortcuts it won't run from synthetic events (select all, copy…). */
    commands?: string[];
}

const NAMED: Record<string, { key: string; code: string; vk: number; text?: string }> = {
    enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
    return: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
    tab: { key: 'Tab', code: 'Tab', vk: 9 },
    esc: { key: 'Escape', code: 'Escape', vk: 27 },
    escape: { key: 'Escape', code: 'Escape', vk: 27 },
    backspace: { key: 'Backspace', code: 'Backspace', vk: 8 },
    delete: { key: 'Delete', code: 'Delete', vk: 46 },
    del: { key: 'Delete', code: 'Delete', vk: 46 },
    space: { key: ' ', code: 'Space', vk: 32, text: ' ' },
    up: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
    arrowup: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
    arrowdown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
    arrowleft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
    arrowright: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
    home: { key: 'Home', code: 'Home', vk: 36 },
    end: { key: 'End', code: 'End', vk: 35 },
    pageup: { key: 'PageUp', code: 'PageUp', vk: 33 },
    pagedown: { key: 'PageDown', code: 'PageDown', vk: 34 },
    pgup: { key: 'PageUp', code: 'PageUp', vk: 33 },
    pgdn: { key: 'PageDown', code: 'PageDown', vk: 34 },
};

const MOD = { alt: 1, control: 2, meta: 4, shift: 8 } as const;
const SHORTCUT_COMMANDS: Record<string, string> = { a: 'selectAll', c: 'copy', x: 'cut', v: 'paste', z: 'undo', y: 'redo' };

/** "ctrl+a", "Enter", "cmd+shift+t" → a CDP key press. "cmd" is Command on macOS and Ctrl elsewhere. */
export function toCdpKey(combo: unknown, platform: NodeJS.Platform = process.platform): CdpKey {
    const raw = String(combo ?? '').trim();
    if (!raw) throw new Error('key needs "keys", e.g. "Enter" or "ctrl+a".');
    const parts = raw.length > 1 ? raw.split(/\+(?!$)/).map((s) => s.trim()) : [raw];
    if (parts.length > 4) throw new Error(`Too many keys in "${raw}".`);
    let modifiers = 0;
    let main: { key: string; code: string; vk: number; text?: string } | null = null;
    let letter: string | null = null;
    for (const part of parts) {
        const k = part.toLowerCase();
        if (k === 'ctrl' || k === 'control') modifiers |= MOD.control;
        else if (k === 'shift') modifiers |= MOD.shift;
        else if (k === 'alt' || k === 'option' || k === 'opt') modifiers |= MOD.alt;
        else if (k === 'cmd' || k === 'command') modifiers |= platform === 'darwin' ? MOD.meta : MOD.control;
        else if (k === 'meta' || k === 'win' || k === 'super' || k === 'windows') modifiers |= MOD.meta;
        else if (main) throw new Error(`Only one non-modifier key is allowed in "${raw}".`);
        else if (NAMED[k]) main = NAMED[k];
        else if (/^f([1-9]|1[0-2])$/.test(k)) main = { key: part.toUpperCase(), code: part.toUpperCase(), vk: 111 + Number(k.slice(1)) };
        else if (/^[a-z]$/.test(k)) {
            letter = k;
            main = { key: k, code: `Key${k.toUpperCase()}`, vk: k.toUpperCase().charCodeAt(0), text: k };
        } else if (/^[0-9]$/.test(k)) main = { key: k, code: `Digit${k}`, vk: 48 + Number(k), text: k };
        else if (part.length === 1) main = { key: part, code: '', vk: part.toUpperCase().charCodeAt(0), text: part };
        else throw new Error(`Unknown key "${part}" in "${raw}".`);
    }
    if (!main) throw new Error(`"${raw}" has only modifier keys.`);
    const shortcut = !!(modifiers & (MOD.control | MOD.meta | MOD.alt));
    const shifted = modifiers & MOD.shift && letter ? main.key.toUpperCase() : main.key;
    return {
        key: shifted,
        code: main.code,
        vk: main.vk,
        text: shortcut ? undefined : modifiers & MOD.shift && letter ? shifted : main.text,
        modifiers,
        ...(letter && modifiers & (MOD.control | MOD.meta) && SHORTCUT_COMMANDS[letter] ? { commands: [SHORTCUT_COMMANDS[letter]] } : {}),
    };
}

/** Maps a position in the screenshot the bot saw to a position in the page (CSS pixels). */
export function shotToPage(x: unknown, y: unknown, shot: { width: number; height: number }, page: { width: number; height: number }): { x: number; y: number } {
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error('x and y must be numbers.');
    if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) throw new Error(`(${x}, ${y}) is outside the screenshot (${shot.width}×${shot.height}).`);
    return { x: Math.round((x / shot.width) * page.width), y: Math.round((y / shot.height) * page.height) };
}
