import { Injectable } from '@nestjs/common';
import type { Actor } from '../bots/bots.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../conversations/messages.service';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

/** Long tasks (§10.1) are posted into the bot's direct conversation and run as TASK runs. */
@Injectable()
export class TasksService {
    constructor(
        private readonly conversations: ConversationsService,
        private readonly messages: MessagesService,
        private readonly prisma: PrismaService,
    ) { }

    async startTask(actor: Actor, botId: string, prompt: string) {
        const conv = await this.conversations.getOrCreateDirect(actor, { bot_id: botId });
        const res = await this.messages.send(actor, conv.id, { content: prompt });
        // Re-label the queued reply as a task so it shows on the Tasks page with a title.
        for (const r of res.runs) {
            await this.prisma.run.update({ where: { id: r.id }, data: { type: 'TASK', title: prompt.slice(0, 120) } });
        }
        return { conversation_id: conv.id, runs: res.runs };
    }
}
