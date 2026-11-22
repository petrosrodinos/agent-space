import { Injectable, Logger } from '@nestjs/common';
import { ActionType, ToolServer } from 'generated/prisma';
import { createHash } from 'crypto';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ActivityService } from '../../activity/activity.service';
import { McpToolInfo } from '../../connections/mcp/mcp-client.service';
import { ToolServersService } from '../../connections/mcp/tool-servers.service';
import { classifyToolSlug } from '../approval-policy';
import { ToolContext, ToolDef } from './tool.types';

const MAX_SERVERS = 8;
const MAX_TOOLS_PER_SERVER = 40;

/**
 * Custom tool servers (§8.4) as bot tools: `mcp_<server>__<tool>`. Calls run on our API with the stored token
 * (never shown to the model); results are redacted by the agent loop through ctx.secrets_used.
 */
@Injectable()
export class McpToolsService {
    private readonly logger = new Logger(McpToolsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly servers: ToolServersService,
        private readonly activity: ActivityService,
    ) { }

    /** Servers this bot may use for this user: the user's own and shared ones, honouring "limit to bots". */
    private async serversFor(ctx: ToolContext) {
        if (!ctx.actor) return [];
        const rows = await this.prisma.toolServer.findMany({
            where: { AND: [this.servers.usableWhere(ctx.organization_id, ctx.actor.user_id), { OR: [{ bots: { none: {} } }, { bots: { some: { bot_id: ctx.bot.id } } }] }] },
            include: { connection: { select: { id: true } } },
            orderBy: { created_at: 'asc' },
            take: MAX_SERVERS,
        });
        return rows;
    }

    async tools(ctx: ToolContext): Promise<{ tools: ToolDef[]; summary: string[] }> {
        const servers = await this.serversFor(ctx);
        const out: ToolDef[] = [];
        const summary: string[] = [];
        const used = new Set<string>();
        for (const s of servers) {
            // Servers flagged NEEDS_RECONNECTING are retried when they still hold credentials (or need none): a success
            // in toolsFor() flips them back to ACTIVE, so one transient 401 no longer disconnects them for good.
            const retryable = s.auth_kind === 'NONE' || !!s.credential_id;
            if (s.status === 'NEEDS_RECONNECTING' && !retryable) {
                summary.push(`Custom tool server "${s.name}": needs the user to sign in again on the Connections page`);
                continue;
            }
            let tools: McpToolInfo[];
            try {
                tools = await this.servers.toolsFor(s, ctx.secrets_used);
            } catch (e) {
                this.logger.warn(`Tool server ${s.id} unavailable: ${(e as Error).message}`);
                summary.push(`Custom tool server "${s.name}": currently unavailable`);
                continue;
            }
            if (tools.length > MAX_TOOLS_PER_SERVER) {
                // Too many to list in the prompt: expose search + call so every tool stays reachable.
                summary.push(`Custom tool server "${s.name}" (${tools.length} tools, too many to list: use ${this.prefix(s)}find_tools to search them by keyword, then ${this.prefix(s)}call_tool to run one)`);
                out.push(...this.gatewayTools(s, tools, used));
                continue;
            }
            summary.push(`Custom tool server "${s.name}" (${tools.length} tools, prefixed ${this.prefix(s)})`);
            for (const t of tools) out.push(this.toolDef(s, t, used));
        }
        return { tools: out, summary };
    }

    /** Ranks tools by how many query words appear in their name/title/description (name hits count double). */
    private search(tools: McpToolInfo[], query: string, limit: number) {
        const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        return tools
            .map((t) => {
                const name = t.name.toLowerCase();
                const rest = `${t.title ?? ''} ${t.description ?? ''}`.toLowerCase();
                const score = words.reduce((n, w) => n + (name.includes(w) ? 2 : 0) + (rest.includes(w) ? 1 : 0), 0);
                return { t, score };
            })
            .filter((r) => r.score > 0 || !words.length)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((r) => r.t);
    }

