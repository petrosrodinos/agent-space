import { Injectable } from '@nestjs/common';
import { Bot, Conversation, OrganizationSettings, Prisma, Run, User, UserSettings } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { StorageService } from '@/integrations/storage/storage.service';
import { ChatContentPart, ChatMessage } from '@/integrations/openrouter/openrouter.service';

const LENGTH = { SHORT: 'Keep replies short (a few sentences).', BALANCED: 'Keep replies balanced: complete but not long.', DETAILED: 'Give detailed, thorough replies.' };
const TONE = { CASUAL: 'Casual, relaxed tone.', FRIENDLY_PROFESSIONAL: 'Friendly-professional tone.', FORMAL: 'Formal, polished tone.' };
const FORMAT = { MIXED: 'Mix short paragraphs and bullet points as needed.', MOSTLY_BULLETS: 'Prefer bullet points.', MOSTLY_PARAGRAPHS: 'Prefer flowing paragraphs over bullets.' };
const EMOJI = { NONE: 'Do not use emoji.', OCCASIONALLY: 'Use emoji occasionally.', OFTEN: 'Feel free to use emoji often.' };
const CLARIFY = { ASK_MORE_OFTEN: 'Ask clarifying questions when anything is ambiguous.', BALANCED: 'Ask a clarifying question only when it really matters.', ASSUME_AND_PROCEED: 'Make sensible assumptions and proceed; state them briefly.' };
export const TEMPERATURE = { PRECISE: 0.2, BALANCED: 0.6, CREATIVE: 0.95 } as const;

export interface PromptContext {
    run: Run;
    bot: Bot;
    user: User | null;
    user_settings: UserSettings | null;
    org_settings: OrganizationSettings | null;
    org_name: string;
    conversation: (Conversation & { participants: { user: { id: string; name: string | null; email: string } | null; bot: { id: string; name: string; description: string | null } | null }[] }) | null;
    connection_summary: string[];
    supports_vision: boolean;
    /** Whether this run got the cloud computer tools (bot, organisation and automation settings all allow it). */
    computer_available: boolean;
    /** The bot has no cloud computer switched on, but may turn one on itself with computer_turn_on. */
    computer_can_turn_on?: boolean;
    /** Saved website logins this bot may use for the acting user — metadata only. */
    website_logins: { id: string; label: string; website: string | null; password_manager: boolean }[];
}

import { isExtractable, TEXT_MIME } from '@/shared/utils/files/text-extract.utils';

const HISTORY_INCLUDE = {
    author_user: { select: { name: true, email: true } },
    author_bot: { select: { id: true, name: true } },
    files: { include: { file: true } },
    reply_to: { select: { content: true, deleted_at: true, author_user: { select: { name: true, email: true } }, author_bot: { select: { id: true, name: true } }, _count: { select: { files: true } } } },
} satisfies Prisma.MessageInclude;
type HistoryMessage = Prisma.MessageGetPayload<{ include: typeof HISTORY_INCLUDE }>;

export interface UserTurnOptions {
    bot_id: string;
    /** Group chats prefix every turn with the speaker's name. */
    is_group: boolean;
    vision: boolean;
}

