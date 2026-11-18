import { CanActivate, ExecutionContext, ForbiddenException, Injectable, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator';

export const ORG_HEADER = 'x-organization-id';

export interface OrgMembership {
    organization_id: string;
    role: OrganizationRole;
    user_id: string;
}

/**
 * Resolves the currently selected organisation (§5.1) from the `X-Organization-Id` header,
 * verifies membership, and enforces `@OrgRoles(...)`. Must run after JwtGuard.
 */
@Injectable()
export class OrgGuard implements CanActivate {
    constructor(
        private readonly prisma: PrismaService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const userId: string | undefined = req.user?.id;
        if (!userId) throw new ForbiddenException('Authentication required');

        const orgId = (req.headers[ORG_HEADER] as string) || req.params?.orgId;
        if (!orgId) throw new BadRequestException({ message: 'Organisation not selected', code: 'organization_required' });

        const membership = await this.prisma.organizationMember.findFirst({
            where: { organization_id: orgId, user_id: userId, organization: { deleted_at: null } },
            select: { organization_id: true, role: true, user_id: true },
        });
        if (!membership) throw new ForbiddenException({ message: 'You are not a member of this organisation', code: 'not_a_member' });

        const required = this.reflector.getAllAndOverride<OrganizationRole[]>(ORG_ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (required?.length && !required.includes(membership.role)) {
            throw new ForbiddenException({ message: 'Your role does not allow this action', code: 'insufficient_role' });
        }

        req.membership = membership satisfies OrgMembership;
        return true;
    }
}
