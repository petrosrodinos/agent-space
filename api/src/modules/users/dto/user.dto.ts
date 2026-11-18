import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
    ActivityStepsDisplay, AppLanguage, ApprovalChannel, ApprovalLevel, ApprovalTimeout, ArtifactOpenMode, ArtifactSharingLevel,
    AutomationResultsDestination, ClarifyingQuestions, ColorTheme, ConversationRetention, EmojiUsage, GroupReplyMode, LayoutDensity, ReadAloudMode,
    ReplyFormatting, ReplyLanguage, ReplyLength, ReplyTone, SendWithKey, SpeakingSpeed, TaskCheckIn, TextSize, Theme, TimeFormat, VoiceInputMode,
} from 'generated/prisma';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateProfileDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) job_title?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) about_me?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) timezone?: string;
    @ApiPropertyOptional({ example: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' } }) @IsOptional() @IsObject() working_hours?: Record<string, unknown> | null;
    @ApiPropertyOptional() @IsOptional() @IsString() avatar_file_id?: string | null;
}

/** §13.2 personal settings (Security is excluded — it has its own endpoints). */
export class UpdateUserSettingsDto {
    @ApiPropertyOptional({ enum: Theme }) @IsOptional() @IsEnum(Theme) theme?: Theme;
    @ApiPropertyOptional({ enum: TextSize }) @IsOptional() @IsEnum(TextSize) text_size?: TextSize;
    @ApiPropertyOptional({ enum: LayoutDensity }) @IsOptional() @IsEnum(LayoutDensity) layout_density?: LayoutDensity;
    @ApiPropertyOptional({ enum: AppLanguage }) @IsOptional() @IsEnum(AppLanguage) app_language?: AppLanguage;
    @ApiPropertyOptional({ enum: ReplyLanguage }) @IsOptional() @IsEnum(ReplyLanguage) reply_language?: ReplyLanguage;
    @ApiPropertyOptional({ enum: TimeFormat }) @IsOptional() @IsEnum(TimeFormat) time_format?: TimeFormat;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8) currency?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsIn(['metric', 'imperial', null]) units?: string | null;
    @ApiPropertyOptional({ enum: ReplyLength }) @IsOptional() @IsEnum(ReplyLength) reply_length?: ReplyLength;
    @ApiPropertyOptional({ enum: ReplyTone }) @IsOptional() @IsEnum(ReplyTone) reply_tone?: ReplyTone;
    @ApiPropertyOptional({ enum: ReplyFormatting }) @IsOptional() @IsEnum(ReplyFormatting) reply_formatting?: ReplyFormatting;
    @ApiPropertyOptional({ enum: EmojiUsage }) @IsOptional() @IsEnum(EmojiUsage) emoji_usage?: EmojiUsage;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() show_sources?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() suggested_follow_ups?: boolean;
    @ApiPropertyOptional({ enum: ClarifyingQuestions }) @IsOptional() @IsEnum(ClarifyingQuestions) clarifying_questions?: ClarifyingQuestions;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() proactive_suggestions?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() suggest_skills?: boolean;
    @ApiPropertyOptional({ enum: ActivityStepsDisplay }) @IsOptional() @IsEnum(ActivityStepsDisplay) activity_steps_display?: ActivityStepsDisplay;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() interactive_replies?: boolean;
    @ApiPropertyOptional({ enum: ArtifactSharingLevel }) @IsOptional() @IsIn(['PRIVATE', 'ORGANIZATION']) artifact_default_sharing?: ArtifactSharingLevel;
    @ApiPropertyOptional({ enum: ArtifactOpenMode }) @IsOptional() @IsEnum(ArtifactOpenMode) artifact_open_mode?: ArtifactOpenMode;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() artifact_notify_changes?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsString() default_bot_id?: string | null;
    @ApiPropertyOptional({ enum: SendWithKey }) @IsOptional() @IsEnum(SendWithKey) send_with?: SendWithKey;
    @ApiPropertyOptional({ enum: GroupReplyMode }) @IsOptional() @IsEnum(GroupReplyMode) group_reply_mode?: GroupReplyMode;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() show_typing_indicators?: boolean;
    @ApiPropertyOptional({ enum: ReadAloudMode }) @IsOptional() @IsEnum(ReadAloudMode) read_aloud?: ReadAloudMode;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) voice_override?: string | null;
    @ApiPropertyOptional({ enum: SpeakingSpeed }) @IsOptional() @IsEnum(SpeakingSpeed) speaking_speed?: SpeakingSpeed;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() auto_send_voice_note?: boolean;
    @ApiPropertyOptional({ enum: VoiceInputMode }) @IsOptional() @IsEnum(VoiceInputMode) voice_input_mode?: VoiceInputMode;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() keep_spoken_messages?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() memory_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() use_past_conversations?: boolean;
    @ApiPropertyOptional({ enum: ApprovalLevel }) @IsOptional() @IsEnum(ApprovalLevel) default_approval_level?: ApprovalLevel;
    @ApiPropertyOptional({ enum: ApprovalTimeout }) @IsOptional() @IsEnum(ApprovalTimeout) approval_timeout?: ApprovalTimeout;
    @ApiPropertyOptional({ enum: ApprovalChannel }) @IsOptional() @IsEnum(ApprovalChannel) approval_channel?: ApprovalChannel;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() auto_open_live_view?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() notify_take_control?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() keep_replays?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() connection_problem_alerts?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() secret_problem_alerts?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() notify_task_finished?: boolean;
    @ApiPropertyOptional({ enum: TaskCheckIn }) @IsOptional() @IsEnum(TaskCheckIn) task_check_in?: TaskCheckIn;
    @ApiPropertyOptional({ enum: AutomationResultsDestination }) @IsOptional() @IsEnum(AutomationResultsDestination) automation_results_to?: AutomationResultsDestination;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() daily_briefing_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @Matches(HHMM) daily_briefing_time?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() quiet_hours_enabled?: boolean;
    @ApiPropertyOptional() @IsOptional() @Matches(HHMM) quiet_hours_start?: string | null;
    @ApiPropertyOptional() @IsOptional() @Matches(HHMM) quiet_hours_end?: string | null;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() daily_email_digest?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() sounds_enabled?: boolean;
    @ApiPropertyOptional({ enum: ConversationRetention }) @IsOptional() @IsEnum(ConversationRetention) auto_delete_conversations?: ConversationRetention;
}

/** Colour theme for the selected organisation (stored per user per organisation). */
export class UpdateColorThemeDto {
    @ApiProperty({ enum: ColorTheme }) @IsEnum(ColorTheme) color_theme: ColorTheme;
}

export class DeleteAccountDto {
    @ApiProperty() @IsString() password: string;
}

export class HeartbeatDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) app_version?: string;
    @ApiPropertyOptional() @IsOptional() @IsString({ each: true }) capabilities?: string[];
}
