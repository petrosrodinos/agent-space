import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRole, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

export const isAdminRole = (role?: OrganizationRole | null) => role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN;

/**
 * Central permission rules (§5.3, §6.2, §7.2, §8.3). Every service and every tool call
 * goes through these checks so bots never act beyond what the requesting user may do (§6.5).
 */
@Injectable()
export class AccessService {
    constructor(private readonly prisma: PrismaService) { }

    async membership(orgId: string, userId: string) {
        return this.prisma.organizationMember.findUnique({
            where: { organization_id_user_id: { organization_id: orgId, user_id: userId } },
        });
    }

    async requireMember(orgId: string, userId: string) {
        const m = await this.membership(orgId, userId);
        if (!m) throw new ForbiddenException('You are not a member of this organisation');
        return m;
    }

    /** Bots a user may use: their own private bots plus organisation-wide bots. */
    usableBotsWhere(orgId: string, userId: string): Prisma.BotWhereInput {
        return {
            organization_id: orgId,
            deleted_at: null,
            OR: [{ created_by_id: userId }, { visibility: 'ORGANIZATION' }],
        };
    }

    async requireUsableBot(orgId: string, userId: string, botId: string) {
        const bot = await this.prisma.bot.findFirst({ where: { id: botId, ...this.usableBotsWhere(orgId, userId) } });
        if (!bot) throw new NotFoundException('Bot not found');
        return bot;
    }

    /** §13.3 Sharing "Who can edit": creator only, or creator + Owners/Admins. */
    async canEditBot(orgId: string, userId: string, bot: { created_by_id: string | null; edit_policy: string; visibility: string }) {
        if (bot.created_by_id === userId) return true;
        const m = await this.membership(orgId, userId);
        if (!m) return false;
        if (bot.visibility === 'ORGANIZATION' && isAdminRole(m.role)) return true;
        return bot.edit_policy === 'CREATOR_AND_ADMINS' && isAdminRole(m.role);
    }

    async requireEditableBot(orgId: string, userId: string, botId: string) {
        const bot = await this.prisma.bot.findFirst({ where: { id: botId, organization_id: orgId, deleted_at: null } });
        if (!bot) throw new NotFoundException('Bot not found');
        if (!(await this.canEditBot(orgId, userId, bot))) throw new ForbiddenException('You cannot edit this bot');
        return bot;
    }

    async requireParticipant(conversationId: string, userId: string) {
        const p = await this.prisma.conversationParticipant.findFirst({
            where: { conversation_id: conversationId, user_id: userId, left_at: null, conversation: { deleted_at: null } },
            include: { conversation: true },
        });
        if (!p) throw new NotFoundException('Conversation not found');
        return p;
    }

    async isParticipant(conversationId: string, userId: string) {
        const n = await this.prisma.conversationParticipant.count({
            where: { conversation_id: conversationId, user_id: userId, left_at: null },
        });
        return n > 0;
    }

    /** Connections a bot may use on behalf of a user (§8.3): the user's private ones, and shared ones not limited away from this bot. */
    usableConnectionsWhere(orgId: string, userId: string, botId?: string): Prisma.ConnectionWhereInput {
        return {
            organization_id: orgId,
            deleted_at: null,
            OR: [
                // "Limit to bots" applies to private connections too (e.g. a member's own custom tool server, §8.4).
                { visibility: 'PRIVATE', owner_id: userId, ...(botId ? { OR: [{ restricted_to_bots: false }, { bot_restrictions: { some: { bot_id: botId } } }] } : {}) },
                {
                    visibility: 'SHARED',
                    ...(botId ? { OR: [{ restricted_to_bots: false }, { bot_restrictions: { some: { bot_id: botId } } }] } : {}),
                },
            ],
        };
    }

    /** Skills a user can see and use (§6.7): mine, shared with me, organisation-wide, and the starter library. */
    usableSkillsWhere(orgId: string, userId: string): Prisma.SkillWhereInput {
        return {
            deleted_at: null,
            OR: [
                { organization_id: orgId, owner_id: userId },
                { organization_id: orgId, sharing_level: 'ORGANIZATION' },
                { organization_id: orgId, sharing_level: 'SPECIFIC_MEMBERS', shares: { some: { user_id: userId } } },
                { organization_id: null, is_starter: true },
            ],
        };
    }

    usableCredentialsWhere(orgId: string, userId: string): Prisma.CredentialWhereInput {
        return {
            organization_id: orgId,
            deleted_at: null,
            OR: [{ visibility: 'PRIVATE', owner_id: userId }, { visibility: 'SHARED' }],
        };
    }
}
