import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

/** Validates the Bearer access token (HTTP). Attaches `{ id, role, session_id }` to request.user. */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
    getRequest(context: ExecutionContext) {
        return context.switchToHttp().getRequest();
    }

    handleRequest(err: any, user: any, info: any) {
        if (info instanceof TokenExpiredError) {
            throw new UnauthorizedException({ message: 'Access token expired', code: 'token_expired' });
        }
        if (info instanceof JsonWebTokenError) {
            throw new UnauthorizedException({ message: 'Invalid token', code: 'invalid_token' });
        }
        if (err || !user) {
            throw new UnauthorizedException({ message: 'Authentication required', code: 'authentication_required' });
        }
        return user;
    }
}
