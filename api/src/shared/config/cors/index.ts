/**
 * Environments where the API accepts requests from any origin, without needing APP_URL / LANDING_URL / CORS_URLS.
 */
export const OPEN_CORS_ENVS = ['local', 'staging'];

/**
 * Origins of the packaged apps (§14.2): Electron serves the bundle at app://agentspace, Capacitor at
 * capacitor://localhost (iOS) and https://localhost (Android). They carry no cookies — sign-in uses bearer tokens.
 */
export const APP_SHELL_ORIGINS = ['app://agentspace', 'capacitor://localhost', 'https://localhost'];

export function parseCorsUrls(value: unknown): string[] | undefined {
    if (typeof value !== 'string' || !value.trim()) {
        return undefined;
    }

    const urls = value.split(',').map((url) => url.trim()).filter(Boolean);
    return urls.length ? urls : undefined;
}

/**
 * `true` reflects the request's Origin back, so any origin is accepted (works with `credentials: true`,
 * unlike `*`). Used in local and staging; other environments use an explicit allowlist.
 */
export function resolveCorsOrigins(options: {
    nodeEnv?: string;
    corsUrls?: string[];
    appUrl?: string;
    landingUrl?: string;
}): string[] | true {
    if (options.nodeEnv && OPEN_CORS_ENVS.includes(options.nodeEnv)) {
        return true;
    }

    if (options.corsUrls?.length) {
        return [...options.corsUrls, ...APP_SHELL_ORIGINS];
    }

    return [options.appUrl, options.landingUrl, ...APP_SHELL_ORIGINS].filter((url): url is string => Boolean(url));
}
