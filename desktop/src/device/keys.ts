/**
 * Parses key combos from the bot ("Enter", "ctrl+c", "cmd+shift+t") into nut-js Key enum member names. Pure.
 * "cmd"/"command" means Command on macOS and Ctrl elsewhere (bots often say cmd+c regardless of OS); "win"/"super"/"meta"
 * means the Windows key (Command on macOS).
 */

const ALIASES: Record<string, string> = {
    enter: 'Enter',
    return: 'Return',
    tab: 'Tab',
    esc: 'Escape',
    escape: 'Escape',
    backspace: 'Backspace',
    delete: 'Delete',
    del: 'Delete',
    insert: 'Insert',
    space: 'Space',
    up: 'Up',
    down: 'Down',
    left: 'Left',
    right: 'Right',
    arrowup: 'Up',
    arrowdown: 'Down',
    arrowleft: 'Left',
    arrowright: 'Right',
    home: 'Home',
    end: 'End',
    pageup: 'PageUp',
    pagedown: 'PageDown',
    pgup: 'PageUp',
    pgdn: 'PageDown',
    capslock: 'CapsLock',
    ctrl: 'LeftControl',
    control: 'LeftControl',
    shift: 'LeftShift',
    alt: 'LeftAlt',
    option: 'LeftAlt',
    opt: 'LeftAlt',
    minus: 'Minus',
    '-': 'Minus',
    equal: 'Equal',
    equals: 'Equal',
    '=': 'Equal',
    plus: 'Equal',
    comma: 'Comma',
    ',': 'Comma',
    period: 'Period',
    '.': 'Period',
    slash: 'Slash',
    '/': 'Slash',
    backslash: 'Backslash',
    '\\': 'Backslash',
    semicolon: 'Semicolon',
    ';': 'Semicolon',
    quote: 'Quote',
    "'": 'Quote',
    '`': 'Grave',
    grave: 'Grave',
    '[': 'LeftBracket',
    ']': 'RightBracket',
    menu: 'Menu',
    printscreen: 'Print',
};

const MAX_KEYS = 5;

export function parseKeyCombo(combo: string, platform: NodeJS.Platform = process.platform): string[] {
    const raw = String(combo ?? '').trim();
    if (!raw) throw new Error('key needs "keys", e.g. "Enter" or "ctrl+c".');
    // "ctrl++" → ["ctrl", "+"]; otherwise split on "+".
    const parts = raw.length > 1 ? raw.split(/\+(?!$)/).map((s) => s.trim()) : [raw];
    if (parts.length > MAX_KEYS) throw new Error(`Too many keys in "${raw}".`);
    return parts.map((part) => {
        const k = part.toLowerCase();
        if (k === 'cmd' || k === 'command') return platform === 'darwin' ? 'LeftCmd' : 'LeftControl';
        if (k === 'win' || k === 'super' || k === 'meta' || k === 'windows') return platform === 'darwin' ? 'LeftCmd' : 'LeftWin';
        if (k === '+') return 'Equal';
        if (ALIASES[k]) return ALIASES[k];
        if (/^[a-z]$/.test(k)) return k.toUpperCase();
        if (/^[0-9]$/.test(k)) return `Num${k}`;
        if (/^f([1-9]|1[0-9]|2[0-4])$/.test(k)) return k.toUpperCase();
        throw new Error(`Unknown key "${part}" in "${raw}".`);
    });
}
