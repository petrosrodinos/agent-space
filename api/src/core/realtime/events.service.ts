import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../databases/redis/redis.service';
import { RedisKeys } from '../databases/redis/redis.constants';

export const ConversationEvents = {
    MESSAGE_CREATED: 'message.created',
    MESSAGE_UPDATED: 'message.updated',
    MESSAGE_DELTA: 'message.delta',
    MESSAGE_DELETED: 'message.deleted',
    RUN_STATUS: 'run.status',
    RUN_STEP: 'run.step',
    APPROVAL_CREATED: 'approval.created',
    APPROVAL_RESOLVED: 'approval.resolved',
    CONVERSATION_UPDATED: 'conversation.updated',
    REACTION: 'message.reaction',
} as const;

export const UserEvents = {
    NOTIFICATION: 'notification',
    TASK_UPDATED: 'task.updated',
    CONVERSATIONS_CHANGED: 'conversations.changed',
    APPROVALS_CHANGED: 'approvals.changed',
    CONNECTION_STATUS: 'connection.status',
    AUTOMATIONS_CHANGED: 'automations.changed',
    COMPUTER_STATUS: 'computer.status',
    VOICE_ENDED: 'voice.ended',
} as const;

export interface StreamEvent<T = unknown> {
    type: string;
    data: T;
    at: string;
}

const STREAM_MAXLEN = 5000;
const STREAM_TTL_SECONDS = 24 * 3600;

/**
 * Publishes live events to Redis Streams so whichever API instance holds a client's socket can forward them,
 * and reconnecting clients can resume from their last entry ID (§14.4 "Live events across API instances").
 */
@Injectable()
export class EventsService {
    private readonly logger = new Logger(EventsService.name);

    constructor(private readonly redis: RedisService) { }

    async toConversation<T>(conversationId: string, type: string, data: T): Promise<string | null> {
        return this.publish(RedisKeys.convStream(conversationId), type, data);
    }

    async toUser<T>(userId: string, type: string, data: T): Promise<string | null> {
        return this.publish(RedisKeys.userStream(userId), type, data);
    }

    async toUsers<T>(userIds: string[], type: string, data: T) {
        await Promise.all(userIds.map((id) => this.toUser(id, type, data)));
    }

    private async publish(suffix: string, type: string, data: unknown): Promise<string | null> {
        const key = this.redis.key(suffix);
        const payload: StreamEvent = { type, data, at: new Date().toISOString() };
        try {
            const id = await this.redis.client
                .multi()
                .xadd(key, 'MAXLEN', '~', String(STREAM_MAXLEN), '*', 'e', JSON.stringify(payload))
                .expire(key, STREAM_TTL_SECONDS)
                .exec();
            return (id?.[0]?.[1] as string) ?? null;
        } catch (e) {
            this.logger.error(`Failed to publish ${type} to ${suffix}: ${(e as Error).message}`);
            return null;
        }
    }
}
