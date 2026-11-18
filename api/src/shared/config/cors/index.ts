export const LOCAL_CORS_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3001',
];

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

export function resolveCorsOrigins(options: {
    nodeEnv?: string;
    corsUrls?: string[];
    appUrl?: string;
    landingUrl?: string;
}): string[] {
    if (options.nodeEnv === 'local') {
        return [...LOCAL_CORS_ORIGINS, ...APP_SHELL_ORIGINS];
    }

    if (options.corsUrls?.length) {
        return [...options.corsUrls, ...APP_SHELL_ORIGINS];
    }

    return [options.appUrl, options.landingUrl, ...APP_SHELL_ORIGINS].filter((url): url is string => Boolean(url));
}
