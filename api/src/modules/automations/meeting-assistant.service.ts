import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { Actor } from '../bots/bots.service';
import { AutomationsService } from './automations.service';

/** What a member's meeting assistant is set up with (stored on their membership). */
export interface MeetingAssistantConfig {
    bot_id: string;
    calendar_connection_id: string;
    email_connection_id: string | null;
    briefs_automation_id: string | null;
    follow_ups_automation_id: string | null;
}

export interface MeetingAssistantInput {
    bot_id: string;
    calendar_connection_id: string;
    email_connection_id?: string | null;
    briefs: boolean;
    follow_ups: boolean;
}

const CALENDAR_SERVICES = ['googlecalendar', 'outlook', 'microsoft_outlook', 'outlookcalendar'];
const EMAIL_SERVICES = ['gmail', 'outlook', 'microsoft_outlook'];
/** Hourly (allowed by every organisation's frequency limit): briefs at :45 for the coming hour, follow-ups at :05 for the past hour. */
const BRIEFS_CRON = '45 * * * *';
const FOLLOW_UPS_CRON = '5 * * * *';
const BRIEFS_NAME = 'Meeting briefs';
const FOLLOW_UPS_NAME = 'Meeting follow-ups';

const briefsInstructions = (calendar: string, email: string | null) =>
    `Using the calendar "${calendar}", find meetings that start between 15 and 75 minutes from now: events with at least one other attendee or a video-call link, that are not declined or cancelled. Skip any event id already listed in your memory as briefed.\n\n` +
    `For each new meeting, prepare a short brief:\n- When, where or which link, and who's attending (name, role and company when you can tell).\n` +
    `${email ? `- What you've recently discussed with them: search "${email}" for the latest emails with each attendee (last 60 days) and summarise in one or two lines.\n` : ''}` +
    `- Anything useful from other connected accounts (e.g. CRM records for their company), and public information about an external company if it helps.\n- The likely purpose, open questions and a suggested agenda (3 bullets).\n\n` +
    `Post one brief per meeting, short and scannable. If there are no new meetings, reply only "No meetings to brief." Never send emails or messages to attendees. Save the briefed event ids (keep the last 7 days) in your memory.`;

const followUpsInstructions = (calendar: string, email: string | null) =>
    `Using the calendar "${calendar}", find meetings that ended in the last 75 minutes: events with at least one other attendee or a video-call link. Skip any event id already in your memory as followed up.\n\n` +
    `For each new one, ${email ? `write a follow-up email to the other attendees and save it as a DRAFT in "${email}" (never send it): thank them, recap the purpose in one line, and list next steps as placeholders the owner fills in ([decision], [owner], [date]). Then post a short note with who it's for and that the draft is ready to review.` : 'post a short follow-up note the owner can send: thanks, a one-line recap and next steps as placeholders.'}\n\n` +
    `If there are none, reply only "No meetings to follow up." Save the followed-up event ids (keep the last 7 days) in your memory.`;

/**
 * Meeting assistant (§16): prepares briefs before meetings and drafts follow-ups after. It's two ordinary automations
 * (§10.2) owned by the member, so they show on the Automations page with their runs, memory and pause/resume.
 */
