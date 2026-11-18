import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrganizationRole } from 'generated/prisma';

export const ORG_ROLES_KEY = 'org_roles';

/** Restrict an endpoint to organisation roles (§5.3). */
export const OrgRoles = (...roles: OrganizationRole[]) => SetMetadata(ORG_ROLES_KEY, roles);

/** The membership resolved by OrgGuard: `{ organization_id, role, user_id }`. */
export const CurrentMembership = createParamDecorator((field: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return field ? req.membership?.[field] : req.membership;
});