/** Builds the system prompt and the conversation history sent to the model. */
@Injectable()
export class PromptBuilder {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) { }

    async system(ctx: PromptContext): Promise<string> {
        const { bot, user, user_settings: us, org_settings: os, run } = ctx;
        const tz = user?.timezone || os?.default_timezone || 'UTC';
        const now = new Date().toLocaleString('en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' });

        const [memories, orgMemories, knowledge, skills, mentionedSkill] = await Promise.all([
            bot.memory_enabled && us?.memory_enabled !== false
                ? this.prisma.memory.findMany({ where: { bot_id: bot.id, OR: [{ kind: 'BOT_USER', user_id: run.user_id ?? undefined }, ...(bot.memory_scope === 'SHARED' ? [{ kind: 'BOT_SHARED' as const }] : [])] }, orderBy: { updated_at: 'desc' }, take: 60 })
                : [],
            bot.org_knowledge_enabled ? this.prisma.memory.findMany({ where: { organization_id: run.organization_id, kind: 'ORGANIZATION' }, take: 60 }) : [],
            this.prisma.knowledgeItem.findMany({
                where: { organization_id: run.organization_id, deleted_at: null, OR: [{ bot_id: bot.id }, ...(bot.org_knowledge_enabled ? [{ scope: 'ORGANIZATION' as const }] : [])] },
                take: 30,
            }),
            this.prisma.botSkill.findMany({ where: { bot_id: bot.id, skill: { deleted_at: null } }, include: { skill: true } }),
            run.skill_id ? this.prisma.skill.findUnique({ where: { id: run.skill_id } }) : null,
        ]);

        // §13.1: bot style when it locks style or overrides; otherwise the user's personal preferences.
        const useBotStyle = bot.lock_style || bot.style_override;
        const length = (useBotStyle && bot.reply_length) || us?.reply_length || 'BALANCED';
        const tone = (useBotStyle && bot.reply_tone) || us?.reply_tone || 'FRIENDLY_PROFESSIONAL';
        const format = (useBotStyle && bot.reply_formatting) || us?.reply_formatting || 'MIXED';
        const emoji = (useBotStyle && bot.emoji_usage) || us?.emoji_usage || 'OCCASIONALLY';
        const clarify = bot.clarifying_questions !== 'USER_PREFERENCE' ? bot.clarifying_questions : us?.clarifying_questions || 'BALANCED';
        const language = bot.reply_language
            ? `Always reply in ${bot.reply_language === 'EL' ? 'Greek' : 'English'}.`
            : us?.reply_language === 'ALWAYS_EL'
                ? 'Always reply in Greek.'
                : us?.reply_language === 'ALWAYS_EN'
                    ? 'Always reply in English.'
                    : 'Reply in the language of the user\'s message (English or Greek).';

        const s: string[] = [];
        s.push(`You are ${bot.name}, an AI co-worker in Agent Space for the organisation "${ctx.org_name}". ${bot.description ?? ''}`.trim());
        if (os?.company_instructions) s.push(`## Company instructions (always follow)\n${os.company_instructions}`);
        s.push(`## Your role and instructions\n${bot.instructions}`);
        s.push(
            `## How to reply\n- ${LENGTH[length]}\n- ${TONE[tone]}\n- ${FORMAT[format]}\n- ${EMOJI[emoji]}\n- ${CLARIFY[clarify]}\n- ${language}\n- Use Markdown (headings, lists, tables, **bold**, code blocks) when it helps.` +
            (us?.show_sources !== false ? '\n- When you use information from the web, files or connected accounts, say where it came from (links).' : '') +
            (us?.proactive_suggestions !== false ? '\n- Proactively suggest a helpful next action when one is obvious.' : '') +
            (us?.suggested_follow_ups !== false ? '\n- At the very end of a reply, add 2–3 short follow-up questions the user might ask next, on one final line exactly like: [[followups: first || second || third]]' : ''),
        );
        if (user) {
            s.push(`## The user\n- Name: ${user.name ?? user.email}${user.job_title ? `\n- Role: ${user.job_title}` : ''}${user.about_me ? `\n- About: ${user.about_me}` : ''}\n- Email: ${user.email}\n- Time zone: ${tz}. Current date and time: ${now}.`);
        }
        if (ctx.conversation && ctx.conversation.type !== 'DIRECT') {
            const people = ctx.conversation.participants.filter((p) => p.user).map((p) => p.user!.name || p.user!.email);
            const bots = ctx.conversation.participants.filter((p) => p.bot && p.bot.id !== bot.id).map((p) => `${p.bot!.name}${p.bot!.description ? ` (${p.bot!.description})` : ''}`);
            s.push(`## This conversation\nA ${ctx.conversation.type === 'GROUP' ? `group called "${ctx.conversation.name ?? 'Group'}"` : 'shared chat'} with: ${people.join(', ')}${bots.length ? `; other bots: ${bots.join(', ')}` : ''}. Messages from others are prefixed with their name. Only answer what is addressed to you or relevant to your role; another bot may answer its own part.`);
        }
        if (orgMemories.length) s.push(`## Company facts (organisation memory)\n${orgMemories.map((m) => `- ${m.content}`).join('\n')}`);
        if (memories.length) s.push(`## What you remember about this user (id: fact)\n${memories.map((m) => `- ${m.id}: ${m.content}`).join('\n')}\nUse the remember tool for new lasting facts or preferences (never secrets).`);
        if (knowledge.length) {
            s.push(
                `## Knowledge\n${knowledge
                    .map((k) =>
                        k.kind === 'TEXT' && k.content && k.content.length <= 4000
                            ? `### ${k.title}\n${k.content ?? ''}`
                            : `- ${k.kind === 'LINK' ? 'Web page' : k.kind === 'FILE' ? 'File' : 'Note'} "${k.title}" (id: ${k.id}${k.url ? `, ${k.url}` : ''}${k.status === 'READY' ? `, ${Math.round((k.content ?? '').length / 1000)}k characters` : k.status === 'PROCESSING' ? ', still being read' : ', could not be read'})`,
                    )
                    .join('\n')}\nUse search_knowledge (semantic search: ask in natural language) to find relevant passages and read_knowledge to read an item in full. Prefer your knowledge over guessing, and say which item you used.`,
            );
        }
        if (skills.length && bot.use_skills_automatically) {
            s.push(
                `## Your skills\nWhen a request matches a skill's description, call use_skill with its short name first, tell the user "Using <emoji> <name>", ask its questions-to-ask-first if needed, then follow its steps.\n${skills
                    .map((b) => `- /${b.skill.slug} ${b.skill.emoji ?? ''} ${b.skill.name}: ${b.skill.description}`)
                    .join('\n')}`,
            );
        }
        if (mentionedSkill) {
            s.push(`## The user asked you to follow the skill /${mentionedSkill.slug} (${mentionedSkill.emoji ?? ''} ${mentionedSkill.name})\nStart your reply with "Using ${mentionedSkill.emoji ?? ''} ${mentionedSkill.name}". Ask its questions first if the answers are missing.\nQuestions to ask first: ${JSON.stringify(mentionedSkill.questions)}\nSteps:\n${mentionedSkill.instructions}`);
        }
        s.push(
            ctx.connection_summary.length
                ? `## Connected accounts you can use\n${ctx.connection_summary.map((c) => `- ${c}`).join('\n')}\nWhen several accounts exist for a service, use the default unless the user says otherwise; ask if it's unclear.\nA connected account can use any email or username; it doesn't have to match the user's Agent Space sign-in. Only suggest reconnecting when a tool result says the sign-in expired (reconnecting is done on the Connections page).`
                : '## Connected accounts\nNone yet. If a task needs a service (Gmail, Calendar, HubSpot…), tell the user to connect it on the Connections page.',
        );
        if (ctx.computer_available) {
            const logins = ctx.website_logins.length
                ? `- Saved website logins you may use (sign in with computer_sign_in on the site's sign-in page; you never see the password):\n${ctx.website_logins.map((l) => (l.password_manager ? `  - Any website with a login stored in the password manager "${l.label}" (credential_id: ${l.id}; give the website you are on)` : `  - ${l.website}: "${l.label}" (credential_id: ${l.id})`)).join('\n')}\n`
                : `- No website logins are saved for you. If a task needs one regularly, offer to save it with request_secret (kind "website_login") so future runs can sign in without help.\n`;
            s.push(
                `## Your cloud computer\nYou have a private cloud computer (Linux desktop with a browser, Python and Node.js) that keeps its files and website sign-ins between tasks. Use computer_run for scripts and data work, and the browser tools (computer_open_url, computer_screenshot, computer_click, computer_type, computer_key, computer_scroll) for websites. The user can watch live.\n` +
                `- Never type passwords, card numbers or two-step codes yourself with computer_type. When a site needs a sign-in, use computer_sign_in if a saved login exists for that site; otherwise, and for text/email codes or "prove you're human" checks, call computer_ask_user and wait.\n` +
                logins +
                `- Set the effect of clicks and key presses honestly (submit_form, send_message, purchase…); important ones are shown to the user for approval.\n` +
                `- Bring data in with copy_to_computer (stored files, public URLs, or API requests through connected accounts — the sign-in never reaches the computer) and share results with copy_from_computer.\n` +
                `- When you have finished with the computer, call computer_turn_off so it stops running (files and sign-ins are kept; using it again switches it back on).`,
            );
        } else if (ctx.computer_can_turn_on) {
            s.push(
                `## Your cloud computer\nYour cloud computer is switched off. Do not tell the user it is unavailable or ask them to open settings: when a task needs it (real .xlsx/.docx files, scripts, careful website browsing, or work that must run while the user's own computer is off, such as automations), call computer_turn_on with a short reason, then carry on with the computer_* tools it gives you.`,
            );
        }
        s.push(
            `## Rules\n` +
            `- Your tools are reloaded from the current settings on every message, so a setting the user just changed (cloud computer, connected accounts, tool servers, skills) already applies to their next message in this same chat. NEVER tell the user to start a new chat or restart anything for a tool to appear. If a tool you expect is missing, say so plainly and, if a setting is the cause, tell them where to turn it on (use app_help for the page); then they can simply send their next message.\n` +
            `- When a user message starts with "[Replying to …]" followed by a quoted block, the user is answering that specific earlier message. Treat the quote as what "this", "that" or "it" refers to, answer the new text in that context, and do not repeat the quote back.\n` +
            `- Take action with your tools instead of only describing what to do. Sensitive actions (sending, posting, deleting, paying, sharing, changing settings) will show the user an approval card automatically — just call the tool; never claim you did something before the tool succeeded.\n` +
            `- When you truly cannot continue without the user's answer (ambiguous request, a choice only they can make) and you have an ask_user tool, call it instead of guessing or writing the question in plain text; offer short options when the answers are predictable.
` +
            `- NEVER ask the user to type passwords, API keys or tokens in chat. If you need a key, call request_secret. You never see secret values.\n` +
            `- Use show_ui for dashboards, comparisons, charts, checklists or forms when a visual or interactive answer is clearly better; keep text minimal when you do.\n` +
            `- For questions about Agent Space itself (features, where a page or setting is, how to do something in the app), call app_help and answer with its direct links. Never invent screens or menu paths.
` +
            `- Settings can be changed by chat with the matching tools (the user confirms). Security, billing, password, email, sign-in methods, ownership and account deletion can only be changed in the Settings screens.\n` +
            `- If you ask another bot for help, say so ("Asked Sales Sam…"). Never share information with people who couldn't otherwise see it.\n` +
            `- Be honest about uncertainty and errors.`,
        );
        return s.join('\n\n');
    }

    /**
     * When a user replies to a specific message, the model gets that message's text up front. The quoted message may be far
     * outside the history window, and "this", "that one", "the second point" only make sense next to it.
     */
    private replyQuote(
        r: { content: string | null; deleted_at: Date | null; author_user: { name: string | null; email: string } | null; author_bot: { id: string; name: string } | null; _count: { files: number } } | null,
        botId: string,
    ): string {
        if (!r) return '';
        const who = r.author_bot ? (r.author_bot.id === botId ? 'your earlier message' : `${r.author_bot.name}'s message (bot)`) : `${r.author_user?.name || r.author_user?.email || 'a user'}'s message`;
        if (r.deleted_at) return `[Replying to ${who}, which has since been deleted]\n`;
        const body = (r.content ?? '').trim().slice(0, 1500);
        const files = r._count.files ? ` (with ${r._count.files} attachment${r._count.files > 1 ? 's' : ''})` : '';
        const quoted = body ? body.split('\n').map((l) => `> ${l}`).join('\n') : '> (no text)';
        return `[Replying to ${who}${files}:\n${quoted}\n]\n`;
    }

    /** Conversation history as chat messages; group messages are prefixed with the speaker's name. */
    async history(ctx: PromptContext, opts: { excludeMessageIds: string[]; limit?: number; vision: boolean }): Promise<ChatMessage[]> {
        if (!ctx.run.conversation_id) return [];
        const trigger = ctx.run.trigger_message_id ? await this.prisma.message.findUnique({ where: { id: ctx.run.trigger_message_id } }) : null;
        const rows = await this.prisma.message.findMany({
            where: {
                conversation_id: ctx.run.conversation_id,
                deleted_at: null,
                id: { notIn: opts.excludeMessageIds },
                status: { in: ['COMPLETED', 'STOPPED', 'FAILED'] },
                ...(trigger ? { created_at: { lte: trigger.created_at } } : {}),
                author_type: { in: ['USER', 'BOT'] },
            },
            include: HISTORY_INCLUDE,
            orderBy: { created_at: 'desc' },
            take: opts.limit ?? 40,
        });
        const turn = { bot_id: ctx.bot.id, is_group: ctx.conversation?.type !== 'DIRECT', vision: opts.vision };
        const out: ChatMessage[] = [];
        for (const m of rows.reverse()) {
            if (m.author_type === 'BOT' && m.author_bot?.id === ctx.bot.id) {
                // Tell the model which actions already ran in that turn, so it never repeats them.
                const text = m.content ?? '';
                const parts = Array.isArray(m.parts) ? (m.parts as any[]) : [];
                const actions = parts
                    .filter((p) => p?.type === 'tool' || p?.type === 'approval')
                    .map((p) => (p.type === 'tool' ? `${p.title} (${p.status})` : `approval "${p.title}": ${String(p.status).toLowerCase()}`));
                const note = actions.length ? `\n\n[Already done in this turn: ${actions.join('; ')}]` : '';
                if (text || note) out.push({ role: 'assistant', content: `${text}${note}`.trim() });
                continue;
            }
            out.push(await this.userTurn(m, turn));
        }
        // The model needs the conversation to end on a user turn.
        while (out.length && out[out.length - 1].role === 'assistant') out.pop();
        return out;
    }

    /** Follow-ups sent while a run is working, as user turns in the order they were written. */
    async userTurns(messageIds: string[], opts: UserTurnOptions): Promise<ChatMessage[]> {
        const rows = await this.prisma.message.findMany({ where: { id: { in: messageIds }, deleted_at: null }, include: HISTORY_INCLUDE, orderBy: { created_at: 'asc' } });
        const out: ChatMessage[] = [];
        for (const m of rows) out.push(await this.userTurn(m, opts));
        return out;
    }

    /** One message from a person (or another bot) as a user turn: speaker prefix, reply quote and attachments. */
    private async userTurn(m: HistoryMessage, opts: UserTurnOptions): Promise<ChatMessage> {
        let text = m.content ?? '';
        if (m.secret_masked && m.author_type === 'USER') text += '\n\n(Note: something that looked like a secret was masked before reaching you. Do not ask for it in chat — use request_secret.)';
        const speaker = m.author_type === 'BOT' ? `${m.author_bot?.name} (bot)` : m.author_user?.name || m.author_user?.email || 'User';
        const prefix = opts.is_group || m.author_type === 'BOT' ? `[${speaker}]: ` : '';
        const quote = this.replyQuote(m.reply_to, opts.bot_id);
        const parts: ChatContentPart[] = [{ type: 'text', text: `${prefix}${quote}${text}` }];
        for (const mf of m.files) {
            const f = mf.file;
            if (f.status !== 'READY' || f.deleted_at) continue;
            if (/^image\//.test(f.mimetype) && opts.vision && Number(f.size) < 8 * 1024 * 1024) {
                try {
                    const data = await this.storage.read(f.bucket, f.object_path);
                    parts.push({ type: 'image_url', image_url: { url: `data:${f.mimetype};base64,${data.toString('base64')}` } });
                } catch {
                    parts.push({ type: 'text', text: `[Attached image: ${f.filename} (could not be loaded)]` });
                }
            } else if (TEXT_MIME.test(f.mimetype) && Number(f.size) < 2 * 1024 * 1024) {
                try {
                    const data = (await this.storage.read(f.bucket, f.object_path)).toString('utf8').slice(0, 40_000);
                    parts.push({ type: 'text', text: `\n--- Attached file: ${f.filename} ---\n${data}\n--- end of ${f.filename} ---` });
                } catch {
                    parts.push({ type: 'text', text: `[Attached file: ${f.filename} (could not be read)]` });
                }
            } else {
                parts.push({ type: 'text', text: `[Attached file: ${f.filename} (${f.mimetype}, ${Math.round(Number(f.size) / 1024)} KB, file_id: ${f.id}${isExtractable(f.mimetype, f.filename) ? ' — read it with read_file' : ''})]` });
            }
        }
        return { role: 'user', content: parts.length === 1 ? (parts[0] as any).text : parts };
    }
}
