import { Prisma } from 'generated/prisma';

export const BOT_BRIEF = { id: true, name: true, emoji: true, color: true, description: true, is_sensitive: true, cloud_computer_enabled: true, deleted_at: true } satisfies Prisma.BotSelect;
export const USER_BRIEF = { id: true, name: true, email: true, avatar_file_id: true } satisfies Prisma.UserSelect;

export const MESSAGE_INCLUDE = {
    author_user: { select: USER_BRIEF },
    author_bot: { select: BOT_BRIEF },
    reactions: { select: { emoji: true, user_id: true } },
    files: { include: { file: { select: { id: true, filename: true, mimetype: true, size: true, status: true } } } },
    run: { select: { id: true, status: true, user_id: true, model_id: true, fallback_used: true, started_at: true, finished_at: true, skill_id: true } },
    _count: { select: { replies: true } },
} satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

/** Client shape: reactions grouped, files flattened, BigInt-safe. Secret values never appear here (§8.8). */
export function serializeMessage(m: MessageRow, viewerId?: string) {
    const grouped = new Map<string, { emoji: string; count: number; user_ids: string[] }>();
    for (const r of m.reactions) {
        const g = grouped.get(r.emoji) ?? { emoji: r.emoji, count: 0, user_ids: [] };
        g.count += 1;
        g.user_ids.push(r.user_id);
        grouped.set(r.emoji, g);
    }
    // Secret-input cards are shown in full only to the user they are for; others see a neutral status (§8.8 "In groups").
    const parts = Array.isArray(m.parts)
        ? (m.parts as any[]).map((p) => (p?.type === 'secret-input' && viewerId && p.for_user_id !== viewerId ? { type: 'secret-input', redacted: true, status: p.status, for_user_name: p.for_user_name } : p))
        : [];
    return {
        id: m.id,
        conversation_id: m.conversation_id,
        author_type: m.author_type,
        author_user: m.author_user,
        author_bot: m.author_bot,
        source: m.source,
        status: m.status,
        content: m.content,
        parts,
        run: m.run,
        run_id: m.run_id,
        parent_message_id: m.parent_message_id,
        branch_from_message_id: m.branch_from_message_id,
        branch_index: m.branch_index,
        model_id: m.model_id,
        is_pinned: m.is_pinned,
        edited_at: m.edited_at,
        secret_masked: m.secret_masked,
        created_at: m.created_at,
        updated_at: m.updated_at,
        reply_count: m._count.replies,
        reactions: [...grouped.values()],
        files: m.files.map((f) => ({ ...f.file, size: Number(f.file.size) })),
    };
}
