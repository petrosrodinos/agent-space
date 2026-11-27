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
    /** Ids of follow-up messages sent while the run is working; the run loop reads them between steps. */
    runInbox: (runId: string) => `run:${runId}:inbox`,
    modelsCache: () => `cache:openrouter:models`,
    /** The tools a bot is offered for a toolkit: `{ tools, complete }` (complete = the whole toolkit, nothing to search for). */
    composioToolsCache: (toolkit: string) => `cache:composio:agent-tools:${toolkit}`,
    /** One tool's definition, kept after a bot loaded it with find_connection_tools. */
    composioToolCache: (slug: string) => `cache:composio:tool:${slug}`,
    composioAllToolsCache: (toolkit: string) => `cache:composio:all-tools:${toolkit}`,
    rateLimit: (key: string) => `ratelimit:${key}`,
    /** §14.3 device tools: online marker (refreshed while the app is connected), pub/sub channel, request owner and reply list. */
    deviceOnline: (deviceId: string) => `device:${deviceId}:online`,
    deviceChannel: (deviceId: string) => `device:${deviceId}`,
    deviceChannelPattern: () => `device:*`,
    deviceLocalTools: (deviceId: string) => `device:${deviceId}:local-tools`,
    deviceRequest: (requestId: string) => `device-req:${requestId}`,
    deviceReply: (requestId: string) => `device-reply:${requestId}`,
} as const;
