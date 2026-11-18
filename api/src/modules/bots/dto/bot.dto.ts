import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import {
    ActionType, ApprovalLevel, ApprovalOverride, AppLanguage, BotClarifyingQuestions, BotEditPolicy, BotGroupResponse, BotVisibility, Creativity,
    EmojiUsage, InteractiveRepliesMode, MaxTaskDuration, MemoryScope, ReplyFormatting, ReplyLength, ReplyTone, SpokenReplyStyle,
} from 'generated/prisma';

export class CreateBotDto {
    @ApiProperty({ example: 'Sales Sam' }) @IsString() @MinLength(1) @MaxLength(60) name: string;
    @ApiPropertyOptional({ example: '💼' }) @IsOptional() @IsString() @MaxLength(16) emoji?: string;
    @ApiPropertyOptional({ example: '#FF7A3D' }) @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) description?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) instructions?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) welcome_message?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMaxSize(4) @IsString({ each: true }) @MaxLength(200, { each: true }) conversation_starters?: string[];
    @ApiPropertyOptional() @IsOptional() @IsUUID() model_id?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsUUID() template_id?: string;
    @ApiPropertyOptional({ enum: Creativity }) @IsOptional() @IsEnum(Creativity) creativity?: Creativity;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() style_override?: boolean;
    @ApiPropertyOptional({ enum: ReplyLength }) @IsOptional() @IsEnum(ReplyLength) reply_length?: ReplyLength | null;
    @ApiPropertyOptional({ enum: ReplyTone }) @IsOptional() @IsEnum(ReplyTone) reply_tone?: ReplyTone | null;
    @ApiPropertyOptional({ enum: ReplyFormatting }) @IsOptional() @IsEnum(ReplyFormatting) reply_formatting?: ReplyFormatting | null;
    @ApiPropertyOptional({ enum: EmojiUsage }) @IsOptional() @IsEnum(EmojiUsage) emoji_usage?: EmojiUsage | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() lock_style?: boolean;
    @ApiPropertyOptional({ enum: AppLanguage }) @IsOptional() @IsEnum(AppLanguage) reply_language?: AppLanguage | null;
    @ApiPropertyOptional({ enum: BotClarifyingQuestions }) @IsOptional() @IsEnum(BotClarifyingQuestions) clarifying_questions?: BotClarifyingQuestions;
    @ApiPropertyOptional({ enum: BotGroupResponse }) @IsOptional() @IsEnum(BotGroupResponse) group_response?: BotGroupResponse;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() web_search_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() image_generation_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() document_creation_enabled?: boolean;
    @ApiPropertyOptional({ enum: InteractiveRepliesMode }) @IsOptional() @IsEnum(InteractiveRepliesMode) interactive_replies_mode?: InteractiveRepliesMode;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() artifacts_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() cloud_computer_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() use_skills_automatically?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() org_knowledge_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() voice_mode_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) voice?: string | null;
    @ApiPropertyOptional({ enum: SpokenReplyStyle }) @IsOptional() @IsEnum(SpokenReplyStyle) spoken_reply_style?: SpokenReplyStyle;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() memory_enabled?: boolean;
    @ApiPropertyOptional({ enum: MemoryScope }) @IsOptional() @IsEnum(MemoryScope) memory_scope?: MemoryScope;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() can_ask_other_bots?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() can_be_asked?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_sensitive?: boolean;
    @ApiPropertyOptional({ enum: ApprovalLevel }) @IsOptional() @IsEnum(ApprovalLevel) approval_level?: ApprovalLevel;
    @ApiPropertyOptional({ enum: MaxTaskDuration }) @IsOptional() @IsEnum(MaxTaskDuration) max_task_duration?: MaxTaskDuration;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) monthly_usage_limit?: number | null;
    @ApiPropertyOptional({ enum: BotVisibility }) @IsOptional() @IsEnum(BotVisibility) visibility?: BotVisibility;
    @ApiPropertyOptional({ enum: BotEditPolicy }) @IsOptional() @IsEnum(BotEditPolicy) edit_policy?: BotEditPolicy;
}

export class UpdateBotDto extends PartialType(CreateBotDto) { }

export class DraftBotDto {
    @ApiProperty({ example: 'Make me a sales assistant that preps me for calls and keeps HubSpot updated' })
    @IsString() @MinLength(5) @MaxLength(2000) description: string;
}

class ApprovalRuleDto {
    @ApiProperty({ enum: ActionType }) @IsEnum(ActionType) action_type: ActionType;
    @ApiProperty({ enum: ['ALWAYS_ASK', 'DONT_ASK', 'DEFAULT'] }) @IsIn(['ALWAYS_ASK', 'DONT_ASK', 'DEFAULT']) override: ApprovalOverride | 'DEFAULT';
}

export class SetApprovalRulesDto {
    @ApiProperty({ type: [ApprovalRuleDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => ApprovalRuleDto) rules: ApprovalRuleDto[];
}

class BotConnectionDto {
    @ApiProperty() @IsUUID() connection_id: string;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() is_default_for_service?: boolean;
}

export class SetBotConnectionsDto {
    @ApiProperty({ type: [BotConnectionDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => BotConnectionDto) connections: BotConnectionDto[];
}

export class SetBotSkillsDto {
    @ApiProperty({ isArray: true }) @IsArray() @IsUUID('all', { each: true }) skill_ids: string[];
}

export class UpdateMemoryDto {
    @ApiProperty() @IsString() @MinLength(1) @MaxLength(2000) content: string;
}
