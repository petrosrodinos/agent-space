import { ActionType, ApprovalLevel, Bot, BotApprovalRule, OrganizationSettings, ToolPermission } from 'generated/prisma';

/** Actions "hard to undo or that go outside the company" (§11) — asked for at the default level. */
const IMPORTANT: ActionType[] = ['SEND_MESSAGE', 'POST_PUBLICLY', 'DELETE_DATA', 'PURCHASE_PAYMENT', 'SHARE_FILES', 'ENTER_PASSWORD', 'EXTERNAL_EMAIL', 'CONSULT_SENSITIVE_BOT'];
/** Payments and passwords always need a tap, never voice alone (§7.6). */
export const TAP_ONLY: ActionType[] = ['PURCHASE_PAYMENT', 'ENTER_PASSWORD'];

const LEVEL_ORDER: Record<ApprovalLevel, number> = { DONT_ASK: 0, IMPORTANT_ACTIONS: 1, ALWAYS_ASK: 2 };

export interface ApprovalDecision {
    required: boolean;
    reason: 'enforced' | 'tool_rule' | 'bot_rule' | 'level' | 'confirmation' | 'pre_approved' | 'none';
}

/**
 * §13.1 order: the user's "Needs approval" on a specific tool, then organisation-enforced rules (which also beat a
 * user's "Always allow"), then automation pre-approvals (§10.3), then the bot's per-action override, then the
 * effective level (bot level, raised to the organisation minimum). BLOCKED tools are never offered, so never get here.
 */
export function decideApproval(
    action: ActionType | null,
    bot: Bot & { approval_rules?: BotApprovalRule[] },
    org: OrganizationSettings | null,
    opts: { preApproved?: boolean; toolPermission?: ToolPermission } = {},
): ApprovalDecision {
    // Asked for even on read-only tools: the user chose to see every call of this tool.
    if (opts.toolPermission === 'NEEDS_APPROVAL') return { required: true, reason: 'tool_rule' };
    if (!action) return { required: false, reason: 'none' };
    if (action === 'CONSULT_SENSITIVE_BOT') return { required: true, reason: 'enforced' };
    if (org?.enforced_approvals?.includes(action)) return { required: true, reason: 'enforced' };
    if (opts.toolPermission === 'ALWAYS_ALLOW') return { required: false, reason: 'tool_rule' };
    if (opts.preApproved) return { required: false, reason: 'pre_approved' };

    const rule = bot.approval_rules?.find((r) => r.action_type === action);
    if (rule?.override === 'ALWAYS_ASK') return { required: true, reason: 'bot_rule' };

    let level: ApprovalLevel = bot.approval_level;
    const min = org?.min_approval_level;
    if (min && min !== 'NONE' && LEVEL_ORDER[min as ApprovalLevel] > LEVEL_ORDER[level]) level = min as ApprovalLevel;

    if (rule?.override === 'DONT_ASK' && LEVEL_ORDER[level] < LEVEL_ORDER.ALWAYS_ASK) return { required: false, reason: 'bot_rule' };
    if (level === 'ALWAYS_ASK') return { required: true, reason: 'level' };
    if (level === 'IMPORTANT_ACTIONS') return { required: IMPORTANT.includes(action), reason: IMPORTANT.includes(action) ? 'level' : 'none' };
    return { required: false, reason: 'none' };
}

/** Classifies a connected-service tool (e.g. GMAIL_SEND_EMAIL) into an action type by its verb. Read-only tools return null. */
export function classifyToolSlug(slug: string, args: Record<string, unknown>, userEmail?: string | null): ActionType | null {
    const s = slug.toUpperCase();
    if (/(PAY|CHARGE|PURCHASE|CHECKOUT|REFUND|_ORDER\b|CREATE_ORDER|PAYOUT|TRANSFER_FUNDS)/.test(s)) return 'PURCHASE_PAYMENT';
    if (/(DELETE|REMOVE|TRASH|ARCHIVE|DESTROY|PURGE|REVOKE)/.test(s)) return 'DELETE_DATA';
    if (/(SHARE|INVITE|PERMISSION|ADD_COLLABORATOR|MAKE_PUBLIC)/.test(s)) return 'SHARE_FILES';
    if (/(TWEET|POST_TO|CREATE_POST|PUBLISH|LINKEDIN_CREATE|SHARE_POST)/.test(s)) return 'POST_PUBLICLY';
    if (/(SEND|REPLY|FORWARD|POST_MESSAGE|CHAT_POST|CREATE_MESSAGE)/.test(s)) {
        if (/(MAIL|EMAIL|OUTLOOK)/.test(s)) {
            const recipients = JSON.stringify([args.recipient_email, args.to, args.cc, args.bcc, args.recipients, args.extra_recipients].filter(Boolean)).toLowerCase();
            const domain = userEmail?.split('@')[1]?.toLowerCase();
            const emails: string[] = recipients.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? [];
            if (!domain || emails.some((e) => !e.endsWith(`@${domain}`))) return 'EXTERNAL_EMAIL';
        }
        return 'SEND_MESSAGE';
    }
    if (/(CREATE|UPDATE|PATCH|EDIT|MODIFY|MOVE|ADD|INSERT|UPSERT|SET_|RENAME|ASSIGN|MERGE|UPLOAD|COPY|BATCH)/.test(s)) return 'EDIT_RECORDS';
    return null;
}

export const ACTION_LABEL: Record<ActionType, string> = {
    SEND_MESSAGE: 'Send a message',
    POST_PUBLICLY: 'Post publicly',
    EDIT_RECORDS: 'Edit records',
    DELETE_DATA: 'Delete data',
    PURCHASE_PAYMENT: 'Make a payment',
    SHARE_FILES: 'Share files',
    ENTER_PASSWORD: 'Enter a password on a website',
    EXTERNAL_EMAIL: 'Email someone outside the company',
    CONSULT_SENSITIVE_BOT: 'Ask a Sensitive bot',
    OTHER: 'Confirm changes',
};
