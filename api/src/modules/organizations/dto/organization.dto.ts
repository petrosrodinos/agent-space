import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ArrayMaxSize } from 'class-validator';
import {
    ActionType, AppLanguage, ApprovalTimeoutAction, InvitationExpiry, InteractiveRepliesMode, MinApprovalLevel, ModelPolicy, OrganizationRole,
    OrgConversationRetention, PublicLinkPolicy, WhoCan, MaxFileSize, ScheduleFrequency, LimitReachedAction,
    BiometricApprovalScope,
} from 'generated/prisma';
import { VOICE_MODEL_IDS } from '@/modules/voice/voice-models';

export class CreateOrganizationDto {
    @ApiProperty({ example: 'Acme' }) @IsString() @MinLength(1) @MaxLength(80) name: string;
    @ApiPropertyOptional({ example: '#6B4EFF' }) @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) brand_color?: string;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
    @ApiPropertyOptional() @IsOptional() @IsString() logo_file_id?: string | null;
}

/** §13.4 organisation settings that can be changed in the settings screens. */
export class UpdateOrganizationSettingsDto {
    @ApiPropertyOptional({ enum: AppLanguage }) @IsOptional() @IsEnum(AppLanguage) default_language?: AppLanguage;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) default_timezone?: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() invite_links_enabled?: boolean;
    @ApiPropertyOptional({ enum: ['MEMBER', 'ADMIN'] }) @IsOptional() @IsIn(['MEMBER', 'ADMIN']) default_invite_role?: OrganizationRole;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) auto_join_domain?: string | null;
    @ApiPropertyOptional({ enum: InvitationExpiry }) @IsOptional() @IsEnum(InvitationExpiry) invitation_expiry?: InvitationExpiry;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) company_instructions?: string | null;
    @ApiPropertyOptional({ enum: WhoCan }) @IsOptional() @IsEnum(WhoCan) who_can_create_bots?: WhoCan;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(1000) max_bots_per_member?: number | null;
    @ApiPropertyOptional() @IsOptional() @IsString() default_model_id?: string | null;
    @ApiPropertyOptional({ enum: ModelPolicy }) @IsOptional() @IsEnum(ModelPolicy) model_policy?: ModelPolicy;
    @ApiPropertyOptional({ isArray: true }) @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) allowed_model_ids?: string[];
    @ApiPropertyOptional() @IsOptional() @IsBoolean() model_auto_fallback?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() model_compare_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() members_private_tool_servers?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() members_api_key_connections?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() builtin_web_search?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() builtin_image_generation?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() builtin_document_creation?: boolean;
    @ApiPropertyOptional({ enum: InteractiveRepliesMode }) @IsOptional() @IsEnum(InteractiveRepliesMode) interactive_replies_mode?: InteractiveRepliesMode;
    @ApiPropertyOptional({ enum: MinApprovalLevel }) @IsOptional() @IsEnum(MinApprovalLevel) min_approval_level?: MinApprovalLevel;
    @ApiPropertyOptional({ enum: ActionType, isArray: true }) @IsOptional() @IsArray() @IsEnum(ActionType, { each: true }) enforced_approvals?: ActionType[];
    @ApiPropertyOptional() @IsOptional() @IsBoolean() bots_consulting_enabled?: boolean;
    @ApiPropertyOptional({ enum: BiometricApprovalScope, isArray: true, description: 'Approvals that need fingerprint / face unlock on mobile, on top of payments and website passwords (§13.4)' }) @IsOptional() @IsArray() @IsEnum(BiometricApprovalScope, { each: true }) biometric_approval_scopes?: BiometricApprovalScope[];
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(60 * 24 * 30) approval_timeout_minutes?: number | null;
    @ApiPropertyOptional({ enum: ApprovalTimeoutAction, description: 'APPROVE = accept automatically when the timeout is reached' }) @IsOptional() @IsEnum(ApprovalTimeoutAction) approval_timeout_action?: ApprovalTimeoutAction;
    @ApiPropertyOptional({ enum: WhoCan }) @IsOptional() @IsEnum(WhoCan) who_can_create_skills?: WhoCan;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() starter_skills_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() artifacts_enabled?: boolean;
    @ApiPropertyOptional({ enum: PublicLinkPolicy }) @IsOptional() @IsEnum(PublicLinkPolicy) public_link_policy?: PublicLinkPolicy;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() voice_mode_enabled?: boolean;
    @ApiPropertyOptional({ description: 'Camera and screen sharing in voice mode (§7.6)' }) @IsOptional() @IsBoolean() voice_visual_input?: boolean;
    @ApiPropertyOptional({ enum: VOICE_MODEL_IDS, nullable: true, description: 'null = platform default' }) @IsOptional() @IsIn([...VOICE_MODEL_IDS, null]) voice_model?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() automations_enabled?: boolean;
    @ApiPropertyOptional({ enum: ScheduleFrequency }) @IsOptional() @IsEnum(ScheduleFrequency) max_schedule_frequency?: ScheduleFrequency;
    @ApiPropertyOptional({ enum: LimitReachedAction }) @IsOptional() @IsEnum(LimitReachedAction) limit_reached_action?: LimitReachedAction;
    @ApiPropertyOptional({ enum: OrgConversationRetention }) @IsOptional() @IsEnum(OrgConversationRetention) conversation_retention?: OrgConversationRetention;
    @ApiPropertyOptional({ enum: MaxFileSize }) @IsOptional() @IsEnum(MaxFileSize) max_file_size?: MaxFileSize;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() members_may_export?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() temporary_chats_allowed?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() require_two_factor?: boolean;
}

export class InviteMembersDto {
    @ApiProperty({ isArray: true, example: ['anna@acme.com'] }) @IsArray() @ArrayMaxSize(50) @IsEmail({}, { each: true }) emails: string[];
    @ApiProperty({ enum: OrganizationRole }) @IsEnum(OrganizationRole) role: OrganizationRole;
}

export class CreateInviteLinkDto {
    @ApiProperty({ enum: ['MEMBER', 'ADMIN'] }) @IsIn(['MEMBER', 'ADMIN']) role: OrganizationRole;
}

export class UpdateMemberRoleDto {
    @ApiProperty({ enum: OrganizationRole }) @IsEnum(OrganizationRole) role: OrganizationRole;
}

export class TransferOwnershipDto {
    @ApiProperty() @IsString() user_id: string;
}
