/**
 * Apps the bot can't use while controlling the computer (§14.3): Agent Space itself, password managers, system settings
 * and security prompts, and terminals, plus the user's own list. Pure: no Electron imports.
 */

export const BUILT_IN_BLOCKED_APPS = [
    // Agent Space itself (also matched by process id in control.ts)
    'Agent Space',
    // Password managers
    '1Password',
    'Bitwarden',
    'LastPass',
    'KeePass',
    'KeePassXC',
    'Dashlane',
    'Keeper',
    'NordPass',
    'Proton Pass',
    'Enpass',
    'RoboForm',
    'Keychain Access',
    'Passwords',
    'Credential Manager',
    // System settings and security prompts
    'System Settings',
    'System Preferences',
    'Control Panel',
    'Settings',
    'SystemSettings',
    'consent',
    'SecurityAgent',
    'coreautha',
    'UserAccountControl',
    'User Account Control',
    'Windows Security',
    'SecHealthUI',
    'CredentialUIBroker',
    'LockApp',
    'Registry Editor',
    'regedit',
    // Terminals
    'Terminal',
    'iTerm',
    'iTerm2',
    'Windows Terminal',
    'WindowsTerminal',
    'wt',
    'PowerShell',
    'Windows PowerShell',
    'pwsh',
    'powershell_ise',
    'cmd',
    'Command Prompt',
    'Console',
    'conhost',
    'OpenConsole',
    'Warp',
    'Alacritty',
    'kitty',
    'WezTerm',
    'Hyper',
    'Ghostty',
] as const;

export interface FrontApp {
    /** App / process name as the OS reports it. */
    name: string;
    /** Executable or bundle path. */
    path?: string;
    /** macOS bundle identifier. */
    bundleId?: string;
    /** Window title (Windows only in practice). */
    title?: string;
    processId?: number;
}

/** Lower-case words: "WindowsTerminal.exe" → "windowsterminal", "1Password 7" → "1password 7". */
export function normalizeAppName(s: string): string {
    return String(s ?? '')
        .toLowerCase()
        .replace(/\.(exe|app)$/, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? '';

/**
 * Returns the blocked-list entry the app matches, or null.
 * Name, executable name and bundle id match when they contain the entry as whole words ("Windows Terminal" matches
 * "Terminal"); the window title only when it equals an entry (Windows' Settings and Control Panel windows are hosted by
 * generic processes, so the title is what identifies them).
 */
export function matchBlockedApp(app: FrontApp | null, extra: readonly string[] = [], selfPids: readonly number[] = []): string | null {
    if (!app) return null;
    if (app.processId != null && selfPids.includes(app.processId)) return 'Agent Space';
    const tokens = [app.name, app.path ? baseName(app.path) : '', app.bundleId ?? ''].map(normalizeAppName).filter(Boolean);
    const title = normalizeAppName(app.title ?? '');
    for (const entry of [...BUILT_IN_BLOCKED_APPS, ...extra]) {
        const e = normalizeAppName(entry);
        if (!e) continue;
        if (tokens.some((t) => ` ${t} `.includes(` ${e} `))) return entry;
        if (title && title === e) return entry;
    }
    return null;
}

/** Cleans the user's extra list: trimmed, non-empty, unique (case-insensitive), at most 100 entries of 80 chars. */
export function cleanBlockedList(list: unknown): string[] {
    if (!Array.isArray(list)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of list) {
        const s = String(v ?? '').trim().slice(0, 80);
        const k = normalizeAppName(s);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(s);
        if (out.length >= 100) break;
    }
    return out;
}
