import { Injectable } from '@nestjs/common';
import { ActionType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AccessService } from '../../access/access.service';
import { AutomationsService, MEMORY_MAX_BYTES } from '../../automations/automations.service';
import { cronError, describeCron, frequencyError, isValidTimezone } from '../../automations/automation-schedule.utils';
import { ACTION_LABEL } from '../approval-policy';
import { ConnectionToolsService } from './connection-tools.service';
import { obj, ToolContext, ToolDef } from './tool.types';

const ACTION_TYPES = Object.keys(ACTION_LABEL) as ActionType[];

interface PreApprovalArg {
    action_type: ActionType;
    connection?: string;
    target: string;
}

/**
 * Automations by chat (§10.2): the bot sorts out schedule, accounts, pre-approvals, memory and destination, the user
 * confirms a summary card, then it's saved. During automation runs only: the automation's memory (§10.4).
 */
@Injectable()
export class AutomationToolsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: AccessService,
        private readonly automations: AutomationsService,
        private readonly connectionTools: ConnectionToolsService,
    ) { }

    tools(ctx: ToolContext): ToolDef[] {
        const t: ToolDef[] = [];
        if (ctx.run.automation_run_id) t.push(this.memoryRead(), this.memoryWrite());
        if (ctx.actor && ctx.org_settings?.automations_enabled !== false && !ctx.run.automation_run_id) t.push(this.createAutomation(), this.listAutomations(), this.updateAutomation());
        return t;
    }

    // ---------------- Helpers ----------------

    private async timezone(ctx: ToolContext, tz?: string) {
        if (tz) {
            if (!isValidTimezone(tz)) throw new Error(`Unknown time zone "${tz}"`);
            return tz;
        }
        return ctx.user?.timezone || ctx.org_settings?.default_timezone || 'UTC';
    }

    private checkSchedule(ctx: ToolContext, cron: string, tz: string) {
        const err = cronError(cron, tz) ?? frequencyError(cron, tz, ctx.org_settings?.max_schedule_frequency ?? 'EVERY_HOUR');
        if (err) throw new Error(err);
    }

    private async connectionByLabel(ctx: ToolContext, label: string) {
        const conns = await this.connectionTools.connectionsFor(ctx);
        const q = label.trim().toLowerCase();
        const c = conns.find((x) => x.label.toLowerCase() === q) ?? conns.find((x) => x.service_name.toLowerCase() === q || x.service_key === q) ?? conns.find((x) => x.label.toLowerCase().includes(q));
        if (!c) throw new Error(`No connected account called "${label}". Ask the user to connect it on the Connections page first.`);
        return c;
    }

    private async resolve(ctx: ToolContext, a: Record<string, any>) {
        const tz = await this.timezone(ctx, a.timezone);
        if (a.cron) this.checkSchedule(ctx, String(a.cron), tz);
        const connections = [];
        for (const label of (a.connections ?? []) as string[]) connections.push(await this.connectionByLabel(ctx, label));
        const preApprovals: { action_type: ActionType; connection_id: string | null; connection_label: string | null; target: string }[] = [];
        const enforced = ctx.org_settings?.enforced_approvals ?? [];
        for (const p of (a.pre_approvals ?? []) as PreApprovalArg[]) {
            if (!ACTION_TYPES.includes(p.action_type)) throw new Error(`Unknown action type ${p.action_type}`);
            if (enforced.includes(p.action_type)) throw new Error(`"${ACTION_LABEL[p.action_type]}" always needs approval in this organisation and can't be pre-approved; tell the user every run will wait for approval at that step, and leave it out.`);
            if (ctx.org_settings && !ctx.org_settings.automation_pre_approvals) throw new Error('This organisation does not allow pre-approved actions; leave pre_approvals empty and tell the user runs will ask for approval.');
            const c = p.connection ? await this.connectionByLabel(ctx, p.connection) : null;
            if (c && !connections.some((x) => x.id === c.id)) connections.push(c);
            preApprovals.push({ action_type: p.action_type, connection_id: c?.id ?? null, connection_label: c?.label ?? null, target: String(p.target).trim() });
        }
        const resultsConn = a.results_connection ? await this.connectionByLabel(ctx, a.results_connection) : null;
        if (resultsConn && !connections.some((x) => x.id === resultsConn.id)) connections.push(resultsConn);
        let skill: { id: string; slug: string; name: string; emoji: string | null } | null = null;
        if (a.skill) {
            const q = String(a.skill).replace(/^\//, '').toLowerCase();
            skill = await this.prisma.skill.findFirst({ where: { ...this.access.usableSkillsWhere(ctx.organization_id, ctx.actor!.user_id), OR: [{ slug: q }, { name: { equals: a.skill, mode: 'insensitive' } }] }, select: { id: true, slug: true, name: true, emoji: true } });
            if (!skill) throw new Error(`No skill called "${a.skill}"`);
        }
        return { tz, connections, preApprovals, resultsConn, skill };
    }

    private async findAutomation(ctx: ToolContext, ref: string) {
        const list = await this.prisma.automation.findMany({ where: { organization_id: ctx.organization_id, owner_id: ctx.actor!.user_id, deleted_at: null }, select: { id: true, name: true, status: true, cron_expression: true, timezone: true } });
        const q = ref.trim().toLowerCase();
        const a = list.find((x) => x.id === ref) ?? list.find((x) => x.name.toLowerCase() === q) ?? list.find((x) => x.name.toLowerCase().includes(q));
        if (!a) throw new Error(`No automation called "${ref}"`);
        return a;
    }

    private automationIdFor(ctx: ToolContext) {
        return this.prisma.automationRun.findUnique({ where: { id: ctx.run.automation_run_id! }, select: { automation_id: true } }).then((r) => {
            if (!r) throw new Error('This run is not part of an automation');
            return r.automation_id;
        });
    }

    // ---------------- Tools ----------------

    private createAutomation(): ToolDef {
        return {
            name: 'create_automation',
            description:
                'Save a recurring job you will do by yourself on a schedule ("every morning at 8 summarise my emails"). BEFORE calling: make sure every account it needs is connected (ask the user to connect missing ones), agree the time (in the user\'s time zone), what to pre-approve (one action to one specific place each, e.g. SEND_MESSAGE to "channel:#security" in "Slack – Company"), what to remember between runs and where results go. The user sees a summary card and must confirm.',
            parameters: obj(
                {
                    name: { type: 'string', description: 'Short name, e.g. "Daily vulnerability scan – x"' },
                    instructions: { type: 'string', description: 'What to do on each run, in plain language, complete and self-contained' },
                    cron: { type: 'string', description: '5-part cron in the user\'s time zone, e.g. "0 7 * * *" (every day 07:00), "0 16 * * 5" (Fridays 16:00), "0 8 * * 1-5" (weekdays 08:00)' },
                    timezone: { type: 'string', description: 'IANA time zone; defaults to the user\'s' },
                    skill: { type: 'string', description: 'Optional skill short name to follow on each run' },
                    connections: { type: 'array', items: { type: 'string' }, description: 'Labels of connected accounts it uses' },
                    pre_approvals: {
                        type: 'array',
                        items: obj({ action_type: { type: 'string', enum: ACTION_TYPES }, connection: { type: 'string', description: 'Account label' }, target: { type: 'string', description: 'One specific place, e.g. "channel:#security", "repo:acme/x", "email:anna@acme.com"' } }, ['action_type', 'target']),
                    },
                    memory_plan: { type: 'string', description: 'What it keeps between runs, e.g. "the previous run\'s findings, to report only what\'s new"' },
                    email_results: { type: 'boolean', description: 'Also email the results to the user' },
                    results_connection: { type: 'string', description: 'Account label when results also go to a connected service' },
                    results_target: { type: 'string', description: 'Where in that service, e.g. "channel:#security"' },
                    uses_cloud_computer: { type: 'boolean' },
                },
                ['name', 'instructions', 'cron'],
            ),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            confirm: true,
            title: (a) => `Creating automation "${a.name}"`,
            preview: async (a, ctx) => {
                const r = await this.resolve(ctx, a);
                const changes = [
                    { field: 'name', to: a.name },
                    { field: 'bot', to: `${ctx.bot.emoji} ${ctx.bot.name}` },
                    { field: 'when', to: `${describeCron(a.cron)} (${r.tz})` },
                    { field: 'instructions', to: String(a.instructions).slice(0, 600) },
                    ...(r.skill ? [{ field: 'skill', to: `${r.skill.emoji ? `${r.skill.emoji} ` : ''}${r.skill.name}` }] : []),
                    { field: 'uses', to: r.connections.length ? r.connections.map((c) => c.label).join(', ') : 'No connected accounts' },
                    { field: 'pre_approved', to: r.preApprovals.length ? r.preApprovals.map((p) => `${ACTION_LABEL[p.action_type]} → ${p.target}${p.connection_label ? ` (${p.connection_label})` : ''}`).join('\n') : 'Nothing — runs ask before sensitive actions' },
                    { field: 'remembers', to: a.memory_plan || 'Nothing between runs' },
                    { field: 'results_go_to', to: ['This conversation', ...(a.email_results ? ['Email'] : []), ...(r.resultsConn ? [`${r.resultsConn.label} ${a.results_target ?? ''}`.trim()] : [])].join(', ') },
                    ...(a.uses_cloud_computer ? [{ field: 'cloud_computer', to: 'Yes' }] : []),
                ];
                const enforced = (ctx.org_settings?.enforced_approvals ?? []).map((x) => ACTION_LABEL[x]);
                return { title: `Create automation "${a.name}"`, action_type: 'OTHER', preview: { kind: 'change', target: a.name, changes, warning: enforced.length ? `Always asks for approval (organisation rule): ${enforced.join(', ')}.` : undefined } };
            },
            execute: async (a, ctx) => {
                const r = await this.resolve(ctx, a);
                const conv = ctx.conversation_id && !ctx.is_temporary ? ctx.conversation_id : null;
                const created = await this.automations.create(ctx.actor!, {
                    name: a.name,
                    bot_id: ctx.bot.id,
                    instructions: a.instructions,
                    cron_expression: a.cron,
                    timezone: r.tz,
                    skill_id: r.skill?.id ?? null,
                    connection_ids: r.connections.map((c) => c.id),
                    pre_approvals: r.preApprovals.map((p) => ({ action_type: p.action_type, connection_id: p.connection_id, target: p.target })),
                    memory_plan: a.memory_plan ?? null,
                    uses_cloud_computer: !!a.uses_cloud_computer,
                    results_conversation_id: conv,
                    source_conversation_id: conv,
                    email_results: !!a.email_results,
                    results_connection_id: r.resultsConn?.id ?? null,
                    results_target: a.results_target ?? null,
                });
                await ctx.addPart({ type: 'automation', automation_id: created.id, name: created.name, schedule: created.schedule_description, next_run_at: created.next_run_at });
                return { output: { created: true, id: created.id, name: created.name, schedule: created.schedule_description, next_run_at: created.next_run_at } };
            },
        };
    }

    private listAutomations(): ToolDef {
        return {
            name: 'list_automations',
            description: 'List the user\'s automations with status, schedule and last/next run.',
            parameters: obj({ only_this_bot: { type: 'boolean' } }),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Checking automations',
            execute: async (a, ctx) => {
                const list = await this.automations.list(ctx.actor!, a.only_this_bot ? { bot_id: ctx.bot.id } : {});
                return {
                    output: list.map((x: any) => ({ id: x.id, name: x.name, bot: x.bot?.name, status: x.status, reason: x.status_reason, schedule: x.schedule_description, timezone: x.timezone, next_run_at: x.next_run_at, last_run: x.last_run?.status ?? null, pre_approvals: x.pre_approvals?.length ?? 0 })),
                };
            },
        };
    }

    private updateAutomation(): ToolDef {
        return {
            name: 'update_automation',
            description: 'Change, pause, resume or run now one of the user\'s automations ("move my morning summary to 7:30", "pause the scan"). The user confirms. Changing instructions or accounts means pre-approvals must be confirmed again on the Automations page.',
            parameters: obj(
                {
                    automation: { type: 'string', description: 'Automation name or id' },
                    action: { type: 'string', enum: ['update', 'pause', 'resume', 'run_now'] },
                    name: { type: 'string' },
                    instructions: { type: 'string', description: 'The FULL new instructions' },
                    cron: { type: 'string' },
                    timezone: { type: 'string' },
                    memory_plan: { type: 'string' },
                },
                ['automation', 'action'],
            ),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            confirm: true,
            title: (a) => `${a.action === 'pause' ? 'Pausing' : a.action === 'resume' ? 'Resuming' : a.action === 'run_now' ? 'Running' : 'Updating'} "${a.automation}"`,
            preview: async (a, ctx) => {
                const found = await this.findAutomation(ctx, a.automation);
                if (a.cron) this.checkSchedule(ctx, a.cron, await this.timezone(ctx, a.timezone ?? found.timezone ?? undefined));
                const changes =
                    a.action === 'update'
                        ? [
                            ...(a.name ? [{ field: 'name', to: a.name }] : []),
                            ...(a.cron ? [{ field: 'when', to: describeCron(a.cron) }] : []),
                            ...(a.timezone ? [{ field: 'time_zone', to: a.timezone }] : []),
                            ...(a.instructions ? [{ field: 'instructions', to: String(a.instructions).slice(0, 600) }] : []),
                            ...(a.memory_plan ? [{ field: 'remembers', to: a.memory_plan }] : []),
                        ]
                        : [{ field: 'action', to: a.action === 'run_now' ? 'Run now' : a.action === 'pause' ? 'Pause' : 'Resume' }];
                return { title: `${a.action === 'update' ? 'Update' : a.action === 'run_now' ? 'Run' : a.action === 'pause' ? 'Pause' : 'Resume'} automation "${found.name}"`, action_type: 'OTHER', preview: { kind: 'change', target: found.name, changes } };
            },
            execute: async (a, ctx) => {
                const found = await this.findAutomation(ctx, a.automation);
                if (a.action === 'pause') await this.automations.pause(ctx.actor!, found.id);
                else if (a.action === 'resume') await this.automations.resume(ctx.actor!, found.id);
                else if (a.action === 'run_now') return { output: await this.automations.runNow(ctx.actor!, found.id) };
                else {
                    const updated = await this.automations.update(ctx.actor!, found.id, {
                        ...(a.name ? { name: a.name } : {}),
                        ...(a.instructions ? { instructions: a.instructions } : {}),
                        ...(a.cron ? { cron_expression: a.cron } : {}),
                        ...(a.timezone ? { timezone: a.timezone } : {}),
                        ...(a.memory_plan ? { memory_plan: a.memory_plan } : {}),
                    });
                    return { output: { updated: true, name: updated.name, schedule: updated.schedule_description, next_run_at: updated.next_run_at, pre_approvals_need_confirmation: !updated.pre_approvals_confirmed_at && (updated.pre_approvals?.length ?? 0) > 0 } };
                }
                return { output: { ok: true, action: a.action, name: found.name } };
            },
        };
    }

    private memoryRead(): ToolDef {
        return {
            name: 'automation_memory_read',
            description: 'Read this automation\'s memory (notes kept from previous runs). Call at the start of every run.',
            parameters: obj({}),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Reading automation memory',
            execute: async (_a, ctx) => {
                const id = await this.automationIdFor(ctx);
                const notes = await this.automations.readMemory(id);
                return { output: { notes, empty: !Object.keys(notes).length } };
            },
        };
    }

    private memoryWrite(): ToolDef {
        return {
            name: 'automation_memory_write',
            description: 'Save what the next run of this automation needs (e.g. last findings, items already handled, date of last report). Max 1 MB. Mode "merge" updates top-level keys; "replace" overwrites everything.',
            parameters: obj({ notes: { type: 'object', description: 'JSON notes' }, mode: { type: 'string', enum: ['merge', 'replace'] } }, ['notes']),
            step_type: 'TOOL_CALL',
            runs_on: 'server',
            title: () => 'Updating automation memory',
            execute: async (a, ctx) => {
                const id = await this.automationIdFor(ctx);
                const incoming = a.notes && typeof a.notes === 'object' && !Array.isArray(a.notes) ? (a.notes as Record<string, unknown>) : { value: a.notes };
                const notes = a.mode === 'replace' ? incoming : { ...(await this.automations.readMemory(id)), ...incoming };
                await this.automations.writeMemory(id, notes);
                const size = Buffer.byteLength(JSON.stringify(notes));
                return { output: { saved: true, size_kb: Math.round(size / 1024), limit_kb: MEMORY_MAX_BYTES / 1024 } };
            },
        };
    }
}
