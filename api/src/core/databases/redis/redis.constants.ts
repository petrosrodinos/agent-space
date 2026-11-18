export const REDIS_OPTIONS = 'REDIS_OPTIONS';

/** All keys are prefixed `as:<env>:` so environments never collide (§14.4). */
export const redisPrefix = (env: string | undefined) => `as:${env || 'local'}:`;

export const RedisKeys = {
    convStream: (conversationId: string) => `stream:conv:${conversationId}`,
    userStream: (userId: string) => `stream:user:${userId}`,
    convBotLock: (conversationId: string, botId: string) => `lock:conv:${conversationId}:bot:${botId}`,
    computerLock: (botId: string) => `lock:computer:${botId}`,
    automationLock: (automationId: string) => `lock:automation:${automationId}`,
    runCancel: (runId: string) => `run:${runId}:cancel`,
    usage: (orgId: string, period: string, scope: string) => `usage:${orgId}:${period}:${scope}`,
    usageDirty: () => `usage:dirty`,
    modelsCache: () => `cache:openrouter:models`,
    composioToolsCache: (toolkit: string) => `cache:composio:tools:${toolkit}`,
    rateLimit: (key: string) => `ratelimit:${key}`,
} as const;
