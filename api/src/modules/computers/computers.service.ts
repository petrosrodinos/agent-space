import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Sandbox } from '@daytonaio/sdk';
import { CloudComputer, CloudComputerStatus, IdlePause, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { EventsService, UserEvents } from '@/core/realtime/events.service';
import { DaytonaService } from '@/integrations/daytona/daytona.service';
import { StorageService } from '@/integrations/storage/storage.service';
import { newId } from '@/shared/utils/security/crypto.utils';
import { AccessService } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { UsageService } from '../usage/usage.service';
import { ComputerViewProxy } from './computer-view.proxy';
import { ConfigService } from '@nestjs/config';
import type { Actor } from '../bots/bots.service';

const IDLE_MINUTES: Record<IdlePause, number> = { MIN_5: 5, MIN_15: 15, MIN_30: 30 };
export const HOME = '/home/daytona';
export const WORKSPACE = `${HOME}/workspace`;
export const BROWSER_PROFILE = `${HOME}/.agentspace-browser`;
const TRANSFER_LIMIT = 1024 ** 3; // 1 GB per transfer (§9.5)

/** Chromium preferences: never offer to save passwords or autofill (§9.4). */
const BROWSER_PREFS = JSON.stringify({
    credentials_enable_service: false,
    credentials_enable_autosignin: false,
    profile: { password_manager_enabled: false, password_manager_leak_detection: false },
    autofill: { profile_enabled: false, credit_card_enabled: false },
    browser: { has_seen_welcome_page: true, check_default_browser: false },
});

/**
 * Opens a URL in the bot's browser on the desktop, reusing the persistent profile. Chromium's own sandbox needs user
 * namespaces the container doesn't have; the Daytona sandbox is the isolation boundary, so --no-sandbox is used.
 */
export const OPEN_BROWSER = `#!/bin/bash
URL="\${1:-about:blank}"
export DISPLAY=:0
FLAGS="--user-data-dir=${BROWSER_PROFILE} --no-sandbox --disable-dev-shm-usage --no-first-run --no-default-browser-check --password-store=basic --disable-quic --disable-features=PasswordManagerOnboarding,AutofillServerCommunication --start-maximized"
# Restart a browser started with older flags (the sandbox network has no UDP, so QUIC must stay off).
if pgrep -f "user-data-dir=${BROWSER_PROFILE}" > /dev/null && ! pgrep -f "user-data-dir=${BROWSER_PROFILE}.*--disable-quic" > /dev/null; then pkill -f "user-data-dir=${BROWSER_PROFILE}"; sleep 1; fi
setsid nohup chromium $FLAGS "$URL" > /tmp/agentspace-browser.log 2>&1 < /dev/null &
sleep 3
`;
export const OPEN_BROWSER_PATH = `${HOME}/.agentspace/open-browser.sh`;

/**
 * Makes the desktop's "Web Browser" launcher (panel icon, links in apps) start the bot's Chromium. Without this XFCE's
 * exo-open has no default browser and shows "Failed to execute default Web Browser. Input/output error."
 */
const BROWSER_DESKTOP_FILE = `[Desktop Entry]
Version=1.0
Type=Application
Name=Web Browser
Exec=${OPEN_BROWSER_PATH} %u
Icon=chromium
Terminal=false
Categories=Network;WebBrowser;
MimeType=text/html;x-scheme-handler/http;x-scheme-handler/https;
`;
const XFCE_BROWSER_HELPER = `[Desktop Entry]
NoDisplay=true
Version=1.0
Encoding=UTF-8
Type=X-XFCE-Helper
X-XFCE-Category=WebBrowser
X-XFCE-CommandsWithParameter=${OPEN_BROWSER_PATH} "%s"
Icon=chromium
Name=Agent Space Browser
X-XFCE-Commands=${OPEN_BROWSER_PATH}
`;
const MIME_DEFAULTS = `[Default Applications]
text/html=agentspace-browser.desktop
x-scheme-handler/http=agentspace-browser.desktop
x-scheme-handler/https=agentspace-browser.desktop
x-scheme-handler/about=agentspace-browser.desktop
x-scheme-handler/unknown=agentspace-browser.desktop
`;

/** Lists the sites with cookies in the browser profile (JSON lines: domain, first-seen µs since 1601). */
const LIST_SITES_PY = `
import sqlite3, json, os, shutil, tempfile
paths = ["${BROWSER_PROFILE}/Default/Network/Cookies", "${BROWSER_PROFILE}/Default/Cookies"]
out = {}
for p in paths:
    if not os.path.exists(p): continue
    tmp = tempfile.mktemp()
    shutil.copy(p, tmp)
    con = sqlite3.connect(tmp)
    for host, created, last in con.execute("select host_key, min(creation_utc), max(last_access_utc) from cookies group by host_key"):
        d = host.lstrip(".")
        parts = d.split(".")
        site = ".".join(parts[-2:]) if len(parts) > 2 and len(parts[-1]) > 2 else ".".join(parts[-3:]) if len(parts) > 2 else d
        cur = out.get(site)
        out[site] = {"domain": site, "created": min(created, cur["created"]) if cur else created, "last": max(last, cur["last"]) if cur else last}
    con.close()
    os.remove(tmp)
print(json.dumps(list(out.values())))
`;

const fromChromeTime = (us: number) => new Date(us / 1000 - 11644473600000);

export interface ComputerView {
    id: string | null;
    bot_id: string;
    status: CloudComputerStatus;
    status_message: string | null;
    enabled: boolean;
    available: boolean;
    last_active_at: Date | null;
    storage_used_bytes: number;
    total_minutes: number;
    controlled_by: { user_id: string; name: string | null } | null;
}

/**
 * The bot's cloud computer (§9): one Daytona sandbox per bot, paused automatically when idle (Daytona auto-stop
 * set from the organisation's idle setting) and resumed when the bot or a user needs it.
 */
@Injectable()
export class ComputersService {
    private readonly logger = new Logger(ComputersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly events: EventsService,
        private readonly daytona: DaytonaService,
        private readonly storage: StorageService,
        private readonly files: FilesService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly notifications: NotificationsService,
        private readonly usage: UsageService,
        private readonly config: ConfigService,
        private readonly viewProxy: ComputerViewProxy,
    ) { }

    // ---------------- Access ----------------

    /** Anyone who can use the bot can watch its computer; changing it (turn on/off, reset, files, sign-outs) needs edit rights or an active session of theirs. */
    async requireBot(actor: Actor, botId: string, edit = false) {
        const bot = edit ? await this.access.requireEditableBot(actor.organization_id, actor.user_id, botId) : await this.access.requireUsableBot(actor.organization_id, actor.user_id, botId);
        const org = await this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } });
        return { bot: bot as { id: string; name: string; cloud_computer_enabled: boolean; organization_id: string }, org };
    }

    private async orgAllows(orgId: string, role: Actor['role'] | null) {
        const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: orgId } });
        if (s && !s.cloud_computers_enabled) return { ok: false, reason: 'Cloud computers are turned off for this organisation.' };
        if (s?.cloud_computers_who === 'OWNERS_ADMINS' && role && role === 'MEMBER') return { ok: false, reason: 'Only Owners and Admins can use cloud computers in this organisation.' };
        return { ok: true, idle: IDLE_MINUTES[s?.computer_idle_pause ?? 'MIN_15'], settings: s };
    }

    private controlKey(computerId: string) {
        return this.redis.key(`computer:${computerId}:control`);
    }

    async view(actor: Actor, botId: string): Promise<ComputerView> {
        const { bot } = await this.requireBot(actor, botId);
        const c = await this.prisma.cloudComputer.findUnique({ where: { bot_id: botId } });
        const allowed = await this.orgAllows(actor.organization_id, actor.role);
        const synced = c ? await this.syncStatus(c) : null;
        const control = c ? await this.redis.client.get(this.controlKey(c.id)) : null;
        const controller = control ? JSON.parse(control) : null;
        return {
            id: synced?.id ?? null,
            bot_id: botId,
            status: synced?.status ?? 'OFF',
            status_message: synced?.status_message ?? null,
            enabled: bot.cloud_computer_enabled,
            available: this.daytona.configured && allowed.ok,
            last_active_at: synced?.last_active_at ?? null,
            storage_used_bytes: Number(synced?.storage_used_bytes ?? 0),
            total_minutes: synced?.total_minutes ?? 0,
            controlled_by: controller,
        };
    }

    /** Reads the sandbox state from Daytona so "paused" reflects Daytona's auto-stop. */
    private async syncStatus(c: CloudComputer): Promise<CloudComputer> {
        if (!c.daytona_sandbox_id || c.status === 'OFF' || c.status === 'STARTING') return c;
        try {
            const sb = await this.daytona.get(c.daytona_sandbox_id);
            if (!sb) return this.setStatus(c, 'OFF', 'The computer was removed.');
            const state = String(sb.state).toLowerCase();
            const next: CloudComputerStatus = state === 'started' ? 'RUNNING' : ['stopped', 'archived', 'stopping', 'archiving'].includes(state) ? 'PAUSED' : state === 'error' ? 'ERROR' : c.status;
            if (next !== c.status) return this.setStatus(c, next, next === 'ERROR' ? 'The computer reported an error. Turn it off and on again.' : null);
        } catch (e) {
            this.logger.warn(`Computer status sync failed: ${(e as Error).message}`);
        }
        return c;
    }

    private async setStatus(c: CloudComputer, status: CloudComputerStatus, message: string | null = null, extra: Prisma.CloudComputerUpdateInput = {}) {
        const updated = await this.prisma.cloudComputer.update({
            where: { id: c.id },
            data: { status, status_message: message, ...(status === 'PAUSED' ? { paused_at: new Date() } : {}), ...extra },
        });
        await this.broadcast(updated);
        return updated;
    }

    private async broadcast(c: CloudComputer) {
        const users = await this.prisma.conversationParticipant.findMany({ where: { bot_id: c.bot_id, left_at: null, conversation: { participants: { some: { user_id: { not: null } } } } }, select: { conversation: { select: { participants: { where: { user_id: { not: null }, left_at: null }, select: { user_id: true } } } } }, take: 200 });
        const ids = [...new Set(users.flatMap((u) => u.conversation.participants.map((p) => p.user_id!)))];
        if (ids.length) await this.events.toUsers(ids, UserEvents.COMPUTER_STATUS, { bot_id: c.bot_id, status: c.status, status_message: c.status_message });
    }

    // ---------------- Lifecycle ----------------

    /** Creates the sandbox the first time, or resumes it. Used by users ("Turn on") and by the bot's tools. */
    async ensureRunning(orgId: string, botId: string, role: Actor['role'] | null): Promise<{ computer: CloudComputer; sandbox: Sandbox }> {
        const allowed = await this.orgAllows(orgId, role);
        if (!allowed.ok) throw new ForbiddenException(allowed.reason);
        if (!this.daytona.configured) throw new BadRequestException('Cloud computers are not set up on this server');
        let c = await this.prisma.cloudComputer.findUnique({ where: { bot_id: botId } });
        if (!c) c = await this.prisma.cloudComputer.create({ data: { organization_id: orgId, bot_id: botId, status: 'OFF', storage_limit_bytes: allowed.settings?.computer_storage_limit_bytes ?? null } });

        // One start at a time per computer; others wait for it (up to ~3 minutes).
        let lock = await this.redis.acquireLock(`computer:${c.id}:start`, 240_000);
        for (let i = 0; !lock && i < 90; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            lock = await this.redis.acquireLock(`computer:${c.id}:start`, 240_000);
        }
        if (!lock) throw new BadRequestException('The computer is starting — try again in a moment');
        try {
            c = await this.prisma.cloudComputer.findUniqueOrThrow({ where: { id: c.id } });
            let sb = c.daytona_sandbox_id ? await this.daytona.get(c.daytona_sandbox_id) : null;
            if (!sb || c.status !== 'RUNNING') c = await this.setStatus(c, 'STARTING', null);
            try {
                if (!sb) {
                    sb = await this.daytona.create({ app: 'agentspace', org: orgId, bot: botId }, allowed.idle!);
                    await this.prepare(sb);
                    c = await this.prisma.cloudComputer.update({ where: { id: c.id }, data: { daytona_sandbox_id: sb.id } });
                }
                sb = await this.daytona.ensureRunning(sb);
                await sb.setAutostopInterval(allowed.idle!).catch(() => undefined);
            } catch (e) {
                await this.setStatus(c, 'ERROR', `The computer could not start: ${(e as Error).message.slice(0, 200)}`);
                throw new BadRequestException('The cloud computer could not start. Please try again.');
            }
            const now = new Date();
            if (c.status !== 'RUNNING') await this.configureDefaultBrowser(sb);
            if (c.status !== 'RUNNING') c = await this.setStatus(c, 'RUNNING', null, { last_active_at: now, session_started_at: now, paused_at: null });
            else c = await this.prisma.cloudComputer.update({ where: { id: c.id }, data: { last_active_at: now } });
            return { computer: c, sandbox: sb };
        } finally {
            await lock.release();
        }
    }

    /** First boot: workspace folder, browser profile with password saving off, helper script. */
    private async prepare(sb: Sandbox) {
        await sb.fs.createFolder(WORKSPACE, '755').catch(() => undefined);
        await sb.fs.createFolder(`${BROWSER_PROFILE}/Default`, '700').catch(() => undefined);
        await sb.fs.uploadFile(Buffer.from(BROWSER_PREFS), `${BROWSER_PROFILE}/Default/Preferences`);
        await sb.fs.createFolder(`${HOME}/.agentspace`, '700').catch(() => undefined);
        await sb.fs.uploadFile(Buffer.from(OPEN_BROWSER), OPEN_BROWSER_PATH);
        await sb.process.executeCommand(`chmod +x ${OPEN_BROWSER_PATH}`);
        await this.configureDefaultBrowser(sb);
    }

    /** Idempotent; also run on every resume so computers created before this existed get a working default browser. */
    private async configureDefaultBrowser(sb: Sandbox) {
        try {
            for (const dir of [`${HOME}/.local/share/applications`, `${HOME}/.local/share/xfce4/helpers`, `${HOME}/.config/xfce4`]) await sb.fs.createFolder(dir, '755').catch(() => undefined);
            await sb.fs.uploadFile(Buffer.from(BROWSER_DESKTOP_FILE), `${HOME}/.local/share/applications/agentspace-browser.desktop`);
            await sb.fs.uploadFile(Buffer.from(XFCE_BROWSER_HELPER), `${HOME}/.local/share/xfce4/helpers/agentspace-browser.desktop`);
            await sb.fs.uploadFile(Buffer.from(MIME_DEFAULTS), `${HOME}/.config/mimeapps.list`);
            await sb.fs.uploadFile(Buffer.from('WebBrowser=agentspace-browser\n'),`${HOME}/.config/xfce4/helpers.rc`);
            await sb.process.executeCommand(`chmod +x ${OPEN_BROWSER_PATH}; update-desktop-database ${HOME}/.local/share/applications 2>/dev/null || true`);
        } catch {
            /* cosmetic: the bot's own tools open the browser through the helper script directly */
        }
    }

    async turnOn(actor: Actor, botId: string) {
        const { bot } = await this.requireBot(actor, botId);
        if (!bot.cloud_computer_enabled) throw new BadRequestException('Turn on the cloud computer for this bot first (bot settings → Computer)');
        await this.ensureRunning(actor.organization_id, botId, actor.role);
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'computer.started', target_type: 'bot', target_id: botId });
        return this.view(actor, botId);
    }

    async pause(actor: Actor, botId: string) {
        await this.requireBot(actor, botId);
        const c = await this.prisma.cloudComputer.findUnique({ where: { bot_id: botId } });
        if (!c?.daytona_sandbox_id) return this.view(actor, botId);
        const sb = await this.daytona.get(c.daytona_sandbox_id);
        if (sb) await this.daytona.stop(sb);
        await this.closeSessions(c.id);
        await this.setStatus(c, 'PAUSED');
        return this.view(actor, botId);
    }

    /** Deletes the sandbox and everything on it (files, browser sign-ins). */
    async reset(actor: Actor, botId: string) {
        await this.requireBot(actor, botId, true);
        const c = await this.prisma.cloudComputer.findUnique({ where: { bot_id: botId } });
        if (!c) return this.view(actor, botId);
        if (c.daytona_sandbox_id) await this.daytona.remove(c.daytona_sandbox_id).catch((e) => this.logger.warn(`Sandbox delete failed: ${(e as Error).message}`));
        await this.closeSessions(c.id);
        await this.prisma.signedInWebsite.deleteMany({ where: { cloud_computer_id: c.id } });
        await this.setStatus(c, 'OFF', null, { daytona_sandbox_id: null, storage_used_bytes: 0 });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'computer.reset', target_type: 'bot', target_id: botId });
        return this.view(actor, botId);
    }

    /** Turning the feature off for a bot removes its computer. */
    async disableForBot(orgId: string, botId: string) {
        const c = await this.prisma.cloudComputer.findUnique({ where: { bot_id: botId } });
        if (!c) return;
        if (c.daytona_sandbox_id) await this.daytona.remove(c.daytona_sandbox_id).catch(() => undefined);
        await this.prisma.cloudComputer.update({ where: { id: c.id }, data: { status: 'OFF', daytona_sandbox_id: null } });
    }

    // ---------------- Sessions, live view, control ----------------

    async openSession(computerId: string, kind: 'BOT_RUN' | 'USER_EXPLORE', ref: { run_id?: string; user_id?: string }) {
        const existing = await this.prisma.computerSession.findFirst({ where: { cloud_computer_id: computerId, ended_at: null, kind, ...(ref.run_id ? { run_id: ref.run_id } : { user_id: ref.user_id }) } });
        return existing ?? this.prisma.computerSession.create({ data: { cloud_computer_id: computerId, kind, run_id: ref.run_id, user_id: ref.user_id } });
    }

    async closeSessions(computerId: string, where: Prisma.ComputerSessionWhereInput = {}) {
        const open = await this.prisma.computerSession.findMany({ where: { cloud_computer_id: computerId, ended_at: null, ...where }, include: { run: { select: { user_id: true } }, cloud_computer: { select: { organization_id: true, bot_id: true } } } });
        let minutes = 0;
        const perMinute = Number(this.config.get('COMPUTER_COST_PER_MINUTE') ?? 0.0015);
        for (const s of open) {
            const m = Math.max(1, Math.round((Date.now() - s.started_at.getTime()) / 60_000));
            minutes += m;
            await this.prisma.computerSession.update({ where: { id: s.id }, data: { ended_at: new Date(), minutes: m } });
            // Cloud computer time counts toward the member's and bot's usage (§10.5, §13.4).
            await this.usage.record({ organization_id: s.cloud_computer.organization_id, user_id: s.run?.user_id ?? s.user_id, bot_id: s.cloud_computer.bot_id, run_id: s.run_id, kind: 'COMPUTER_MINUTES', quantity: m, cost: m * perMinute });
        }
        if (minutes) await this.prisma.cloudComputer.update({ where: { id: computerId }, data: { total_minutes: { increment: minutes } } });
        return minutes;
    }

    /** Signed noVNC URL. View-only unless this user currently has control (§9.2). */
    async liveView(actor: Actor, botId: string) {
        const { bot } = await this.requireBot(actor, botId);
        if (!bot.cloud_computer_enabled) throw new BadRequestException('This bot has no cloud computer');
        const { computer, sandbox } = await this.ensureRunning(actor.organization_id, botId, actor.role);
        const control = await this.redis.client.get(this.controlKey(computer.id));
        const mine = control ? JSON.parse(control).user_id === actor.user_id : false;
        await this.openSession(computer.id, 'USER_EXPLORE', { user_id: actor.user_id });
        return { ...(await this.viewGrant(sandbox, !mine)), control: mine, status: 'RUNNING' as const };
    }

    /** Live view through our proxy (Daytona's browser warning can't be skipped from an iframe); input is dropped when watch-only. */
    private async viewGrant(sandbox: Sandbox, viewOnly: boolean) {
        const api = this.config.get<string>('API_URL') || `http://localhost:${this.config.get('PORT') || 3000}/api`;
        return this.viewProxy.grant(await this.daytona.previewBase(sandbox), viewOnly, api);
    }

    async takeControl(actor: Actor, botId: string) {
        await this.requireBot(actor, botId);
        const { computer, sandbox } = await this.ensureRunning(actor.organization_id, botId, actor.role);
        const key = this.controlKey(computer.id);
        const current = await this.redis.client.get(key);
        if (current && JSON.parse(current).user_id !== actor.user_id) throw new BadRequestException(`${JSON.parse(current).name ?? 'Someone'} is using this computer right now`);
        const user = await this.prisma.user.findUnique({ where: { id: actor.user_id }, select: { name: true, email: true } });
        await this.redis.client.set(key, JSON.stringify({ user_id: actor.user_id, name: user?.name ?? user?.email, at: new Date().toISOString() }), 'EX', 3600);
        const session = await this.openSession(computer.id, 'USER_EXPLORE', { user_id: actor.user_id });
        await this.appendControlEvent(session.id, 'take_control');
        // Replays never show what the user typed: mark the range hidden from the bot-run recording (§9.4).
        const botSession = await this.prisma.computerSession.findFirst({ where: { cloud_computer_id: computer.id, kind: 'BOT_RUN', ended_at: null } });
        if (botSession) await this.appendHidden(botSession.id, 'take_control', 'start');
        await this.broadcast(computer);
        return { ...(await this.viewGrant(sandbox, false)), control: true, status: 'RUNNING' as const };
    }

    async handBack(actor: Actor, botId: string) {
        await this.requireBot(actor, botId);
        const c = await this.prisma.cloudComputer.findUnique({ where: { bot_id: botId } });
        if (!c) return { ok: true };
        const key = this.controlKey(c.id);
        const current = await this.redis.client.get(key);
        if (current && JSON.parse(current).user_id !== actor.user_id && actor.role === 'MEMBER') throw new ForbiddenException('Someone else has control');
        await this.redis.client.del(key);
        const session = await this.prisma.computerSession.findFirst({ where: { cloud_computer_id: c.id, kind: 'USER_EXPLORE', user_id: actor.user_id, ended_at: null } });
        if (session) await this.appendControlEvent(session.id, 'hand_back');
        const botSession = await this.prisma.computerSession.findFirst({ where: { cloud_computer_id: c.id, kind: 'BOT_RUN', ended_at: null } });
        if (botSession) await this.appendHidden(botSession.id, 'take_control', 'end');
        await this.broadcast(c);
        await this.refreshSignedInSites(c.id).catch(() => undefined);
        return { ok: true };
    }

    async controllerOf(computerId: string): Promise<{ user_id: string; name: string | null } | null> {
        const v = await this.redis.client.get(this.controlKey(computerId));
        return v ? JSON.parse(v) : null;
    }

    private async appendControlEvent(sessionId: string, event: 'take_control' | 'hand_back') {
        const s = await this.prisma.computerSession.findUniqueOrThrow({ where: { id: sessionId } });
        const events = Array.isArray(s.control_events) ? (s.control_events as Prisma.JsonArray) : [];
        await this.prisma.computerSession.update({ where: { id: sessionId }, data: { control_events: [...events, { at: new Date().toISOString(), event }] } });
    }

    private async appendHidden(sessionId: string, reason: string, edge: 'start' | 'end') {
        const s = await this.prisma.computerSession.findUniqueOrThrow({ where: { id: sessionId } });
        const ranges = (Array.isArray(s.hidden_ranges) ? s.hidden_ranges : []) as { from: string; to?: string; reason: string }[];
        if (edge === 'start') ranges.push({ from: new Date().toISOString(), reason });
        else {
            const open = [...ranges].reverse().find((r) => !r.to);
            if (open) open.to = new Date().toISOString();
        }
        await this.prisma.computerSession.update({ where: { id: sessionId }, data: { hidden_ranges: ranges as unknown as Prisma.InputJsonValue } });
    }

    async sessions(actor: Actor, botId: string) {
        await this.requireBot(actor, botId);
        const c = await this.prisma.cloudComputer.findUnique({ where: { bot_id: botId } });
        if (!c) return [];
        const rows = await this.prisma.computerSession.findMany({
            where: { cloud_computer_id: c.id },
            orderBy: { started_at: 'desc' },
            take: 50,
            include: { run: { select: { id: true, title: true, conversation_id: true } }, user: { select: { id: true, name: true } }, replay_file: { select: { id: true, filename: true, size: true } } },
        });
        const counts = await this.prisma.file.groupBy({ by: ['computer_session_id'], where: { computer_session_id: { in: rows.map((r) => r.id) }, area: 'REPLAYS', deleted_at: null }, _count: { _all: true } });
        return rows.map((r) => ({ ...r, frames: counts.find((c) => c.computer_session_id === r.id)?._count._all ?? 0, replay_file: r.replay_file ? { ...r.replay_file, size: Number(r.replay_file.size) } : null }));
    }

    /** Replay timeline (§9.2): the screenshots taken after each bot action, with short-lived links. Hidden ranges are never recorded. */
    async frames(actor: Actor, botId: string, sessionId: string) {
        await this.requireBot(actor, botId);
        const session = await this.prisma.computerSession.findFirst({ where: { id: sessionId, cloud_computer: { bot_id: botId } } });
        if (!session) throw new BadRequestException('Session not found');
        const files = await this.prisma.file.findMany({ where: { computer_session_id: sessionId, area: 'REPLAYS', deleted_at: null }, orderBy: { created_at: 'asc' } });
        return Promise.all(
            files.map(async (f) => ({
                id: f.id,
                label: f.filename.replace(/^\d+\s*/, '').replace(/\.jpg$/, ''),
                at: f.created_at,
                url: (await this.storage.createDownloadUrl(f.bucket, f.object_path, f.filename, 'inline')).url,
            })),
        );
    }

    // ---------------- Files (§9.2 files panel, §9.5) ----------------

    private safePath(p: string) {
        const raw = (p || WORKSPACE).trim();
        const abs = raw.startsWith('/') ? raw : `${WORKSPACE}/${raw}`;
        const norm = abs.split('/').reduce<string[]>((acc, part) => (part === '..' ? acc.slice(0, -1) : part && part !== '.' ? [...acc, part] : acc), []);
        const out = `/${norm.join('/')}`;
        if (!out.startsWith(HOME)) throw new BadRequestException('Only files in the bot\'s home folder can be used');
        if (out.startsWith(`${HOME}/.agentspace`) || out.startsWith(BROWSER_PROFILE)) throw new BadRequestException('That folder is private to the computer');
        return out;
    }

    async sandboxFor(actor: Actor, botId: string) {
        await this.requireBot(actor, botId);
        return (await this.ensureRunning(actor.organization_id, botId, actor.role)).sandbox;
    }

    async listFiles(actor: Actor, botId: string, dir?: string) {
        const sb = await this.sandboxFor(actor, botId);
        const path = this.safePath(dir ?? WORKSPACE);
        const entries = await sb.fs.listFiles(path);
        return {
            path,
            entries: entries
                .filter((e) => !e.name.startsWith('.'))
                .map((e) => ({ name: e.name, path: `${path.replace(/\/$/, '')}/${e.name}`, is_dir: e.isDir, size: e.size, modified_at: e.modTime }))
                .sort((a, b) => Number(b.is_dir) - Number(a.is_dir) || a.name.localeCompare(b.name)),
        };
    }

    async download(actor: Actor, botId: string, filePath: string) {
        const sb = await this.sandboxFor(actor, botId);
        const p = this.safePath(filePath);
        const info = await sb.fs.getFileDetails(p);
        if (info.isDir) throw new BadRequestException('Choose a file, not a folder');
        if (info.size > TRANSFER_LIMIT) throw new BadRequestException('Files over 1 GB can\'t be downloaded');
        const data = await sb.fs.downloadFile(p);
        return { data, filename: p.split('/').pop()! };
    }

    /** Copies a stored file (uploaded via the normal upload flow) onto the computer. */
    async importStoredFile(actor: Actor, botId: string, fileId: string, destDir?: string) {
        const sb = await this.sandboxFor(actor, botId);
        const { file, data } = await this.files.readForTool(actor.organization_id, fileId);
        if (file.uploaded_by_id !== actor.user_id) throw new ForbiddenException('You can only copy your own uploads');
        const dest = `${this.safePath(destDir ?? WORKSPACE).replace(/\/$/, '')}/${file.filename.replace(/[\\/]/g, '_')}`;
        await sb.fs.uploadFile(data, dest);
        await this.recordTransfer(botId, { direction: 'TO_COMPUTER', source_kind: 'STORED_FILE', file_id: file.id, source: file.filename, destination: dest, size_bytes: data.length });
        return { path: dest };
    }

    async deleteFile(actor: Actor, botId: string, filePath: string) {
        const sb = await this.sandboxFor(actor, botId);
        const p = this.safePath(filePath);
        if (p === WORKSPACE || p === HOME) throw new BadRequestException('This folder can\'t be deleted');
        await sb.fs.deleteFile(p, true);
        return { ok: true };
    }

    /** Copies a file off the computer into a conversation (§9.2 "shared into a chat"). */
    async shareToChat(actor: Actor, botId: string, filePath: string, conversationId: string) {
        await this.access.requireParticipant(conversationId, actor.user_id);
        const { data, filename } = await this.download(actor, botId, filePath);
        const f = await this.saveFromComputer(actor.organization_id, actor.user_id, conversationId, null, filename, data);
        await this.recordTransfer(botId, { direction: 'FROM_COMPUTER', source_kind: 'CHAT', file_id: f.id, source: filePath, destination: `conversation:${conversationId}`, size_bytes: data.length });
        const msg = await this.prisma.message.create({
            data: {
                organization_id: actor.organization_id,
                conversation_id: conversationId,
                author_type: 'USER',
                author_user_id: actor.user_id,
                source: 'TEXT',
                status: 'COMPLETED',
                content: `Shared ${filename} from the cloud computer`,
                parts: [{ type: 'text', text: `Shared **${filename}** from the cloud computer.` }],
                files: { create: [{ file_id: f.id }] },
            },
        });
        return { file: this.files.shape(f), message_id: msg.id };
    }

    async saveFromComputer(orgId: string, userId: string | null, conversationId: string, runId: string | null, filename: string, data: Buffer) {
        const id = newId();
        const objectPath = `orgs/${orgId}/computer/${id}`;
        const mimetype = guessMime(filename);
        await this.storage.write('FILES', objectPath, data, mimetype);
        return this.prisma.file.create({
            data: { id, organization_id: orgId, uploaded_by_id: userId, bucket: 'FILES', area: 'COMPUTER', object_path: objectPath, filename, mimetype, size: BigInt(data.length), status: 'READY', conversation_id: conversationId, run_id: runId },
        });
    }

    async recordTransfer(botId: string, t: Omit<Prisma.ComputerTransferUncheckedCreateInput, 'cloud_computer_id'>) {
        const c = await this.prisma.cloudComputer.findUnique({ where: { bot_id: botId } });
        if (c) await this.prisma.computerTransfer.create({ data: { ...t, cloud_computer_id: c.id } });
    }

    // ---------------- Signed-in websites (§9.4) ----------------

    async refreshSignedInSites(computerId: string) {
        const c = await this.prisma.cloudComputer.findUniqueOrThrow({ where: { id: computerId } });
        if (!c.daytona_sandbox_id || c.status !== 'RUNNING') return;
        const sb = await this.daytona.get(c.daytona_sandbox_id);
        if (!sb) return;
        await sb.fs.uploadFile(Buffer.from(LIST_SITES_PY), `${HOME}/.agentspace/sites.py`);
        const r = await sb.process.executeCommand(`python3 ${HOME}/.agentspace/sites.py`, undefined, undefined, 30);
        if (r.exitCode !== 0) return;
        const sites = JSON.parse(r.result.trim() || '[]') as { domain: string; created: number; last: number }[];
        const keep = sites.filter((s) => s.domain && !/google\.com$|gstatic|googleapis|doubleclick/.test(s.domain) || /accounts\.google\.com/.test(s.domain));
        await this.prisma.$transaction([
            this.prisma.signedInWebsite.deleteMany({ where: { cloud_computer_id: c.id, domain: { notIn: keep.map((s) => s.domain) } } }),
            ...keep.map((s) =>
                this.prisma.signedInWebsite.upsert({
                    where: { cloud_computer_id_domain: { cloud_computer_id: c.id, domain: s.domain } },
                    create: { cloud_computer_id: c.id, domain: s.domain, signed_in_at: fromChromeTime(s.created), last_seen_at: fromChromeTime(s.last) },
                    update: { last_seen_at: fromChromeTime(s.last) },
                }),
            ),
        ]);
    }

    async signedInSites(actor: Actor, botId: string) {
        await this.requireBot(actor, botId);
        const c = await this.prisma.cloudComputer.findUnique({ where: { bot_id: botId } });
        if (!c) return [];
        if (c.status === 'RUNNING') await this.refreshSignedInSites(c.id).catch((e) => this.logger.warn(`Sites refresh failed: ${(e as Error).message}`));
        return this.prisma.signedInWebsite.findMany({ where: { cloud_computer_id: c.id }, orderBy: { last_seen_at: 'desc' } });
    }

    /** Removes the site's cookies and storage from the browser profile (closes the browser first). domain = null signs out of all. */
    async signOut(actor: Actor, botId: string, domain: string | null) {
        await this.requireBot(actor, botId, true);
        const sb = await this.sandboxFor(actor, botId);
        const c = await this.prisma.cloudComputer.findUniqueOrThrow({ where: { bot_id: botId } });
        if (domain && !/^[a-z0-9.-]+$/i.test(domain)) throw new BadRequestException('Invalid site');
        const py = domain
            ? `import sqlite3,os\nfor p in ["${BROWSER_PROFILE}/Default/Network/Cookies","${BROWSER_PROFILE}/Default/Cookies"]:\n    if os.path.exists(p):\n        c=sqlite3.connect(p); c.execute("delete from cookies where host_key = ? or host_key like ?", ("${domain}", "%.${domain}")); c.commit(); c.close()\n`
            : `import os\nfor p in ["${BROWSER_PROFILE}/Default/Network/Cookies","${BROWSER_PROFILE}/Default/Cookies"]:\n    if os.path.exists(p): os.remove(p)\n`;
        await sb.process.executeCommand(`pkill -f "user-data-dir=${BROWSER_PROFILE}" || true; sleep 1`);
        await sb.fs.uploadFile(Buffer.from(py), `${HOME}/.agentspace/signout.py`);
        await sb.process.executeCommand(`python3 ${HOME}/.agentspace/signout.py`);
        const storageCmd = domain
            ? `find ${BROWSER_PROFILE}/Default -path "*Storage*" -iname "*${domain.replace(/[^a-z0-9.-]/gi, '')}*" -exec rm -rf {} + 2>/dev/null || true`
            : `rm -rf ${BROWSER_PROFILE}/Default/{Local\\ Storage,Session\\ Storage,IndexedDB,Service\\ Worker} 2>/dev/null || true`;
        await sb.process.executeCommand(storageCmd);
        await this.prisma.signedInWebsite.deleteMany({ where: { cloud_computer_id: c.id, ...(domain ? { domain } : {}) } });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'computer.signed_out', target_type: 'bot', target_id: botId, metadata: { domain: domain ?? 'all' } });
        return { ok: true };
    }

    /** Notifies the user that the bot is waiting for them to take control (§9.4). */
    async notifyTakeControl(userId: string, orgId: string, botName: string, reason: string, link: string) {
        const s = await this.prisma.userSettings.findUnique({ where: { user_id: userId } });
        if (s?.notify_take_control === false) return;
        await this.notifications.notify({ user_id: userId, organization_id: orgId, event: 'TAKE_CONTROL_NEEDED', title: `${botName} needs you on its computer`, body: reason, link_path: link, is_urgent: true });
    }
}

export function guessMime(name: string) {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
        pdf: 'application/pdf', csv: 'text/csv', txt: 'text/plain', md: 'text/markdown', json: 'application/json', html: 'text/html', xml: 'application/xml',
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm',
        zip: 'application/zip', gz: 'application/gzip', tar: 'application/x-tar',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', py: 'text/x-python', js: 'text/javascript', ts: 'text/plain', sh: 'text/x-sh',
    };
    return map[ext] ?? 'application/octet-stream';
}

