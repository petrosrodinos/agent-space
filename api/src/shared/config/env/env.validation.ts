import { z } from 'zod';
import { parseCorsUrls } from '../cors';

const EnvSchema = z.object({
    NODE_ENV: z.enum(['local', 'development', 'test', 'staging', 'production']),
    PORT: z.coerce.number().default(3000),
    /** api = HTTP + realtime only, worker = queue processors only, all = both (local development). §14.4 */
    PROCESS_ROLE: z.enum(['api', 'worker', 'all']).default('all'),
    APP_URL: z.string().url().optional(),
    LANDING_URL: z.string().url().optional(),
    CORS_URLS: z.preprocess(parseCorsUrls, z.array(z.string().url()).optional()),
    API_URL: z.string().url().optional(),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().optional(),
    CACHE_TTL_SECONDS: z.coerce.number().optional(),
    JWT_SECRET: z.string().min(1),
    /** Access token lifetime. Short-lived; refresh tokens keep the session (§14.1). */
    JWT_ACCESS_EXPIRATION: z.string().default('15m'),
    JWT_EXPIRATION_TIME: z.string().optional(),
    REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    GCS_PROJECT_ID: z.string().optional(),
    GCS_BUCKET_NAME: z.string().optional(),
    GCS_BUCKET_PREFIX: z.string().optional(),
    GCS_CREDENTIALS_JSON_BASE64: z.string().optional(),
    /** gcs = Google Cloud Storage (production), local = API-served disk store for development. */
    STORAGE_DRIVER: z.enum(['gcs', 'local']).default('gcs'),
    LOCAL_STORAGE_DIR: z.string().optional(),
    /** gcp = Google Cloud Secret Manager (production), local-encrypted = AES-256-GCM dev fallback. §8.7 */
    SECRET_STORE: z.enum(['gcp', 'local-encrypted']).default('gcp'),
    SECRET_MANAGER_PROJECT_ID: z.string().optional(),
    SECRETS_ENCRYPTION_KEY: z.string().optional(),
    OPEN_ROUTER_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    COMPOSIO_API_KEY: z.string().optional(),
    COMPOSIO_CALLBACK_URL: z.string().optional(),
    DAYTONA_API_KEY: z.string().optional(),
    /** Chrome/Chromium used to render artifacts for PDF, image, PowerPoint and Word export (§7.5). Defaults to Puppeteer's bundled browser. */
    CHROME_PATH: z.string().optional(),
    /** Signing secret of the Composio webhook subscription (§10.2 triggers); scripts/composio-webhook.mjs creates it. */
    COMPOSIO_WEBHOOK_SECRET: z.string().optional(),
    BULL_BOARD_USER: z.string().optional(),
    BULL_BOARD_PASSWORD: z.string().optional(),
});

export function validateEnv(config: Record<string, unknown>) {
    const parsed = EnvSchema.safeParse(config);

    if (!parsed.success) {
        console.error(parsed.error.format());
        throw new Error('Invalid environment variables');
    }

    const env = parsed.data;
    if (env.NODE_ENV !== 'local' && !env.REDIS_URL) {
        throw new Error('REDIS_URL is required outside local development (§14.4)');
    }
    if (env.SECRET_STORE === 'local-encrypted') {
        if (env.NODE_ENV === 'production') {
            throw new Error('SECRET_STORE=local-encrypted is not allowed in production (§8.7)');
        }
        if (!env.SECRETS_ENCRYPTION_KEY || env.SECRETS_ENCRYPTION_KEY.length < 32) {
            throw new Error('SECRETS_ENCRYPTION_KEY (>= 32 chars) is required when SECRET_STORE=local-encrypted');
        }
    }
    if (env.STORAGE_DRIVER === 'local' && env.NODE_ENV === 'production') {
        throw new Error('STORAGE_DRIVER=local is not allowed in production (§7.7)');
    }

    return env;
}

export type EnvConfig = z.infer<typeof EnvSchema>;
