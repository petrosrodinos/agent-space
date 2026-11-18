import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Platform, User } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { MailService } from '@/integrations/mail/mail.service';
import { MailTemplates } from '@/integrations/mail/mail.templates';
import { randomToken, sha256 } from '@/shared/utils/security/crypto.utils';
import { OrganizationsService } from '../organizations/organizations.service';
import type { AccessTokenPayload, AuthTokens } from './interfaces/auth.interface';
import { ChangePasswordDto, DeviceInfoDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

const RESET_TTL_MS = 60 * 60 * 1000;

export interface RequestMeta {
    ip?: string;
    user_agent?: string;
    device?: DeviceInfoDto;
}

export type PublicUser = Omit<User, 'password' | 'two_factor_secret'>;

export function toPublicUser(user: User): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, two_factor_secret, ...rest } = user;
    return rest;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly mail: MailService,
        private readonly orgs: OrganizationsService,
    ) { }

    /** Sign up: creates the user, their settings and a personal organisation (§5.1, §15 journey 1). */
    async register(dto: RegisterDto, meta: RequestMeta) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing && existing.password) throw new ConflictException('An account with this email already exists');

        const password = await bcrypt.hash(dto.password, 10);
        const user = await this.prisma.$transaction(async (tx) => {
            const u = existing
                ? await tx.user.update({ where: { id: existing.id }, data: { password, name: dto.name.trim(), timezone: dto.timezone || 'UTC' } })
                : await tx.user.create({ data: { email: dto.email, password, name: dto.name.trim(), timezone: dto.timezone || 'UTC' } });
            await tx.userSettings.upsert({ where: { user_id: u.id }, create: { user_id: u.id }, update: {} });
            await this.orgs.create(u.id, { name: `${dto.name.trim().split(' ')[0]}'s space` }, true, tx);
            return u;
        });

        await this.orgs.autoJoinByDomain(user.id, user.email);
        let joined_organization_id: string | undefined;
        if (dto.invitation_token) {
            try {
                joined_organization_id = (await this.orgs.acceptInvitation(dto.invitation_token, user.id)).organization_id;
            } catch (e) {
                this.logger.warn(`Invitation on sign-up not accepted: ${(e as Error).message}`);
            }
        }
        const tokens = await this.issueSession(user, meta);
        return { ...tokens, user: toPublicUser(user), joined_organization_id };
    }

    async login(dto: LoginDto, meta: RequestMeta) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        // Same response for unknown email and wrong password, and always run bcrypt to avoid timing leaks.
        const ok = await bcrypt.compare(dto.password, user?.password || '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
        if (!user || !user.password || !ok || user.deleted_at) throw new UnauthorizedException('Email or password is incorrect');
        const tokens = await this.issueSession(user, meta);
        return { ...tokens, user: toPublicUser(user) };
    }

    private async signAccess(user: Pick<User, 'id' | 'role'>, sessionId: string) {
        const payload: AccessTokenPayload = { sub: user.id, sid: sessionId, role: user.role, typ: 'access' };
        const token = await this.jwt.signAsync(payload, {
            secret: this.config.get('JWT_SECRET'),
            expiresIn: this.config.get('JWT_ACCESS_EXPIRATION') || '15m',
        });
        const decoded = this.jwt.decode(token) as { exp: number };
        return { access_token: token, expires_in: decoded.exp };
    }

    private refreshDays() {
        return Number(this.config.get('REFRESH_TOKEN_DAYS') || 30);
    }

    private async issueSession(user: User, meta: RequestMeta): Promise<AuthTokens> {
        const device = await this.recordDevice(user.id, meta);
        const refresh = randomToken(48);
        const expires = new Date(Date.now() + this.refreshDays() * 86400_000);
        const session = await this.prisma.session.create({
            data: {
                user_id: user.id,
                device_id: device?.id,
                refresh_token_hash: sha256(refresh),
                ip_address: meta.ip,
                user_agent: meta.user_agent?.slice(0, 400),
                expires_at: expires,
            },
        });
        await this.prisma.user.update({ where: { id: user.id }, data: { last_active_at: new Date() } });
        const access = await this.signAccess(user, session.id);
        return { ...access, refresh_token: refresh, refresh_expires_at: expires.toISOString() };
    }

    /** §14.1 "Devices are recorded from the start". */
    private async recordDevice(userId: string, meta: RequestMeta) {
        const platform = (meta.device?.platform ?? 'WEB') as Platform;
        const name = meta.device?.device_name || this.describeAgent(meta.user_agent) || 'Web browser';
        try {
            return await this.prisma.device.create({
                data: { user_id: userId, platform, name, app_version: meta.device?.app_version, capabilities: [], is_online: false },
            });
        } catch {
            return null;
        }
    }

    private describeAgent(ua?: string) {
        if (!ua) return null;
        const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
        const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
        return os ? `${browser} on ${os}` : browser;
    }

    /** Rotating refresh tokens: every refresh replaces the token; reuse of an old one revokes the session. */
    async refresh(refreshToken: string | undefined) {
        if (!refreshToken) throw new UnauthorizedException({ message: 'Not signed in', code: 'no_refresh_token' });
        const session = await this.prisma.session.findUnique({ where: { refresh_token_hash: sha256(refreshToken) }, include: { user: true } });
        if (!session || session.revoked_at || session.expires_at < new Date() || session.user.deleted_at) {
            throw new UnauthorizedException({ message: 'Session expired. Please sign in again.', code: 'session_expired' });
        }
        // §13.4 "Sign out inactive sessions after"
        const inactivityDays = await this.inactivityLimitDays(session.user_id);
        if (Date.now() - session.last_used_at.getTime() > inactivityDays * 86400_000) {
            await this.prisma.session.update({ where: { id: session.id }, data: { revoked_at: new Date() } });
            throw new UnauthorizedException({ message: 'Signed out after inactivity. Please sign in again.', code: 'session_inactive' });
        }
        const next = randomToken(48);
        const expires = new Date(Date.now() + this.refreshDays() * 86400_000);
        await this.prisma.session.update({
            where: { id: session.id },
            data: { refresh_token_hash: sha256(next), last_used_at: new Date(), expires_at: expires },
        });
        await this.prisma.user.update({ where: { id: session.user_id }, data: { last_active_at: new Date() } });
        const access = await this.signAccess(session.user, session.id);
        return { ...access, refresh_token: next, refresh_expires_at: expires.toISOString(), user: toPublicUser(session.user) };
    }

    private async inactivityLimitDays(userId: string) {
        const strictest = await this.prisma.organizationSettings.findMany({
            where: { organization: { members: { some: { user_id: userId } }, deleted_at: null } },
            select: { session_inactivity: true },
        });
        const days = strictest.map((s) => ({ DAYS_30: 30, DAYS_7: 7, DAY_1: 1 })[s.session_inactivity]);
        return days.length ? Math.min(...days) : 30;
    }

    async logout(sessionId: string | undefined, refreshToken?: string) {
        if (sessionId) await this.prisma.session.updateMany({ where: { id: sessionId, revoked_at: null }, data: { revoked_at: new Date() } });
        else if (refreshToken) await this.prisma.session.updateMany({ where: { refresh_token_hash: sha256(refreshToken) }, data: { revoked_at: new Date() } });
        return { ok: true };
    }

    async listSessions(userId: string, currentSessionId: string) {
        const rows = await this.prisma.session.findMany({
            where: { user_id: userId, revoked_at: null, expires_at: { gt: new Date() } },
            include: { device: { select: { name: true, platform: true, app_version: true } } },
            orderBy: { last_used_at: 'desc' },
        });
        return rows.map((s) => ({
            id: s.id,
            device: s.device,
            ip_address: s.ip_address,
            user_agent: s.user_agent,
            created_at: s.created_at,
            last_used_at: s.last_used_at,
            current: s.id === currentSessionId,
        }));
    }

    async revokeSession(userId: string, sessionId: string) {
        const res = await this.prisma.session.updateMany({ where: { id: sessionId, user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } });
        if (!res.count) throw new NotFoundException('Session not found');
        return { ok: true };
    }

    async revokeOtherSessions(userId: string, currentSessionId: string) {
        await this.prisma.session.updateMany({ where: { user_id: userId, id: { not: currentSessionId }, revoked_at: null }, data: { revoked_at: new Date() } });
        return { ok: true };
    }

    async forgotPassword(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (user?.password && !user.deleted_at) {
            const token = randomToken();
            await this.prisma.passwordResetToken.updateMany({ where: { user_uuid: user.id, used_at: null }, data: { used_at: new Date() } });
            await this.prisma.passwordResetToken.create({ data: { token_hash: sha256(token), user_uuid: user.id, expires_at: new Date(Date.now() + RESET_TTL_MS) } });
            const url = `${(this.config.get<string>('APP_URL') || '').replace(/\/$/, '')}/auth/reset-password?token=${token}`;
            setImmediate(async () => {
                try {
                    await this.mail.send({ to: user.email, ...MailTemplates.passwordReset({ url }) });
                } catch (e) {
                    this.logger.error(`Password reset email failed: ${(e as Error).message}`);
                }
            });
        }
        return { message: 'If an account with that email exists, we sent a link to reset the password.' };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const row = await this.prisma.passwordResetToken.findUnique({ where: { token_hash: sha256(dto.token) } });
        if (!row || row.used_at || row.expires_at < new Date()) throw new BadRequestException('This reset link is invalid or has expired');
        const password = await bcrypt.hash(dto.password, 10);
        await this.prisma.$transaction([
            this.prisma.user.update({ where: { id: row.user_uuid }, data: { password } }),
            this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { used_at: new Date() } }),
            this.prisma.session.updateMany({ where: { user_id: row.user_uuid, revoked_at: null }, data: { revoked_at: new Date() } }),
        ]);
        return { message: 'Your password has been changed. Please sign in.' };
    }

    async changePassword(userId: string, sessionId: string, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (!(await bcrypt.compare(dto.current_password, user.password))) throw new BadRequestException('Current password is incorrect');
        await this.prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(dto.new_password, 10) } });
        await this.revokeOtherSessions(userId, sessionId);
        return { ok: true };
    }
}
