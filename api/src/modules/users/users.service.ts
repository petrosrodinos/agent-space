import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ColorTheme, Platform, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import type { OrgMembership } from '@/shared/guards/org.guard';
import { toPublicUser } from '../auth/auth.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { UpdateProfileDto, UpdateUserSettingsDto } from './dto/user.dto';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly orgs: OrganizationsService,
    ) { }

    async me(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.deleted_at) throw new NotFoundException('User not found');
        const settings = await this.prisma.userSettings.upsert({ where: { user_id: userId }, create: { user_id: userId }, update: {} });
        const organizations = await this.orgs.listMine(userId);
        return { user: toPublicUser(user), settings, organizations };
    }

    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                name: dto.name?.trim(),
                job_title: dto.job_title,
                about_me: dto.about_me,
                timezone: dto.timezone,
                working_hours: dto.working_hours === null ? Prisma.DbNull : (dto.working_hours as Prisma.InputJsonValue | undefined),
                avatar_file_id: dto.avatar_file_id,
            },
        });
        return toPublicUser(user);
    }

    /** Sets this member's colour theme in one organisation only (other organisations keep their own). */
    async updateColorTheme(membership: OrgMembership, colorTheme: ColorTheme) {
        const member = await this.prisma.organizationMember.update({
            where: { organization_id_user_id: { organization_id: membership.organization_id, user_id: membership.user_id } },
            data: { color_theme: colorTheme },
            select: { organization_id: true, color_theme: true },
        });
        return member;
    }

    async updateSettings(userId: string, dto: UpdateUserSettingsDto) {
        if (dto.default_bot_id) {
            const bot = await this.prisma.bot.findFirst({ where: { id: dto.default_bot_id, deleted_at: null } });
            if (!bot) throw new BadRequestException('Unknown bot');
        }
        return this.prisma.userSettings.upsert({ where: { user_id: userId }, create: { user_id: userId, ...dto }, update: dto });
    }

    /** §13.2 Security: delete account (settings screen only, with password confirmation). */
    async deleteAccount(userId: string, password: string) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (!(await bcrypt.compare(password, user.password))) throw new BadRequestException('Password is incorrect');
        const owned = await this.prisma.organizationMember.findMany({ where: { user_id: userId, role: 'OWNER', organization: { is_personal: false, deleted_at: null } } });
        for (const m of owned) {
            const owners = await this.prisma.organizationMember.count({ where: { organization_id: m.organization_id, role: 'OWNER' } });
            const members = await this.prisma.organizationMember.count({ where: { organization_id: m.organization_id } });
            if (owners <= 1 && members > 1) throw new BadRequestException('Hand over ownership of your organisations before deleting your account');
        }
        await this.prisma.$transaction([
            this.prisma.session.updateMany({ where: { user_id: userId }, data: { revoked_at: new Date() } }),
            this.prisma.user.update({ where: { id: userId }, data: { deleted_at: new Date(), email: `deleted+${userId}@agentspace.invalid`, password: '' } }),
        ]);
        return { ok: true };
    }

    // ---- Devices (§14.1) ----

    listDevices(userId: string) {
        return this.prisma.device.findMany({
            where: { user_id: userId, sessions: { some: { revoked_at: null, expires_at: { gt: new Date() } } } },
            select: { id: true, name: true, platform: true, app_version: true, last_seen_at: true, is_online: true, created_at: true },
            orderBy: { last_seen_at: 'desc' },
        });
    }

    async renameDevice(userId: string, id: string, name: string) {
        const res = await this.prisma.device.updateMany({ where: { id, user_id: userId }, data: { name: name.slice(0, 80) } });
        if (!res.count) throw new NotFoundException('Device not found');
        return { ok: true };
    }

    async signOutDevice(userId: string, id: string) {
        await this.prisma.session.updateMany({ where: { device_id: id, user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } });
        return { ok: true };
    }

    /** Stores (or clears) this device's Web Push subscription. The same browser subscription is never kept on two devices. */
    /**
     * Stores (or clears) this device's push registration: a Web Push subscription, or an FCM/APNs token from the
     * mobile apps. The same subscription/token is never kept on two devices.
     */
    async setPushSubscription(
        userId: string,
        sessionId: string,
        sub: { provider?: 'WEBPUSH' | 'FCM' | 'APNS'; endpoint?: string; keys?: { p256dh: string; auth: string }; token?: string } | null,
    ) {
        const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
        if (!session?.device_id) throw new NotFoundException('This device is not registered — sign in again');
        if (!sub) {
            await this.prisma.device.update({ where: { id: session.device_id }, data: { push_provider: null, push_token: null } });
            return { enabled: false };
        }
        const provider = sub.provider ?? 'WEBPUSH';
        const token = provider === 'WEBPUSH' ? JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.keys!.p256dh, auth: sub.keys!.auth } }) : sub.token!;
        const match = provider === 'WEBPUSH' ? { push_token: { contains: sub.endpoint! } } : { push_token: token };
        await this.prisma.device.updateMany({ where: { ...match, id: { not: session.device_id } }, data: { push_provider: null, push_token: null } });
        await this.prisma.device.update({ where: { id: session.device_id }, data: { push_provider: provider, push_token: token } });
        return { enabled: true, device_id: session.device_id };
    }

    async heartbeat(userId: string, sessionId: string, appVersion?: string, capabilities?: string[]) {
        const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
        if (session?.device_id) {
            await this.prisma.device.update({
                where: { id: session.device_id },
                data: { last_seen_at: new Date(), app_version: appVersion, capabilities: capabilities ?? undefined },
            });
        }
        await this.prisma.user.update({ where: { id: userId }, data: { last_active_at: new Date() } });
        return { ok: true };
    }

    /** §14.1 Version check: minimum supported app version per platform. */
    async versionPolicy(platform: Platform) {
        const p = await this.prisma.appVersionPolicy.findUnique({ where: { platform } });
        return { platform, minimum_version: p?.minimum_version ?? '0.0.0', latest_version: p?.latest_version ?? null, update_url: p?.update_url ?? null };
    }
}
