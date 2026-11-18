import { AuthRole } from 'generated/prisma';

export const AuthRoles = AuthRole;

export interface AccessTokenPayload {
    sub: string;
    sid: string;
    role: AuthRole;
    typ: 'access';
}

export interface AuthUser {
    id: string;
    role: AuthRole;
    session_id: string;
}

export interface AuthTokens {
    access_token: string;
    /** Unix seconds when the access token expires. */
    expires_in: number;
    /** Returned in the body as well as an httpOnly cookie so native apps can store it via platform.storage (§14.1). */
    refresh_token: string;
    refresh_expires_at: string;
}
