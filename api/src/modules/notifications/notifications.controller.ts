import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { IsArray, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel, NotificationEvent } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { PaginationQuerySchema } from '@/shared/utils/pagination/pagination.utils';
import { NotificationsService } from './notifications.service';

const NotificationQuerySchema = PaginationQuerySchema.extend({ unread: z.enum(['true', 'false', '1', '0']).optional().transform((v) => v === 'true' || v === '1') });
type NotificationQuery = z.infer<typeof NotificationQuerySchema>;

class UpdatePreferenceDto {
    @ApiProperty({ enum: NotificationEvent }) @IsEnum(NotificationEvent) event: NotificationEvent;
    @ApiProperty() @IsBoolean() enabled: boolean;
    @ApiProperty({ enum: NotificationChannel, isArray: true }) @IsArray() @IsEnum(NotificationChannel, { each: true }) channels: NotificationChannel[];
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationsController {
    constructor(private readonly notifications: NotificationsService) { }

    @Get()
    @ApiOperation({ summary: 'List my notifications' })
    list(@CurrentUser('id') userId: string, @Query(new ZodValidationPipe(NotificationQuerySchema)) q: NotificationQuery) {
        return this.notifications.list(userId, q);
    }

    @Post('read-all')
    markAll(@CurrentUser('id') userId: string) {
        return this.notifications.markAllRead(userId);
    }

    @Post(':id/read')
    markRead(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.notifications.markRead(userId, id);
    }

    @Get('preferences')
    preferences(@CurrentUser('id') userId: string) {
        return this.notifications.getPreferences(userId);
    }

    @Patch('preferences')
    updatePreference(@CurrentUser('id') userId: string, @Body() dto: UpdatePreferenceDto) {
        return this.notifications.updatePreference(userId, dto.event, dto.enabled, dto.channels);
    }
}
