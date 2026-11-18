import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ActionType } from 'generated/prisma';
import { z } from 'zod';
import { PaginationQuerySchema } from '@/shared/utils/pagination/pagination.utils';

const ACTION_TYPES = Object.values(ActionType);

export class PreApprovalDto {
    @ApiProperty({ enum: ACTION_TYPES, example: 'SEND_MESSAGE' }) @IsIn(ACTION_TYPES) action_type: ActionType;
    @ApiPropertyOptional({ description: 'Connection the pre-approval is limited to' }) @IsOptional() @IsUUID() connection_id?: string | null;
    @ApiProperty({ example: 'channel:#security', description: 'The one place this covers, e.g. "channel:#security", "email:anna@acme.com", "repo:acme/x"' })
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    target: string;
}

export class CreateAutomationDto {
    @ApiProperty({ example: 'Daily vulnerability scan – x' }) @IsString() @MinLength(1) @MaxLength(120) name: string;
    @ApiProperty() @IsUUID() bot_id: string;
    @ApiProperty({ description: 'What to do on each run, in plain language' }) @IsString() @MinLength(3) @MaxLength(20000) instructions: string;
    @ApiProperty({ example: '0 7 * * *', description: '5-part cron expression' }) @IsString() @MinLength(9) @MaxLength(100) cron_expression: string;
    @ApiPropertyOptional({ example: 'Europe/Athens' }) @IsOptional() @IsString() @MaxLength(64) timezone?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() skill_id?: string | null;
    @ApiPropertyOptional({ isArray: true }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) connection_ids?: string[];
    @ApiPropertyOptional({ type: [PreApprovalDto] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PreApprovalDto) pre_approvals?: PreApprovalDto[];
    @ApiPropertyOptional({ description: 'What the automation keeps between runs' }) @IsOptional() @IsString() @MaxLength(2000) memory_plan?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() uses_cloud_computer?: boolean;
    @ApiPropertyOptional({ description: 'Conversation where results are posted (default: a direct chat with the bot)' }) @IsOptional() @IsUUID() results_conversation_id?: string | null;
    @ApiPropertyOptional({ description: 'Also email the results to the owner' }) @IsOptional() @IsBoolean() email_results?: boolean;
    @ApiPropertyOptional({ description: 'Extra email recipient for results' }) @IsOptional() @IsEmail() results_email?: string | null;
    @ApiPropertyOptional({ description: 'Results also go to a connected service, e.g. connection + "channel:#y"' }) @IsOptional() @IsUUID() results_connection_id?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) results_target?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsUUID() source_conversation_id?: string | null;
}

export class UpdateAutomationDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(20000) instructions?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(9) @MaxLength(100) cron_expression?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) timezone?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() bot_id?: string;
    @ApiPropertyOptional() @IsOptional() @IsUUID() skill_id?: string | null;
    @ApiPropertyOptional({ isArray: true }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) connection_ids?: string[];
    @ApiPropertyOptional({ type: [PreApprovalDto] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PreApprovalDto) pre_approvals?: PreApprovalDto[];
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) memory_plan?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() uses_cloud_computer?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsUUID() results_conversation_id?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() email_results?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsEmail() results_email?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsUUID() results_connection_id?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) results_target?: string | null;
}

export class UpdateAutomationMemoryDto {
    @ApiProperty({ description: 'Notes JSON document (max 1 MB)' }) @IsObject() notes: Record<string, unknown>;
}

export const AutomationListQuerySchema = z.object({
    status: z.enum(['ACTIVE', 'PAUSED', 'NEEDS_ATTENTION']).optional(),
    bot_id: z.string().uuid().optional(),
    search: z.string().trim().max(80).optional(),
});
export type AutomationListQuery = z.infer<typeof AutomationListQuerySchema>;

export const AutomationRunsQuerySchema = PaginationQuerySchema;
export type AutomationRunsQuery = z.infer<typeof AutomationRunsQuerySchema>;
