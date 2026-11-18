import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import type { AuthUser } from './interfaces/auth.interface';
import { AuthService, RequestMeta } from './auth.service';
import { ChangePasswordDto, DeviceInfoDto, ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

export const REFRESH_COOKIE = 'as_rt';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly config: ConfigService,
    ) { }

    /** The desktop and mobile apps identify themselves with X-Client-Platform / X-App-Version (§14.1). */
    private meta(req: Request, device?: DeviceInfoDto): RequestMeta {
        const header = String(req.headers['x-client-platform'] || '').toUpperCase();
        const platform = (['WEB', 'DESKTOP', 'IOS', 'ANDROID'] as const).find((p) => p === header);
        const version = typeof req.headers['x-app-version'] === 'string' ? req.headers['x-app-version'].slice(0, 32) : undefined;
        return {
            ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
            user_agent: req.headers['user-agent'],
            device: device ?? (platform ? { platform, app_version: version } : undefined),
        };
    }

    /** Web: refresh token in an httpOnly cookie, never readable by JS. Native apps get it in the body (§14.1). */
    private respond(req: Request, res: Response, result: { refresh_token: string; refresh_expires_at: string } & Record<string, unknown>) {
        const secure = (this.config.get<string>('API_URL') || '').startsWith('https');
        res.cookie(REFRESH_COOKIE, result.refresh_token, {
            httpOnly: true,
            secure,
            sameSite: secure ? 'none' : 'lax',
            path: '/',
            expires: new Date(result.refresh_expires_at),
        });
        const platform = String(req.headers['x-client-platform'] || 'web').toLowerCase();
        if (platform === 'web') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { refresh_token, ...rest } = result;
            return rest;
        }
        return result;
    }

    @Post('register')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @ApiOperation({ summary: 'Create an account (a personal organisation is created automatically)' })
    async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        return this.respond(req, res, await this.auth.register(dto, this.meta(req)));
    }

    @Post('login')
    @HttpCode(200)
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        return this.respond(req, res, await this.auth.login(dto, this.meta(req)));
    }

    @Post('refresh')
    @HttpCode(200)
    @Throttle({ default: { limit: 60, ttl: 60_000 } })
    @ApiOperation({ summary: 'Exchange the refresh token (cookie or body) for a new access token; rotates the refresh token' })
    async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const token = dto.refresh_token || req.cookies?.[REFRESH_COOKIE];
        return this.respond(req, res, await this.auth.refresh(token));
    }

    @Post('logout')
    @HttpCode(200)
    async logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const token = dto.refresh_token || req.cookies?.[REFRESH_COOKIE];
        res.clearCookie(REFRESH_COOKIE, { path: '/' });
        return this.auth.logout(undefined, token);
    }

    @Post('forgot-password')
    @HttpCode(200)
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    forgot(@Body() dto: ForgotPasswordDto) {
        return this.auth.forgotPassword(dto.email);
    }

    @Post('reset-password')
    @HttpCode(200)
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    reset(@Body() dto: ResetPasswordDto) {
        return this.auth.resetPassword(dto);
    }

    @Post('change-password')
    @HttpCode(200)
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    change(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
        return this.auth.changePassword(user.id, user.session_id, dto);
    }

    @Get('sessions')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    sessions(@CurrentUser() user: AuthUser) {
        return this.auth.listSessions(user.id, user.session_id);
    }

    @Delete('sessions/:id')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    revoke(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.auth.revokeSession(userId, id);
    }

    @Post('sessions/revoke-others')
    @HttpCode(200)
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    revokeOthers(@CurrentUser() user: AuthUser) {
        return this.auth.revokeOtherSessions(user.id, user.session_id);
    }
}
