import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard } from '@/shared/guards/org.guard';
import { CurrentMembership, OrgRoles } from '@/shared/decorators/org-roles.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ActivityService } from './activity.service';
import { ActivityQuerySchema, type ActivityQuery } from './dto/activity-query.schema';

@ApiTags('Activity history')
@ApiBearerAuth()
@Controller('activity')
@UseGuards(JwtGuard, OrgGuard)
export class ActivityController {
    constructor(private readonly activity: ActivityService) { }

    @Get()
    @OrgRoles('OWNER', 'ADMIN')
    @ApiOperation({ summary: 'Organisation activity history (Owners and Admins, §11)' })
    list(@CurrentMembership('organization_id') orgId: string, @Query(new ZodValidationPipe(ActivityQuerySchema)) q: ActivityQuery) {
        return this.activity.list(orgId, q);
    }
}
