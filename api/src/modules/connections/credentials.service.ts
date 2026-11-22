import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CredentialEventType, CredentialKind, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { SecretPayload, SecretStoreService } from '@/integrations/secrets/secret-store.service';
import { maskSecret } from '@/shared/utils/security/secret-detection.utils';
import { newId, slugify } from '@/shared/utils/security/crypto.utils';
import { maskUsername, normalizeWebsiteDomain, parseTotpSecret } from '@/shared/utils/security/website-login.utils';
import { AccessService, isAdminRole } from '../access/access.service';
import { ActivityService } from '../activity/activity.service';
import type { Actor } from '../bots/bots.service';
import { CredentialQuery, SecretInputKind, SecretInputKinds } from './dto/connection.dto';
import { OnePasswordConnectService } from '@/integrations/password-managers/one-password-connect.service';

const MIN_KEY_LENGTH = 6;

const KIND_OF_INPUT: Record<SecretInputKind, CredentialKind> = {
    [SecretInputKinds.API_KEY]: CredentialKind.API_KEY,
    [SecretInputKinds.MCP_TOKEN]: CredentialKind.MCP_TOKEN,
    [SecretInputKinds.WEBSITE_LOGIN]: CredentialKind.WEBSITE_LOGIN,
    [SecretInputKinds.PASSWORD_MANAGER]: CredentialKind.PASSWORD_MANAGER,
};

export interface CreateCredentialInput {
    label: string;
    service_name?: string;
    kind: SecretInputKind;
    value: string;
    website?: string;
    username?: string;
    totp_secret?: string;
    /** PASSWORD_MANAGER: the 1Password Connect server address. */
    server_url?: string;
    visibility?: 'PRIVATE' | 'SHARED';
    bot_ids?: string[];
}

function totpOrThrow(input: string): string {
    const secret = parseTotpSecret(input);
    if (!secret) throw new BadRequestException('The two-step secret should be the setup key (letters A to Z and 2 to 7) or an otpauth:// link');
    return secret;
}

const CRED_INCLUDE = {
    owner: { select: { id: true, name: true, email: true } },
    last_used_bot: { select: { id: true, name: true, avatar_seed: true, color: true } },
    bots: { include: { bot: { select: { id: true, name: true, avatar_seed: true, color: true } } } },
    connection: { select: { id: true, label: true } },
} satisfies Prisma.CredentialInclude;

/**
 * §8.9 Secrets page backend. Reads only credential metadata; never reads values from the secret store.
 * Values are written once (create/replace) and are never returned to anyone.
 */
