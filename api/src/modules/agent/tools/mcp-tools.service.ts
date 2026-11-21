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
            summary.push(`Custom tool server "${s.name}" (${tools.length} tools, prefixed ${this.prefix(s)})`);
            for (const t of tools.slice(0, MAX_TOOLS_PER_SERVER)) out.push(this.toolDef(s, t, used));
        }
        return { tools: out, summary };
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
            execute: async (args, ctx) => {
                const res = await this.servers.call(s, t.name, args ?? {}, ctx.secrets_used);
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
            },
        };
    }
}
