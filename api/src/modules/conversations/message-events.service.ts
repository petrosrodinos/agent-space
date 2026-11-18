import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ConversationEvents, EventsService } from '@/core/realtime/events.service';
import { MESSAGE_INCLUDE, serializeMessage } from './conversation.select';

/** Publishes full message snapshots to the conversation stream so clients never need to refetch. */
@Injectable()
export class MessageEventsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly events: EventsService,
    ) { }

    async load(id: string) {
        const m = await this.prisma.message.findUnique({ where: { id }, include: MESSAGE_INCLUDE });
        return m ? serializeMessage(m) : null;
    }

    async publish(id: string, type: string = ConversationEvents.MESSAGE_UPDATED) {
        const m = await this.load(id);
        if (m) await this.events.toConversation(m.conversation_id, type, m);
        return m;
    }

    async created(id: string) {
        return this.publish(id, ConversationEvents.MESSAGE_CREATED);
    }
}