@Injectable()
export class CredentialsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly store: SecretStoreService,
        private readonly access: AccessService,
        private readonly activity: ActivityService,
        private readonly onePassword: OnePasswordConnectService,
    ) { }

    private shape(c: Prisma.CredentialGetPayload<{ include: typeof CRED_INCLUDE }>, actor: Actor) {
        const canManage = c.owner_id === actor.user_id || (c.visibility === 'SHARED' && isAdminRole(actor.role));
        return {
            id: c.id,
            label: c.label,
            service_key: c.service_key,
            service_name: c.service_name,
            kind: c.kind,
            masked_hint: c.masked_hint,
            website_domain: c.website_domain,
            visibility: c.visibility,
            status: c.status,
            expires_at: c.expires_at,
            owner: c.owner,
            created_at: c.created_at,
            last_used_at: c.last_used_at,
            last_used_bot: c.last_used_bot,
            bots: c.bots.map((b) => b.bot),
            connection_id: c.connection?.id ?? null,
            can_manage: canManage,
        };
    }

    async list(actor: Actor, q: CredentialQuery) {
        const rows = await this.prisma.credential.findMany({
            where: {
                ...this.access.usableCredentialsWhere(actor.organization_id, actor.user_id),
                ...(q.status ? { status: q.status } : {}),
                ...(q.service ? { service_name: { equals: q.service, mode: 'insensitive' } } : {}),
                ...(q.bot_id ? { bots: { some: { bot_id: q.bot_id } } } : {}),
                ...(q.search ? { OR: [{ label: { contains: q.search, mode: 'insensitive' } }, { service_name: { contains: q.search, mode: 'insensitive' } }] } : {}),
            },
            include: CRED_INCLUDE,
            orderBy: { created_at: 'desc' },
        });
        return rows.map((r) => this.shape(r, actor));
    }

    async get(actor: Actor, id: string) {
        const c = await this.prisma.credential.findFirst({ where: { id, ...this.access.usableCredentialsWhere(actor.organization_id, actor.user_id) }, include: CRED_INCLUDE });
        if (!c) throw new NotFoundException('Secret not found');
        return this.shape(c, actor);
    }

    private async requireManageable(actor: Actor, id: string) {
        const c = await this.prisma.credential.findFirst({ where: { id, organization_id: actor.organization_id, deleted_at: null } });
        if (!c) throw new NotFoundException('Secret not found');
        const ok = c.owner_id === actor.user_id || (c.visibility === 'SHARED' && isAdminRole(actor.role));
        if (!ok) throw new ForbiddenException('You cannot change this secret');
        return c;
    }

    private async checkBots(actor: Actor, botIds: string[] | undefined, shared: boolean) {
        if (!botIds?.length) return;
        const where = shared && isAdminRole(actor.role) ? { organization_id: actor.organization_id, deleted_at: null } : this.access.usableBotsWhere(actor.organization_id, actor.user_id);
        const n = await this.prisma.bot.count({ where: { ...where, id: { in: botIds } } });
        if (n !== new Set(botIds).size) throw new BadRequestException('Unknown bot');
    }

    private event(credential_id: string, type: CredentialEventType, actor: { user_id?: string; bot_id?: string }, metadata?: Record<string, unknown>) {
        return this.prisma.credentialEvent.create({ data: { credential_id, type, actor_user_id: actor.user_id, actor_bot_id: actor.bot_id, metadata: metadata as Prisma.InputJsonValue } });
    }

    /** Validates the input and builds what goes to the secret store and the DB for each kind. Values never leave this method except into the store. */
    private prepare(input: CreateCredentialInput): { payload: SecretPayload; masked_hint: string; website_domain: string | null; service_name: string } {
        if (input.kind === SecretInputKinds.PASSWORD_MANAGER) {
            const base = this.onePassword.normalizeServerUrl(input.server_url ?? '');
            const token = input.value.trim();
            if (token.length < 20) throw new BadRequestException('Paste the Connect server access token');
            return { payload: { api_key: token, base_url: base }, masked_hint: maskSecret(token), website_domain: null, service_name: '1Password' };
        }
        if (input.kind === SecretInputKinds.WEBSITE_LOGIN) {
            const website = normalizeWebsiteDomain(input.website ?? '');
            if (!website) throw new BadRequestException('Enter the website this login is for, e.g. portal.acme.com');
            const username = input.username?.trim();
            if (!username) throw new BadRequestException('Enter the username or email for this login');
            const totp = input.totp_secret?.trim() ? totpOrThrow(input.totp_secret) : undefined;
            // Passwords are stored exactly as typed (leading/trailing spaces can be part of them).
            return { payload: { username, password: input.value, ...(totp ? { totp_secret: totp } : {}) }, masked_hint: maskUsername(username), website_domain: website, service_name: input.service_name?.trim() || website };
        }
        const value = input.value.trim();
        if (value.length < MIN_KEY_LENGTH) throw new BadRequestException('That key looks too short');
        return {
            payload: input.kind === SecretInputKinds.API_KEY ? { api_key: value } : { access_token: value, token_type: 'bearer' },
            masked_hint: maskSecret(value),
            website_domain: null,
            service_name: input.service_name?.trim() || input.label.split(/[–-]/)[0].trim(),
        };
    }

    /** Creates a credential (value → secret store, metadata → DB). API keys also become an access-key connection (§8.5). */
    async create(actor: Actor, input: CreateCredentialInput) {
        const shared = input.visibility === 'SHARED';
        if (shared && !isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can share secrets with the organisation');
        if (input.kind === SecretInputKinds.API_KEY && !isAdminRole(actor.role)) {
            const s = await this.prisma.organizationSettings.findUnique({ where: { organization_id: actor.organization_id } });
            if (s && !s.members_api_key_connections) throw new ForbiddenException('Members cannot add connections by access key in this organisation');
        }
        await this.checkBots(actor, input.bot_ids, shared);

        const id = newId();
        const prepared = this.prepare(input);
        // §16: check the password manager answers before saving it.
        if (input.kind === SecretInputKinds.PASSWORD_MANAGER) await this.onePassword.test(String(prepared.payload.base_url), String(prepared.payload.api_key));
        const ref = await this.store.create(id, { org_id: actor.organization_id, owner_type: shared ? 'org' : 'user', kind: input.kind }, prepared.payload);
        const serviceName = prepared.service_name;
        const cred = await this.prisma.$transaction(async (tx) => {
            const c = await tx.credential.create({
                data: {
                    id,
                    organization_id: actor.organization_id,
                    owner_type: shared ? 'ORGANIZATION' : 'USER',
                    owner_id: actor.user_id,
                    kind: KIND_OF_INPUT[input.kind],
                    label: input.label.trim(),
                    service_key: slugify(serviceName, 40),
                    service_name: serviceName,
                    visibility: shared ? 'SHARED' : 'PRIVATE',
                    masked_hint: prepared.masked_hint,
                    website_domain: prepared.website_domain,
                    secret_resource_name: ref.resource_name,
                    secret_version: ref.version,
                    bots: input.bot_ids?.length ? { create: input.bot_ids.map((bot_id) => ({ bot_id })) } : undefined,
                },
            });
            if (input.kind === SecretInputKinds.API_KEY) {
                await tx.connection.create({
                    data: {
                        organization_id: actor.organization_id,
                        owner_id: actor.user_id,
                        kind: 'API_KEY',
                        service_key: c.service_key!,
                        service_name: serviceName,
                        label: c.label,
                        visibility: c.visibility,
                        credential_id: c.id,
                        restricted_to_bots: !!input.bot_ids?.length,
                        bot_restrictions: input.bot_ids?.length ? { create: input.bot_ids.map((bot_id) => ({ bot_id })) } : undefined,
                    },
                });
            }
            return c;
        });
        await this.event(cred.id, 'CREATED', { user_id: actor.user_id });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'secret.created', target_type: 'credential', target_id: cred.id, metadata: { label: cred.label, kind: cred.kind } });
        return this.get(actor, cred.id);
    }

    async updateMeta(actor: Actor, id: string, dto: { label?: string; service_name?: string; bot_ids?: string[]; visibility?: 'PRIVATE' | 'SHARED' }, viaBotId?: string) {
        const c = await this.requireManageable(actor, id);
        if (dto.visibility && dto.visibility !== c.visibility && !isAdminRole(actor.role)) throw new ForbiddenException('Only Owners and Admins can share or unshare secrets');
        await this.checkBots(actor, dto.bot_ids, (dto.visibility ?? c.visibility) === 'SHARED');
        await this.prisma.$transaction(async (tx) => {
            await tx.credential.update({
                where: { id },
                data: {
                    label: dto.label?.trim(),
                    service_name: dto.service_name?.trim(),
                    visibility: dto.visibility,
                    owner_type: dto.visibility ? (dto.visibility === 'SHARED' ? 'ORGANIZATION' : 'USER') : undefined,
                },
            });
            if (dto.bot_ids) {
                await tx.botCredential.deleteMany({ where: { credential_id: id } });
                if (dto.bot_ids.length) await tx.botCredential.createMany({ data: dto.bot_ids.map((bot_id) => ({ bot_id, credential_id: id })) });
            }
            const conn = await tx.connection.findFirst({ where: { credential_id: id } });
            if (conn) {
                await tx.connection.update({ where: { id: conn.id }, data: { label: dto.label?.trim(), visibility: dto.visibility, restricted_to_bots: dto.bot_ids ? dto.bot_ids.length > 0 : undefined } });
                if (dto.bot_ids) {
                    await tx.connectionBotRestriction.deleteMany({ where: { connection_id: conn.id } });
                    if (dto.bot_ids.length) await tx.connectionBotRestriction.createMany({ data: dto.bot_ids.map((bot_id) => ({ bot_id, connection_id: conn.id })) });
                }
            }
        });
        const actorRef = { user_id: actor.user_id, bot_id: viaBotId };
        if (dto.label || dto.service_name) await this.event(id, 'RENAMED', actorRef, { label: dto.label, service: dto.service_name });
        if (dto.bot_ids) await this.event(id, 'BOTS_CHANGED', actorRef, { bot_ids: dto.bot_ids });
        if (dto.visibility && dto.visibility !== c.visibility) await this.event(id, dto.visibility === 'SHARED' ? 'SHARED' : 'MADE_PRIVATE', actorRef);
        return this.get(actor, id);
    }

    /** Replace: new version in the store, previous one destroyed; the old key keeps working until the new one is saved (§8.9). */
    async replace(actor: Actor, id: string, value: string, login?: { username?: string; totp_secret?: string }) {
        const c = await this.requireManageable(actor, id);
        let payload: SecretPayload;
        let maskedHint: string;
        if (c.kind === CredentialKind.WEBSITE_LOGIN) {
            // A login keeps its username and two-step secret unless new ones are given ("" removes the two-step secret).
            const current = await this.store.access(c.secret_resource_name);
            const username = login?.username?.trim() || current.username || '';
            const totp = login?.totp_secret === undefined ? current.totp_secret : login.totp_secret.trim() ? totpOrThrow(login.totp_secret) : undefined;
            payload = { username, password: value, ...(totp ? { totp_secret: totp } : {}) };
            maskedHint = maskUsername(username);
        } else if (c.kind === CredentialKind.PASSWORD_MANAGER) {
            // A new Connect token for the same server; checked before the old one is destroyed.
            const current = await this.store.access(c.secret_resource_name);
            const base = String(current.base_url ?? '');
            await this.onePassword.test(base, value.trim());
            payload = { api_key: value.trim(), base_url: base };
            maskedHint = maskSecret(value);
        } else {
            if (value.trim().length < MIN_KEY_LENGTH) throw new BadRequestException('That key looks too short');
            payload = c.kind === CredentialKind.API_KEY ? { api_key: value.trim() } : { access_token: value.trim(), token_type: 'bearer' };
            maskedHint = maskSecret(value);
        }
        const version = await this.store.replace(c.secret_resource_name, c.secret_version, payload);
        await this.prisma.credential.update({ where: { id }, data: { secret_version: version, masked_hint: maskedHint, status: 'ACTIVE' } });
        await this.prisma.connection.updateMany({ where: { credential_id: id, deleted_at: null }, data: { status: 'ACTIVE', status_message: null } });
        await this.event(id, 'REPLACED', { user_id: actor.user_id });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'secret.replaced', target_type: 'credential', target_id: id });
        return this.get(actor, id);
    }

    /** Delete: the stored value is deleted immediately; the record is soft-deleted to keep its history (§8.9). */
    async remove(actor: Actor, id: string) {
        const c = await this.requireManageable(actor, id);
        await this.store.delete(c.secret_resource_name);
        await this.prisma.$transaction([
            this.prisma.credential.update({ where: { id }, data: { deleted_at: new Date() } }),
            this.prisma.connection.updateMany({ where: { credential_id: id }, data: { deleted_at: new Date() } }),
            this.prisma.botCredential.deleteMany({ where: { credential_id: id } }),
        ]);
        await this.event(id, 'DELETED', { user_id: actor.user_id });
        await this.activity.log({ organization_id: actor.organization_id, actor_user_id: actor.user_id, action: 'secret.deleted', target_type: 'credential', target_id: id, metadata: { label: c.label } });
        return { ok: true };
    }

    async usage(actor: Actor, id: string) {
        await this.get(actor, id);
        const [bots, conn] = await Promise.all([
            this.prisma.botCredential.findMany({ where: { credential_id: id }, include: { bot: { select: { id: true, name: true, avatar_seed: true } } } }),
            this.prisma.connection.findFirst({ where: { credential_id: id, deleted_at: null }, include: { bot_connections: { include: { bot: { select: { id: true, name: true, avatar_seed: true } } } } } }),
        ]);
        const toolServers = await this.prisma.toolServer.findMany({ where: { credential_id: id, deleted_at: null }, select: { id: true, name: true } });
        return { bots: [...bots.map((b) => b.bot), ...(conn?.bot_connections.map((b) => b.bot) ?? [])], tool_servers: toolServers };
    }

    async history(actor: Actor, id: string) {
        await this.get(actor, id);
        const rows = await this.prisma.credentialEvent.findMany({ where: { credential_id: id }, orderBy: { created_at: 'desc' }, take: 200, include: { actor_user: { select: { name: true, email: true } } } });
        const botIds = [...new Set(rows.map((r) => r.actor_bot_id).filter(Boolean))] as string[];
        const bots = await this.prisma.bot.findMany({ where: { id: { in: botIds } }, select: { id: true, name: true, avatar_seed: true } });
        return rows.map((r) => ({ id: r.id, type: r.type, action: r.action, created_at: r.created_at, user: r.actor_user, bot: bots.find((b) => b.id === r.actor_bot_id) ?? null, metadata: r.metadata }));
    }
}
