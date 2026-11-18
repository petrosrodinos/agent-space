import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership, OrgRoles } from '@/shared/decorators/org-roles.decorator';
import { UsageService } from './usage.service';

class SetLimitDto {
    @ApiProperty({ enum: ['ORGANIZATION', 'MEMBER', 'BOT'] }) @IsIn(['ORGANIZATION', 'MEMBER', 'BOT']) scope: 'ORGANIZATION' | 'MEMBER' | 'BOT';
    @ApiPropertyOptional() @IsOptional() @IsUUID() user_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() bot_id?: string;
    @ApiProperty({ nullable: true, description: 'USD per month; null removes the limit' }) @ValidateIf((o) => o.monthly_limit !== null) @IsNumber() @Min(0) monthly_limit: number | null;
}

@ApiTags('Usage')
@ApiBearerAuth()
@Controller('usage')
@UseGuards(JwtGuard, OrgGuard)
export class UsageController {
    constructor(private readonly usage: UsageService) { }

    @Get()
    overview(@CurrentMembership() m: OrgMembership, @Query('period') period?: string) {
        return this.usage.overview({ user_id: m.user_id, organization_id: m.organization_id, role: m.role }, period && /^\d{4}-\d{2}$/.test(period) ? period : undefined);
    }

    @Put('limits')
    @OrgRoles('OWNER', 'ADMIN')
    setLimit(@CurrentMembership() m: OrgMembership, @Body() dto: SetLimitDto) {
        return this.usage.setLimit({ user_id: m.user_id, organization_id: m.organization_id, role: m.role }, dto);
    }
}
