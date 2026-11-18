import { ActionType, Bot, BotApprovalRule, OrganizationSettings, Run, RunStepType, User, UserSettings } from 'generated/prisma';

export type MessagePart = Record<string, unknown> & { type: string };

export interface ToolContext {
    run: Run;
    bot: Bot & { approval_rules: BotApprovalRule[] };
    user: User | null;
    user_settings: UserSettings | null;
    org_settings: OrganizationSettings | null;
    organization_id: string;
    /** The user the bot acts for, with their organisation role — tools never exceed what this user may do (§6.5). */
    actor: { user_id: string; organization_id: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' } | null;
    conversation_id: string | null;
    is_temporary: boolean;
    /** Whether the run's model can see images (screenshots from the cloud computer). */
    supports_vision: boolean;
    /** Secret values used during this call — redacted from every result before the model, logs or the DB see them (§8.7). */
    secrets_used: string[];
    /** Adds a part to the bot's message (interactive reply, file, sources…) and publishes it. */
    addPart: (part: MessagePart) => Promise<void>;
}

export interface ToolWaitForInput {
    wait: 'input';
    request_id: string;
    part: MessagePart;
}

export interface ToolOutput {
    output: unknown;
    /** Images (data URLs) shown to the model after the tool result, e.g. cloud computer screenshots. */
    images?: string[];
    /** Optional connection used, for the activity history. */
    connection_id?: string;
}

export type ToolResult = ToolOutput | ToolWaitForInput;

export interface ApprovalPreview {
    title: string;
    action_type: ActionType;
    preview: Record<string, unknown>;
    requires_tap?: boolean;
}

export interface ToolDef {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    step_type: RunStepType;
    /** Every tool knows where it runs (§14.1). `device` is reserved for desktop/mobile tools. */
    runs_on: 'server' | 'device';
    /** Friendly activity-feed line: "Searching the web for …". */
    title: (args: any, ctx: ToolContext) => string;
    /** Action type for the approval engine; null = no approval needed. */
    classify?: (args: any, ctx: ToolContext) => ActionType | null | Promise<ActionType | null>;
    /** App-management changes always show a summary and need confirmation (§6.6). */
    confirm?: boolean;
    preview?: (args: any, ctx: ToolContext) => Promise<ApprovalPreview>;
    execute: (args: any, ctx: ToolContext) => Promise<ToolResult>;
    connection_id?: string;
    /** Which connection a call would use — matched against automation pre-approvals (§10.3). */
    connectionFor?: (args: any) => string | undefined;
}

export const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
