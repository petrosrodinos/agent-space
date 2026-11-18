import { Body, Controller, Delete, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ConfigService } from '@nestjs/config';
import { Platform } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interface';
import { UsersService } from './users.service';
import { DeleteAccountDto, HeartbeatDto, UpdateProfileDto, UpdateUserSettingsDto } from './dto/user.dto';

class RenameDeviceDto {
    @IsString() @MinLength(1) @MaxLength(80) name: string;
}

class PushKeysDto {
    @IsString() @MaxLength(200) p256dh: string;
    @IsString() @MaxLength(100) auth: string;
}

/** A browser PushSubscription (toJSON()), or an FCM/APNs device token from the mobile apps (§14.2). */
class PushSubscriptionDto {
    @ValidateIf((o) => !o.provider || o.provider === 'WEBPUSH') @IsUrl({ require_protocol: true, protocols: ['https'], require_tld: false }) @MaxLength(1000) endpoint?: string;
    @ValidateIf((o) => !o.provider || o.provider === 'WEBPUSH') @IsObject() @ValidateNested() @Type(() => PushKeysDto) keys?: PushKeysDto;
    @IsOptional() @IsIn(['WEBPUSH', 'FCM', 'APNS']) provider?: 'WEBPUSH' | 'FCM' | 'APNS';
    @ValidateIf((o) => o.provider === 'FCM' || o.provider === 'APNS') @IsString() @MinLength(8) @MaxLength(4096) token?: string;
}

@ApiTags('Me')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtGuard)
export class UsersController {
    constructor(private readonly users: UsersService) { }

    @Get()
    @ApiOperation({ summary: 'My profile, personal settings and organisations' })
    me(@CurrentUser('id') userId: string) {
        return this.users.me(userId);
    }

    @Patch()
    updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
        return this.users.updateProfile(userId, dto);
    }

    @Patch('settings')
    @ApiOperation({ summary: 'Update personal settings (§13.2)' })
    updateSettings(@CurrentUser('id') userId: string, @Body() dto: UpdateUserSettingsDto) {
        return this.users.updateSettings(userId, dto);
    }

    @Post('delete-account')
    deleteAccount(@CurrentUser('id') userId: string, @Body() dto: DeleteAccountDto) {
        return this.users.deleteAccount(userId, dto.password);
    }

    @Get('devices')
    devices(@CurrentUser('id') userId: string) {
        return this.users.listDevices(userId);
    }

    @Patch('devices/:id')
    renameDevice(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RenameDeviceDto) {
        return this.users.renameDevice(userId, id, dto.name);
    }

    @Delete('devices/:id')
    signOutDevice(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.users.signOutDevice(userId, id);
    }

    @Post('push-subscription')
    @ApiOperation({ summary: 'Turn on push notifications for this device (Web Push subscription, §12)' })
    subscribePush(@CurrentUser() user: AuthUser, @Body() dto: PushSubscriptionDto) {
        return this.users.setPushSubscription(user.id, user.session_id, dto);
    }

    @Delete('push-subscription')
    @ApiOperation({ summary: 'Turn off push notifications for this device' })
    unsubscribePush(@CurrentUser() user: AuthUser) {
        return this.users.setPushSubscription(user.id, user.session_id, null);
    }

    @Post('heartbeat')
    heartbeat(@CurrentUser() user: AuthUser, @Body() dto: HeartbeatDto) {
        return this.users.heartbeat(user.id, user.session_id, dto.app_version, dto.capabilities);
    }
}

@ApiTags('Platform')
@Controller('app')
export class AppVersionController {
    constructor(
        private readonly users: UsersService,
        private readonly config: ConfigService,
    ) { }

    @Get('push-config')
    @ApiOperation({ summary: 'Public VAPID key for Web Push (null when push is not configured)' })
    pushConfig() {
        return { vapid_public_key: this.config.get<string>('VAPID_PUBLIC_KEY') || null };
    }

    @Get('version')
    @ApiOperation({ summary: 'Minimum supported app version per platform (§14.1)' })
    version(@Query('platform', new ParseEnumPipe(Platform, { optional: true })) platform?: Platform) {
        return this.users.versionPolicy(platform ?? 'WEB');
    }
}
