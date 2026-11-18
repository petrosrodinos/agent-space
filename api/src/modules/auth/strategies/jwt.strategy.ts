import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser, AccessTokenPayload } from '../interfaces/auth.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.get('JWT_SECRET'),
            ignoreExpiration: false,
        });
    }

    async validate(payload: AccessTokenPayload): Promise<AuthUser> {
        if (!payload?.sub || payload.typ !== 'access') throw new Error('Invalid token');
        return { id: payload.sub, role: payload.role, session_id: payload.sid };
    }
}
