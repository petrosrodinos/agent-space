import { Prisma } from 'generated/prisma';

export const BOT_BRIEF = { id: true, name: true, avatar_seed: true, color: true, description: true, is_sensitive: true, cloud_computer_enabled: true, deleted_at: true } satisfies Prisma.BotSelect;
export const USER_BRIEF = { id: true, name: true, email: true, avatar_file_id: true } satisfies Prisma.UserSelect;

export const MESSAGE_INCLUDE = {
    author_user: { select: USER_BRIEF },
    author_bot: { select: BOT_BRIEF },
    reactions: { select: { emoji: true, user_id: true } },
    files: { include: { file: { select: { id: true, filename: true, mimetype: true, size: true, status: true } } } },
    run: { select: { id: true, status: true, user_id: true, model_id: true, fallback_used: true, started_at: true, finished_at: true, skill_id: true } },
    _count: { select: { replies: true } },
    reply_to: { select: { id: true, author_type: true, content: true, deleted_at: true, author_user: { select: { id: true, name: true, email: true } }, author_bot: { select: { id: true, name: true } }, _count: { select: { files: true } } } },
} satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

export const REPLY_PREVIEW_MAX = 280;

type ReplyTarget = NonNullable<MessageRow['reply_to']>;

/** Compact quote of the replied-to message shown above a reply. Deleted messages keep their slot but lose their text. */
export function serializeReplyPreview(r: ReplyTarget) {
    const deleted = !!r.deleted_at;
    return {
        id: r.id,
        author_type: r.author_type,
        author_name: r.author_bot?.name ?? r.author_user?.name ?? r.author_user?.email ?? null,
        author_user_id: r.author_user?.id ?? null,
        content: deleted ? null : (r.content ?? '').slice(0, REPLY_PREVIEW_MAX),
        has_files: !deleted && r._count.files > 0,
        deleted,
    };
}

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
        reply_to_message_id: m.reply_to_message_id,
        reply_to: m.reply_to ? serializeReplyPreview(m.reply_to) : null,
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
