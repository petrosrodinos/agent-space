import { Prisma } from 'generated/prisma';

/** Used for bots created without a template or their own starters, so a new chat never opens empty. */
export const DEFAULT_CONVERSATION_STARTERS = ['What can you help me with?', 'Help me plan my day', 'Summarise something for me', 'Brainstorm ideas with me'];

export function defaultWelcomeMessage(bot: { name: string; description?: string | null }) {
    const about = bot.description?.trim() ? ` ${bot.description.trim().replace(/[.!]?$/, '.')}` : '';
    return `Hi, I'm ${bot.name}.${about} What can I help you with?`;
}

/**
 * The bot's greeting, posted as its first message when a direct chat is opened (§6.1 welcome message).
 * Counts toward the conversation's message_count / last_message_at / unread_count, which the caller sets.
 */
export function welcomeMessageData(
    organizationId: string,
    conversationId: string,
    bot: { id: string; name: string; description?: string | null; welcome_message?: string | null },
    createdAt: Date,
): Prisma.MessageUncheckedCreateInput {
    const text = bot.welcome_message?.trim() || defaultWelcomeMessage(bot);
    return {
        organization_id: organizationId,
        conversation_id: conversationId,
        author_type: 'BOT',
        author_bot_id: bot.id,
        source: 'BOT',
        content: text,
        parts: [{ type: 'text', text }],
        created_at: createdAt,
    };
}
