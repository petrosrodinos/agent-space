/**
 * Undo (§16) for actions where the connected service allows it: each rule turns a successful call (its input and the
 * service's answer) into the call that reverses it. Sending an email or a reply can't be taken back, so those have no
 * rule. Slugs and parameter names are Composio's (checked against the tool schemas).
 */

export interface UndoPlan {
    /** Composio tool that reverses the action. */
    tool: string;
    args: Record<string, unknown>;
    /** Shown on the button's confirmation, e.g. "Delete the calendar event". */
    label: string;
}

type Rule = (input: Record<string, unknown>, output: unknown) => UndoPlan | null;

/** How long Undo stays available after the action. */
export const UNDO_WINDOW_MS = 24 * 3600_000;

/** First value found for any of `keys`, searching the object breadth-first (service answers nest ids differently). */
export function findValue(value: unknown, keys: string[], maxDepth = 5): string | undefined {
    let level: unknown[] = [value];
    for (let depth = 0; depth <= maxDepth && level.length; depth++) {
        const next: unknown[] = [];
        for (const v of level) {
            if (!v || typeof v !== 'object') continue;
            if (Array.isArray(v)) {
                next.push(...v.slice(0, 5));
                continue;
            }
            const o = v as Record<string, unknown>;
            for (const k of keys) if ((typeof o[k] === 'string' || typeof o[k] === 'number') && String(o[k])) return String(o[k]);
            next.push(...Object.values(o));
        }
        level = next;
    }
    return undefined;
}

const byId = (tool: string, param: string, label: string, keys = ['id'], extra: (i: Record<string, unknown>) => Record<string, unknown> = () => ({})): Rule => (input, output) => {
    const id = findValue(output, keys);
    return id ? { tool, args: { [param]: id, ...extra(input) }, label } : null;
};

const slackMessage: Rule = (input, output) => {
    const ts = findValue(output, ['ts']);
    const channel = findValue(output, ['channel']) ?? (typeof input.channel === 'string' ? input.channel : undefined);
    return ts && channel ? { tool: 'SLACK_DELETES_A_MESSAGE_FROM_A_CHAT', args: { channel, ts }, label: 'Delete the Slack message' } : null;
};

export const UNDO_RULES: Record<string, Rule> = {
    GOOGLECALENDAR_CREATE_EVENT: byId('GOOGLECALENDAR_DELETE_EVENT', 'event_id', 'Delete the calendar event', ['id'], (i) => ({ calendar_id: i.calendar_id ?? 'primary' })),
    GOOGLECALENDAR_QUICK_ADD: byId('GOOGLECALENDAR_DELETE_EVENT', 'event_id', 'Delete the calendar event', ['id'], (i) => ({ calendar_id: i.calendar_id ?? 'primary' })),
    GMAIL_CREATE_EMAIL_DRAFT: byId('GMAIL_DELETE_DRAFT', 'draft_id', 'Delete the draft', ['draft_id', 'id']),
    GMAIL_CREATE_LABEL: byId('GMAIL_REMOVE_LABEL', 'label_id', 'Delete the label'),
    GMAIL_ADD_LABEL_TO_EMAIL: (i) =>
        typeof i.message_id === 'string' ? { tool: 'GMAIL_ADD_LABEL_TO_EMAIL', args: { message_id: i.message_id, add_label_ids: i.remove_label_ids ?? [], remove_label_ids: i.add_label_ids ?? [] }, label: 'Put the labels back' } : null,
    LINEAR_CREATE_LINEAR_ISSUE: byId('LINEAR_DELETE_LINEAR_ISSUE', 'issue_id', 'Delete the Linear issue'),
    SLACK_CHAT_POST_MESSAGE: slackMessage,
    SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL: slackMessage,
    SLACK_SEND_MESSAGE: slackMessage,
    SLACK_ADD_REACTION_TO_AN_ITEM: (i) => (typeof i.name === 'string' ? { tool: 'SLACK_REMOVE_REACTION_FROM_ITEM', args: { name: i.name, channel: i.channel, timestamp: i.timestamp }, label: 'Remove the reaction' } : null),
    SLACK_CREATE_A_REMINDER: byId('SLACK_DELETE_A_SLACK_REMINDER', 'reminder', 'Delete the Slack reminder'),
    NOTION_CREATE_NOTION_PAGE: byId('NOTION_ARCHIVE_NOTION_PAGE', 'page_id', 'Archive the Notion page', ['id'], () => ({ archive: true })),
    ASANA_CREATE_A_TASK: byId('ASANA_DELETE_TASK', 'task_gid', 'Delete the Asana task', ['gid']),
    JIRA_CREATE_ISSUE: byId('JIRA_DELETE_ISSUE', 'issue_id_or_key', 'Delete the Jira issue', ['key', 'id']),
    TODOIST_CREATE_TASK: byId('TODOIST_DELETE_TASK', 'task_id', 'Delete the Todoist task'),
    TRELLO_ADD_CARDS: byId('TRELLO_DELETE_CARDS_BY_ID_CARD', 'idCard', 'Delete the Trello card'),
    HUBSPOT_CREATE_CONTACT: byId('HUBSPOT_ARCHIVE_CONTACT_BY_ID', 'contactId', 'Archive the HubSpot contact'),
    GOOGLEDRIVE_CREATE_FILE: byId('GOOGLEDRIVE_GOOGLE_DRIVE_DELETE_FOLDER_OR_FILE_ACTION', 'fileId', 'Delete the Drive file'),
    GOOGLEDRIVE_CREATE_FILE_FROM_TEXT: byId('GOOGLEDRIVE_GOOGLE_DRIVE_DELETE_FOLDER_OR_FILE_ACTION', 'fileId', 'Delete the Drive file'),
    GOOGLEDRIVE_CREATE_FOLDER: byId('GOOGLEDRIVE_GOOGLE_DRIVE_DELETE_FOLDER_OR_FILE_ACTION', 'fileId', 'Delete the Drive folder'),
    GITHUB_CREATE_AN_ISSUE: (i, o) => {
        const n = findValue(o, ['number']);
        return n && i.owner && i.repo ? { tool: 'GITHUB_UPDATE_AN_ISSUE', args: { owner: i.owner, repo: i.repo, issue_number: Number(n), state: 'closed', state_reason: 'not_planned' }, label: 'Close the GitHub issue' } : null;
    },
};

/** The plan for a successful call, or null when it can't be undone. */
export function undoPlanFor(slug: string, input: Record<string, unknown>, output: unknown): UndoPlan | null {
    const rule = UNDO_RULES[slug.toUpperCase()];
    if (!rule) return null;
    try {
        return rule(input ?? {}, output);
    } catch {
        return null;
    }
}