    private gatewayTools(s: ToolServer & { connection: { id: string } | null }, tools: McpToolInfo[], used: Set<string>): ToolDef[] {
        const byName = new Map(tools.map((t) => [t.name, t]));
        const finder: ToolDef = {
            name: this.toolName(s, 'find_tools', used),
            description: `[${s.name}] Search the ${tools.length} tools of this server by keyword (e.g. "contacts", "create campaign"). Returns matching tool names with descriptions and input schemas; run one with call_tool.`,
            parameters: { type: 'object', properties: { query: { type: 'string', description: 'Keywords describing what you want to do' }, limit: { type: 'number', description: 'Max results (default 8, max 20)' } }, required: ['query'] },
            step_type: 'CONNECTION_CALL',
            runs_on: 'server',
            title: (args) => `Searching ${s.name} tools for "${String(args?.query ?? '').slice(0, 60)}"`,
            execute: async (args) => {
                const limit = Math.min(Math.max(Number(args?.limit) || 8, 1), 20);
                const found = this.search(tools, String(args?.query ?? ''), limit);
                return {
                    output: found.length
                        ? found.map((t) => ({ tool: t.name, description: (t.description ?? t.title ?? '').slice(0, 400), read_only: !!t.annotations?.readOnlyHint, input_schema: this.schema(t.input_schema) }))
                        : `No tool matched. Try different keywords; the server has ${tools.length} tools.`,
                };
            },
        };
        const caller: ToolDef = {
            name: this.toolName(s, 'call_tool', used),
            description: `[${s.name}] Run one of this server's tools by exact name (find it with find_tools first). Pass its input as "arguments".`,
            parameters: { type: 'object', properties: { tool: { type: 'string', description: 'Exact tool name from find_tools' }, arguments: { type: 'object', description: 'Input for that tool, per its input_schema' } }, required: ['tool'] },
            step_type: 'CONNECTION_CALL',
            runs_on: 'server',
            title: (args) => `${byName.get(args?.tool)?.title || args?.tool || 'Tool'} — ${s.name}`,
            classify: (args, ctx) => {
                const t = byName.get(args?.tool);
                if (!t) return null; // execute rejects unknown tools
                const base = this.classify(t);
                return base === 'SEND_MESSAGE' ? (classifyToolSlug(t.name, args?.arguments ?? {}, ctx.user?.email) ?? base) : base;
            },
            connection_id: s.connection?.id,
            connectionFor: () => s.connection?.id,
            preview: async (args) => {
                const t = byName.get(args?.tool);
                return {
                    title: `${t?.title || args?.tool} with ${s.name}`,
                    action_type: (t && this.classify(t)) || 'OTHER',
                    preview: { kind: 'tool', service: s.name, account: s.name, tool: args?.tool, input: args?.arguments ?? {} },
                };
            },
            execute: async (args, ctx) => {
                const t = byName.get(args?.tool);
                if (!t) throw new Error(`${s.name} has no tool named "${args?.tool}". Use find_tools to look it up.`);
                return this.run(s, t, args?.arguments ?? {}, ctx);
            },
        };
        return [finder, caller];
    }

    private async run(s: ToolServer & { connection: { id: string } | null }, t: McpToolInfo, args: Record<string, unknown>, ctx: ToolContext) {
        const res = await this.servers.call(s, t.name, args, ctx.secrets_used);
        if (s.connection) await this.prisma.connection.update({ where: { id: s.connection.id }, data: { last_used_at: new Date() } });
        await this.activity.log({
            organization_id: ctx.organization_id,
            actor_bot_id: ctx.bot.id,
            on_behalf_of_id: ctx.run.user_id,
            action: 'tool_server.used',
            target_type: 'tool_server',
            target_id: s.id,
            connection_id: s.connection?.id ?? null,
            run_id: ctx.run.id,
            metadata: { tool: t.name, error: res.is_error },
        });
        if (res.is_error) throw new Error(`${s.name} returned an error: ${res.content.slice(0, 800)}`);
        return { output: res.structured ? { content: res.content, data: res.structured } : res.content, connection_id: s.connection?.id };
    }

    private prefix(s: ToolServer) {
        const short = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 16) || 'server';
        return `mcp_${short}__`;
    }

    /** OpenAI-style names: ^[a-zA-Z0-9_-]{1,64}$, unique within the run. */
    private toolName(s: ToolServer, tool: string, used: Set<string>) {
        let name = `${this.prefix(s)}${tool.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        if (name.length > 64 || used.has(name)) name = `${name.slice(0, 55)}_${createHash('sha1').update(`${s.id}:${tool}`).digest('hex').slice(0, 8)}`;
        used.add(name);
        return name;
    }

    private schema(input: Record<string, unknown>) {
        const p = JSON.parse(JSON.stringify(input ?? {}));
        delete p.$schema;
        p.type = 'object';
        p.properties = p.properties ?? {};
        return p;
    }

    private classify(t: McpToolInfo): ActionType | null {
        if (t.annotations?.readOnlyHint) return null;
        if (t.annotations?.destructiveHint) return 'DELETE_DATA';
        return classifyToolSlug(t.name, {}) ?? 'OTHER';
    }

    private toolDef(s: ToolServer & { connection: { id: string } | null }, t: McpToolInfo, used: Set<string>): ToolDef {
        const label = t.title || t.name;
        return {
            name: this.toolName(s, t.name, used),
            description: `[${s.name}] ${t.description ?? label}`.slice(0, 1000),
            parameters: this.schema(t.input_schema),
            step_type: 'CONNECTION_CALL',
            runs_on: 'server',
            title: () => `${label} — ${s.name}`,
            classify: (args, ctx) => {
                const base = this.classify(t);
                // Refine by arguments (e.g. external email recipients) when the verb suggests sending.
                return base === 'SEND_MESSAGE' ? (classifyToolSlug(t.name, args ?? {}, ctx.user?.email) ?? base) : base;
            },
            connection_id: s.connection?.id,
            connectionFor: () => s.connection?.id,
            preview: async (args) => ({
                title: `${label} with ${s.name}`,
                action_type: this.classify(t) ?? 'OTHER',
                preview: { kind: 'tool', service: s.name, account: s.name, tool: t.name, input: args ?? {} },
            }),
            execute: (args, ctx) => this.run(s, t, args ?? {}, ctx),
        };
    }
}