@Injectable()
export class MeetingAssistantService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: AccessService,
        private readonly automations: AutomationsService,
    ) { }

    private async member(actor: Actor) {
        return this.prisma.organizationMember.findUniqueOrThrow({ where: { organization_id_user_id: { organization_id: actor.organization_id, user_id: actor.user_id } } });
    }

    async get(actor: Actor) {
        const m = await this.member(actor);
        const cfg = m.meeting_assistant as unknown as MeetingAssistantConfig | null;
        if (!cfg) return { enabled: false, config: null, briefs: null, follow_ups: null };
        const ids = [cfg.briefs_automation_id, cfg.follow_ups_automation_id].filter((x): x is string => !!x);
        const autos = await this.prisma.automation.findMany({ where: { id: { in: ids }, deleted_at: null }, select: { id: true, name: true, status: true, status_reason: true, last_run_at: true, next_run_at: true } });
        const find = (id: string | null) => autos.find((a) => a.id === id) ?? null;
        return { enabled: autos.length > 0, config: cfg, briefs: find(cfg.briefs_automation_id), follow_ups: find(cfg.follow_ups_automation_id) };
    }

    private async connection(actor: Actor, id: string, services: string[], what: string) {
        const c = await this.prisma.connection.findFirst({ where: { id, ...this.access.usableConnectionsWhere(actor.organization_id, actor.user_id) } });
        if (!c) throw new NotFoundException(`${what} account not found`);
        if (!services.includes(c.service_key)) throw new BadRequestException(`Pick a ${what.toLowerCase()} account (${what === 'Calendar' ? 'Google Calendar or Outlook' : 'Gmail or Outlook'})`);
        if (c.status !== 'ACTIVE') throw new BadRequestException(`Reconnect "${c.label}" first`);
        return c;
    }

    /** Turns it on or changes it: creates, updates or removes the two automations to match. */
    async set(actor: Actor, dto: MeetingAssistantInput) {
        if (!dto.briefs && !dto.follow_ups) return this.disable(actor);
        await this.access.requireUsableBot(actor.organization_id, actor.user_id, dto.bot_id);
        const calendar = await this.connection(actor, dto.calendar_connection_id, CALENDAR_SERVICES, 'Calendar');
        const email = dto.email_connection_id ? await this.connection(actor, dto.email_connection_id, EMAIL_SERVICES, 'Email') : null;
        const m = await this.member(actor);
        const prev = (m.meeting_assistant as unknown as MeetingAssistantConfig | null) ?? null;
        const connection_ids = [calendar.id, ...(email ? [email.id] : [])];

        const upsert = async (want: boolean, existingId: string | null, name: string, cron: string, instructions: string, memory: string): Promise<string | null> => {
            const exists = existingId ? await this.prisma.automation.findFirst({ where: { id: existingId, owner_id: actor.user_id, deleted_at: null } }) : null;
            if (!want) {
                if (exists) await this.automations.remove(actor, exists.id);
                return null;
            }
            if (exists) {
                await this.automations.update(actor, exists.id, { bot_id: dto.bot_id, instructions, cron_expression: cron, connection_ids, memory_plan: memory });
                return exists.id;
            }
            const created = await this.automations.create(actor, { name, bot_id: dto.bot_id, instructions, cron_expression: cron, connection_ids, memory_plan: memory });
            return (created as { id: string }).id;
        };
        const briefsId = await upsert(dto.briefs, prev?.briefs_automation_id ?? null, BRIEFS_NAME, BRIEFS_CRON, briefsInstructions(calendar.label, email?.label ?? null), 'Event ids already briefed (last 7 days)');
        const followUpsId = await upsert(dto.follow_ups, prev?.follow_ups_automation_id ?? null, FOLLOW_UPS_NAME, FOLLOW_UPS_CRON, followUpsInstructions(calendar.label, email?.label ?? null), 'Event ids already followed up (last 7 days)');
        const cfg: MeetingAssistantConfig = { bot_id: dto.bot_id, calendar_connection_id: calendar.id, email_connection_id: email?.id ?? null, briefs_automation_id: briefsId, follow_ups_automation_id: followUpsId };
        await this.prisma.organizationMember.update({ where: { id: m.id }, data: { meeting_assistant: cfg as unknown as Prisma.InputJsonValue } });
        return this.get(actor);
    }

    async disable(actor: Actor) {
        const m = await this.member(actor);
        const cfg = m.meeting_assistant as unknown as MeetingAssistantConfig | null;
        for (const id of [cfg?.briefs_automation_id, cfg?.follow_ups_automation_id]) {
            if (!id) continue;
            const a = await this.prisma.automation.findFirst({ where: { id, owner_id: actor.user_id, deleted_at: null } });
            if (a) await this.automations.remove(actor, id);
        }
        await this.prisma.organizationMember.update({ where: { id: m.id }, data: { meeting_assistant: Prisma.DbNull } });
        return this.get(actor);
    }
}
