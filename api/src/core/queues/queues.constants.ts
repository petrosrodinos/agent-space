export const BULL_BOARD_ADAPTER = 'BULL_BOARD_ADAPTER';

/** Queue names (§14.4). */
export const Queues = {
    AGENT_RUNS: 'agent-runs',
    AUTOMATIONS: 'automations',
    TRIGGERS: 'triggers',
    APPROVALS: 'approvals',
    NOTIFICATIONS: 'notifications',
    CONNECTIONS: 'connections',
    CLOUD_COMPUTERS: 'cloud-computers',
    STORAGE: 'storage',
    EXPORTS: 'exports',
    USAGE: 'usage',
    KNOWLEDGE: 'knowledge',
    CHANNELS: 'channels',
} as const;

export const ALL_QUEUES = Object.values(Queues);

/** Job names per queue (§14.4). */
export const Jobs = {
    agentRuns: { RUN: 'run', RESUME: 'resume' },
    automations: { TICK: 'tick', RETRY: 'retry', RECONCILE: 'reconcile-schedulers' },
    triggers: { COMPOSIO_EVENT: 'composio-event', DEVICE_PLACE_EVENT: 'device-place-event' },
    approvals: { TIMEOUT: 'timeout' },
    notifications: { DISPATCH: 'dispatch', EMAIL: 'email', PUSH: 'push' },
    connections: {
        SYNC_COMPOSIO_STATUS: 'sync-composio-status',
        REFRESH_TOKEN: 'refresh-token',
        REVOKE_AND_DELETE: 'revoke-and-delete-credentials',
    },
    cloudComputers: { IDLE_PAUSE: 'idle-pause', SESSION_LIMIT: 'session-limit', PROCESS_REPLAY: 'process-replay' },
    storage: { PURGE_DELETED: 'purge-deleted', APPLY_RETENTION: 'apply-retention', AGGREGATE_USAGE: 'aggregate-usage' },
    exports: { USER_DATA: 'user-data-export', ACTIVITY: 'activity-export' },
    usage: { FLUSH_COUNTERS: 'flush-counters', LIMIT_ALERTS: 'limit-alerts' },
    knowledge: { INDEX: 'index' },
    channels: { INBOUND: 'inbound', REPLY: 'reply' },
} as const;

/** Run priorities: people waiting in a chat are served first (§14.4). */
export const RunPriority = { CHAT_REPLY: 1, BOT_TO_BOT: 2, TASK: 3, AUTOMATION_RUN: 5 } as const;

/** Completed jobs kept 24h (max 1000), failed kept 14 days (§14.4). */
export const DEFAULT_JOB_OPTIONS = {
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 14 * 24 * 3600 },
};

/** Platform schedules, upserted at worker start-up from this single list (§14.4). UTC. */
export const PLATFORM_SCHEDULES: { queue: string; job: string; pattern?: string; every?: number }[] = [
    { queue: Queues.STORAGE, job: Jobs.storage.PURGE_DELETED, pattern: '0 2 * * *' },
    { queue: Queues.STORAGE, job: Jobs.storage.APPLY_RETENTION, pattern: '30 2 * * *' },
    { queue: Queues.STORAGE, job: Jobs.storage.AGGREGATE_USAGE, pattern: '0 3 * * *' },
    { queue: Queues.AUTOMATIONS, job: Jobs.automations.RECONCILE, pattern: '30 3 * * *' },
    { queue: Queues.CONNECTIONS, job: Jobs.connections.SYNC_COMPOSIO_STATUS, pattern: '*/15 * * * *' },
    { queue: Queues.USAGE, job: Jobs.usage.FLUSH_COUNTERS, every: 60_000 },
    { queue: Queues.USAGE, job: Jobs.usage.LIMIT_ALERTS, every: 5 * 60_000 },
];
