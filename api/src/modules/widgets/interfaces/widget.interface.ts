/** What a saved widget stores (`SavedWidget.spec`): the interactive reply's blocks plus the bot that refreshes it. */
export interface WidgetSpec {
    bot_id: string | null;
    blocks: unknown[];
    fallback_text: string;
    refreshed_at: string;
    /** Last refresh problem, shown on the widget (null when the last refresh worked). */
    refresh_error?: string | null;
}

export interface WidgetView {
    id: string;
    title: string;
    refresh_prompt: string | null;
    conversation_id: string | null;
    source_message_id: string | null;
    bot: { id: string; name: string; emoji: string | null; color: string | null } | null;
    blocks: unknown[];
    fallback_text: string;
    refreshed_at: string;
    refresh_error: string | null;
    created_at: Date;
    updated_at: Date;
}
