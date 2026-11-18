-- CreateEnum
CREATE TYPE "AuthRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'MICROSOFT', 'APPLE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LOGO', 'BANNER', 'IMAGE', 'VIDEO', 'AUDIO', 'PDF', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('WEB', 'DESKTOP', 'IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "PushProvider" AS ENUM ('WEBPUSH', 'APNS', 'FCM');

-- CreateEnum
CREATE TYPE "DeviceToolKind" AS ENUM ('LOCAL_FILES', 'SCREEN', 'LOCAL_TOOL_SERVERS', 'CLIPBOARD', 'OPEN', 'CAMERA_SCANNER', 'CONTACTS', 'SEND_VIA_APPS', 'DEVICE_CALENDAR', 'LOCATION');

-- CreateEnum
CREATE TYPE "DeviceToolPermission" AS ENUM ('ASK_EACH_TIME', 'ALWAYS_ALLOW', 'NEVER');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "TextSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "LayoutDensity" AS ENUM ('COMFORTABLE', 'COMPACT');

-- CreateEnum
CREATE TYPE "AppLanguage" AS ENUM ('EN', 'EL');

-- CreateEnum
CREATE TYPE "ReplyLanguage" AS ENUM ('SAME_AS_MESSAGE', 'ALWAYS_EN', 'ALWAYS_EL');

-- CreateEnum
CREATE TYPE "TimeFormat" AS ENUM ('REGION', 'H24', 'H12');

-- CreateEnum
CREATE TYPE "ReplyLength" AS ENUM ('SHORT', 'BALANCED', 'DETAILED');

-- CreateEnum
CREATE TYPE "ReplyTone" AS ENUM ('CASUAL', 'FRIENDLY_PROFESSIONAL', 'FORMAL');

-- CreateEnum
CREATE TYPE "ReplyFormatting" AS ENUM ('MIXED', 'MOSTLY_BULLETS', 'MOSTLY_PARAGRAPHS');

-- CreateEnum
CREATE TYPE "EmojiUsage" AS ENUM ('NONE', 'OCCASIONALLY', 'OFTEN');

-- CreateEnum
CREATE TYPE "ClarifyingQuestions" AS ENUM ('ASK_MORE_OFTEN', 'BALANCED', 'ASSUME_AND_PROCEED');

-- CreateEnum
CREATE TYPE "ActivityStepsDisplay" AS ENUM ('COLLAPSED', 'EXPANDED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ArtifactOpenMode" AS ENUM ('SIDE_PANEL', 'FULL_SCREEN', 'NEW_TAB');

-- CreateEnum
CREATE TYPE "SendWithKey" AS ENUM ('ENTER', 'CTRL_ENTER');

-- CreateEnum
CREATE TYPE "GroupReplyMode" AS ENUM ('MOST_RELEVANT', 'ONLY_WHEN_MENTIONED');

-- CreateEnum
CREATE TYPE "ReadAloudMode" AS ENUM ('OFF', 'VOICE_MESSAGES_ONLY', 'ALWAYS');

-- CreateEnum
CREATE TYPE "SpeakingSpeed" AS ENUM ('SLOWER', 'NORMAL', 'FASTER');

-- CreateEnum
CREATE TYPE "VoiceInputMode" AS ENUM ('HANDS_FREE', 'PUSH_TO_TALK');

-- CreateEnum
CREATE TYPE "ApprovalLevel" AS ENUM ('ALWAYS_ASK', 'IMPORTANT_ACTIONS', 'DONT_ASK');

-- CreateEnum
CREATE TYPE "ApprovalTimeout" AS ENUM ('KEEP_WAITING', 'CANCEL_AFTER_1H', 'CANCEL_AFTER_24H');

-- CreateEnum
CREATE TYPE "ApprovalChannel" AS ENUM ('IN_APP_PUSH', 'IN_APP_PUSH_EMAIL');

-- CreateEnum
CREATE TYPE "TaskCheckIn" AS ENUM ('MIN_15', 'HOUR_1', 'HOUR_4', 'NEVER');

-- CreateEnum
CREATE TYPE "AutomationResultsDestination" AS ENUM ('BOT_CONVERSATION', 'EMAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "ConversationRetention" AS ENUM ('NEVER', 'DAYS_30', 'DAYS_90', 'YEAR_1');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvitationExpiry" AS ENUM ('DAY_1', 'DAY_3', 'DAY_7', 'DAY_30');

-- CreateEnum
CREATE TYPE "WhoCan" AS ENUM ('EVERYONE', 'OWNERS_ADMINS');

-- CreateEnum
CREATE TYPE "ModelPolicy" AS ENUM ('ALL_MODELS', 'APPROVED_LIST');

-- CreateEnum
CREATE TYPE "ServicePolicy" AS ENUM ('ALL', 'APPROVED_LIST', 'BLOCK_LIST');

-- CreateEnum
CREATE TYPE "InteractiveRepliesMode" AS ENUM ('BLOCKS_AND_MINI_APPS', 'BLOCKS_ONLY', 'OFF');

-- CreateEnum
CREATE TYPE "IdlePause" AS ENUM ('MIN_5', 'MIN_15', 'MIN_30');

-- CreateEnum
CREATE TYPE "MaxSession" AS ENUM ('HOUR_1', 'HOUR_4', 'HOUR_24');

-- CreateEnum
CREATE TYPE "MinApprovalLevel" AS ENUM ('NONE', 'IMPORTANT_ACTIONS', 'ALWAYS_ASK');

-- CreateEnum
CREATE TYPE "PublicLinkPolicy" AS ENUM ('EVERYONE', 'OWNERS_ADMINS', 'OFF');

-- CreateEnum
CREATE TYPE "PublicLinkLifetime" AS ENUM ('NO_LIMIT', 'DAYS_7', 'DAYS_30', 'DAYS_90');

-- CreateEnum
CREATE TYPE "ArtifactDesignDefault" AS ENUM ('ORGANIZATION_BRAND', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "VoiceSessionLength" AS ENUM ('MIN_15', 'MIN_30', 'MIN_60');

-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('EVERY_15_MIN', 'EVERY_HOUR', 'DAILY');

-- CreateEnum
CREATE TYPE "LimitReachedAction" AS ENUM ('PAUSE_AND_NOTIFY', 'SWITCH_TO_CHEAPER_MODEL', 'NOTIFY_ONLY');

-- CreateEnum
CREATE TYPE "OrgConversationRetention" AS ENUM ('FOREVER', 'YEAR_1', 'DAYS_90', 'DAYS_30');

-- CreateEnum
CREATE TYPE "ComputerRetention" AS ENUM ('DAYS_30', 'DAYS_90', 'YEAR_1');

-- CreateEnum
CREATE TYPE "MaxFileSize" AS ENUM ('MB_25', 'MB_50', 'MB_100');

-- CreateEnum
CREATE TYPE "SessionInactivity" AS ENUM ('DAYS_30', 'DAYS_7', 'DAY_1');

-- CreateEnum
CREATE TYPE "BiometricApprovalScope" AS ENUM ('ALL_APPROVALS', 'EXTERNAL_EMAILS', 'DELETING_DATA');

-- CreateEnum
CREATE TYPE "BotVisibility" AS ENUM ('PRIVATE', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "BotEditPolicy" AS ENUM ('CREATOR_ONLY', 'CREATOR_AND_ADMINS');

-- CreateEnum
CREATE TYPE "Creativity" AS ENUM ('PRECISE', 'BALANCED', 'CREATIVE');

-- CreateEnum
CREATE TYPE "BotClarifyingQuestions" AS ENUM ('USER_PREFERENCE', 'ASK_MORE_OFTEN', 'ASSUME_AND_PROCEED');

-- CreateEnum
CREATE TYPE "BotGroupResponse" AS ENUM ('WHEN_RELEVANT_OR_MENTIONED', 'ONLY_WHEN_MENTIONED');

-- CreateEnum
CREATE TYPE "SpokenReplyStyle" AS ENUM ('SHORT_CONVERSATIONAL', 'DETAILED');

-- CreateEnum
CREATE TYPE "MemoryScope" AS ENUM ('PER_USER', 'SHARED');

-- CreateEnum
CREATE TYPE "MaxTaskDuration" AS ENUM ('MIN_15', 'HOUR_1', 'HOUR_4', 'HOUR_24');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('SEND_MESSAGE', 'POST_PUBLICLY', 'EDIT_RECORDS', 'DELETE_DATA', 'PURCHASE_PAYMENT', 'SHARE_FILES', 'ENTER_PASSWORD', 'EXTERNAL_EMAIL', 'CONSULT_SENSITIVE_BOT', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalOverride" AS ENUM ('ALWAYS_ASK', 'DONT_ASK');

-- CreateEnum
CREATE TYPE "KnowledgeScope" AS ENUM ('BOT', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "KnowledgeKind" AS ENUM ('FILE', 'LINK', 'TEXT');

-- CreateEnum
CREATE TYPE "MemoryKind" AS ENUM ('BOT_USER', 'BOT_SHARED', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "ModelCostTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'SHARED_BOT', 'GROUP');

-- CreateEnum
CREATE TYPE "MessageAuthorType" AS ENUM ('USER', 'BOT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageSource" AS ENUM ('TEXT', 'VOICE', 'AUTOMATION', 'BOT');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED', 'STOPPED');

-- CreateEnum
CREATE TYPE "RunType" AS ENUM ('CHAT_REPLY', 'TASK', 'AUTOMATION_RUN', 'BOT_TO_BOT');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'WAITING_INPUT', 'WAITING_DEVICE', 'WAITING_COMPUTER', 'COMPLETED', 'FAILED', 'STOPPED');

-- CreateEnum
CREATE TYPE "RunStepType" AS ENUM ('THINKING', 'TOOL_CALL', 'CONNECTION_CALL', 'COMPUTER_ACTION', 'DEVICE_TOOL', 'SKILL_USED', 'BOT_CONSULTED', 'FILE_WRITE', 'ARTIFACT_EDIT', 'APPROVAL', 'MESSAGE', 'ERROR');

-- CreateEnum
CREATE TYPE "RunStepStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'EDITED_APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VoiceSessionEndReason" AS ENUM ('USER_EXIT', 'SILENCE', 'MAX_LENGTH', 'CONNECTION_LOST', 'USAGE_LIMIT', 'ERROR');

-- CreateEnum
CREATE TYPE "SharingLevel" AS ENUM ('PRIVATE', 'SPECIFIC_MEMBERS', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "SkillRole" AS ENUM ('OWNER', 'EDITOR', 'USER');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('WEB_APP', 'DASHBOARD', 'PAGE', 'DOCUMENT', 'PRESENTATION', 'DIAGRAM', 'FORM', 'TOOL', 'GAME', 'OTHER');

-- CreateEnum
CREATE TYPE "ArtifactSharingLevel" AS ENUM ('PRIVATE', 'SPECIFIC_MEMBERS', 'ORGANIZATION', 'PUBLIC_LINK');

-- CreateEnum
CREATE TYPE "ArtifactRole" AS ENUM ('OWNER', 'EDITOR', 'COMMENTER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ArtifactVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ArtifactReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'TAKEN_DOWN', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ConnectionKind" AS ENUM ('COMPOSIO', 'API_KEY', 'MCP');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_RECONNECTING', 'ERROR');

-- CreateEnum
CREATE TYPE "CredentialOwnerType" AS ENUM ('USER', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "CredentialKind" AS ENUM ('MCP_OAUTH', 'MCP_TOKEN', 'API_KEY');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'NOT_WORKING', 'EXPIRED', 'NEEDS_RECONNECTING');

-- CreateEnum
CREATE TYPE "CredentialEventType" AS ENUM ('CREATED', 'REPLACED', 'RENAMED', 'SHARED', 'MADE_PRIVATE', 'BOTS_CHANGED', 'TESTED', 'USED', 'DELETED');

-- CreateEnum
CREATE TYPE "ToolServerAuthKind" AS ENUM ('NONE', 'OAUTH', 'TOKEN');

-- CreateEnum
CREATE TYPE "ToolServerStatus" AS ENUM ('ACTIVE', 'NEEDS_RECONNECTING', 'ERROR');

-- CreateEnum
CREATE TYPE "ToolRunsOn" AS ENUM ('SERVER', 'DEVICE');

-- CreateEnum
CREATE TYPE "FileBucket" AS ENUM ('FILES', 'ARTIFACTS', 'REPLAYS', 'EXPORTS', 'PUBLIC');

-- CreateEnum
CREATE TYPE "FileArea" AS ENUM ('CHAT', 'GENERATED', 'KNOWLEDGE', 'SKILLS', 'COMPUTER', 'ARTIFACTS', 'REPLAYS', 'EXPORTS', 'AUTOMATIONS', 'PUBLIC');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "CloudComputerStatus" AS ENUM ('OFF', 'STARTING', 'RUNNING', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "ComputerSessionKind" AS ENUM ('BOT_RUN', 'USER_EXPLORE');

-- CreateEnum
CREATE TYPE "TransferDirection" AS ENUM ('TO_COMPUTER', 'FROM_COMPUTER');

-- CreateEnum
CREATE TYPE "TransferSourceKind" AS ENUM ('STORED_FILE', 'COMPOSIO', 'API_KEY_CONNECTION', 'PUBLIC_URL', 'CHAT', 'STORAGE', 'CONNECTED_SERVICE');

-- CreateEnum
CREATE TYPE "AutomationTriggerKind" AS ENUM ('SCHEDULE', 'COMPOSIO_TRIGGER', 'PLACE');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'STOPPED');

-- CreateEnum
CREATE TYPE "ResultDestinationKind" AS ENUM ('CONVERSATION', 'EMAIL', 'CONNECTION');

-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('NEW_MESSAGE', 'MENTION', 'APPROVAL_NEEDED', 'TASK_FINISHED', 'TASK_FAILED', 'CONNECTION_NEEDS_RECONNECTING', 'SECRET_NOT_WORKING', 'INVITATION_RECEIVED', 'AUTOMATION_RESULT', 'AUTOMATION_PAUSED', 'ARTIFACT_SHARED', 'ARTIFACT_COMMENT', 'ARTIFACT_EDITED', 'SKILL_SHARED', 'SKILL_CHANGED', 'TAKE_CONTROL_NEEDED', 'USAGE_LIMIT', 'MODEL_CHANGED', 'EXPORT_READY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('MODEL_TOKENS', 'COMPUTER_MINUTES', 'VOICE_MINUTES', 'STORAGE_BYTES', 'ARTIFACT_AI');

-- CreateEnum
CREATE TYPE "UsageLimitScope" AS ENUM ('ORGANIZATION', 'MEMBER', 'BOT');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'STARTER', 'TEAM', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'BOT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ExportKind" AS ENUM ('USER_DATA', 'ACTIVITY_HISTORY', 'SKILL');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "AuthRole" NOT NULL DEFAULT 'USER',
    "name" TEXT,
    "avatar_file_id" TEXT,
    "job_title" TEXT,
    "about_me" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "working_hours" JSONB,
    "email_verified_at" TIMESTAMP(3),
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "last_active_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "provider_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "refresh_token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "user_uuid" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'LOGO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "app_version" TEXT,
    "push_provider" "PushProvider",
    "push_token" TEXT,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allowed_folders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "launch_at_startup" BOOLEAN NOT NULL DEFAULT true,
    "quick_ask_shortcut" TEXT,
    "approve_from_lock_screen" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tool_settings" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "tool" "DeviceToolKind" NOT NULL,
    "permission" "DeviceToolPermission" NOT NULL DEFAULT 'ASK_EACH_TIME',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tool_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_tool_servers" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "args" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "env_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_tool_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_places" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_meters" INTEGER NOT NULL DEFAULT 150,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "theme" "Theme" NOT NULL DEFAULT 'SYSTEM',
    "text_size" "TextSize" NOT NULL DEFAULT 'MEDIUM',
    "layout_density" "LayoutDensity" NOT NULL DEFAULT 'COMFORTABLE',
    "app_language" "AppLanguage" NOT NULL DEFAULT 'EN',
    "reply_language" "ReplyLanguage" NOT NULL DEFAULT 'SAME_AS_MESSAGE',
    "time_format" "TimeFormat" NOT NULL DEFAULT 'REGION',
    "currency" TEXT,
    "units" TEXT,
    "reply_length" "ReplyLength" NOT NULL DEFAULT 'BALANCED',
    "reply_tone" "ReplyTone" NOT NULL DEFAULT 'FRIENDLY_PROFESSIONAL',
    "reply_formatting" "ReplyFormatting" NOT NULL DEFAULT 'MIXED',
    "emoji_usage" "EmojiUsage" NOT NULL DEFAULT 'OCCASIONALLY',
    "show_sources" BOOLEAN NOT NULL DEFAULT true,
    "suggested_follow_ups" BOOLEAN NOT NULL DEFAULT true,
    "clarifying_questions" "ClarifyingQuestions" NOT NULL DEFAULT 'BALANCED',
    "proactive_suggestions" BOOLEAN NOT NULL DEFAULT true,
    "suggest_skills" BOOLEAN NOT NULL DEFAULT true,
    "activity_steps_display" "ActivityStepsDisplay" NOT NULL DEFAULT 'COLLAPSED',
    "interactive_replies" BOOLEAN NOT NULL DEFAULT true,
    "artifact_default_sharing" "ArtifactSharingLevel" NOT NULL DEFAULT 'PRIVATE',
    "artifact_open_mode" "ArtifactOpenMode" NOT NULL DEFAULT 'SIDE_PANEL',
    "artifact_notify_changes" BOOLEAN NOT NULL DEFAULT true,
    "default_bot_id" TEXT,
    "send_with" "SendWithKey" NOT NULL DEFAULT 'ENTER',
    "group_reply_mode" "GroupReplyMode" NOT NULL DEFAULT 'MOST_RELEVANT',
    "show_typing_indicators" BOOLEAN NOT NULL DEFAULT true,
    "read_aloud" "ReadAloudMode" NOT NULL DEFAULT 'OFF',
    "voice_override" TEXT,
    "speaking_speed" "SpeakingSpeed" NOT NULL DEFAULT 'NORMAL',
    "auto_send_voice_note" BOOLEAN NOT NULL DEFAULT false,
    "voice_input_mode" "VoiceInputMode" NOT NULL DEFAULT 'HANDS_FREE',
    "keep_spoken_messages" BOOLEAN NOT NULL DEFAULT true,
    "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
    "use_past_conversations" BOOLEAN NOT NULL DEFAULT true,
    "default_approval_level" "ApprovalLevel" NOT NULL DEFAULT 'IMPORTANT_ACTIONS',
    "approval_timeout" "ApprovalTimeout" NOT NULL DEFAULT 'KEEP_WAITING',
    "approval_channel" "ApprovalChannel" NOT NULL DEFAULT 'IN_APP_PUSH',
    "auto_open_live_view" BOOLEAN NOT NULL DEFAULT false,
    "notify_take_control" BOOLEAN NOT NULL DEFAULT true,
    "keep_replays" BOOLEAN NOT NULL DEFAULT true,
    "connection_problem_alerts" BOOLEAN NOT NULL DEFAULT true,
    "secret_problem_alerts" BOOLEAN NOT NULL DEFAULT true,
    "notify_task_finished" BOOLEAN NOT NULL DEFAULT true,
    "task_check_in" "TaskCheckIn" NOT NULL DEFAULT 'HOUR_1',
    "automation_results_to" "AutomationResultsDestination" NOT NULL DEFAULT 'BOT_CONVERSATION',
    "daily_briefing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "daily_briefing_time" TEXT,
    "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "daily_email_digest" BOOLEAN NOT NULL DEFAULT false,
    "sounds_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_delete_conversations" "ConversationRetention" NOT NULL DEFAULT 'NEVER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP', 'PUSH']::"NotificationChannel"[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_service_defaults" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "service_key" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_service_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_file_id" TEXT,
    "brand_color" TEXT,
    "is_personal" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "stripe_customer_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "purge_after" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "default_language" "AppLanguage" NOT NULL DEFAULT 'EN',
    "default_timezone" TEXT NOT NULL DEFAULT 'UTC',
    "default_working_hours" JSONB,
    "invite_links_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_invite_role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "auto_join_domain" TEXT,
    "invitation_expiry" "InvitationExpiry" NOT NULL DEFAULT 'DAY_7',
    "company_instructions" TEXT,
    "who_can_create_bots" "WhoCan" NOT NULL DEFAULT 'EVERYONE',
    "max_bots_per_member" INTEGER,
    "default_model_id" TEXT,
    "model_policy" "ModelPolicy" NOT NULL DEFAULT 'ALL_MODELS',
    "model_auto_fallback" BOOLEAN NOT NULL DEFAULT true,
    "model_compare_enabled" BOOLEAN NOT NULL DEFAULT true,
    "service_policy" "ServicePolicy" NOT NULL DEFAULT 'ALL',
    "service_list" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "members_private_tool_servers" BOOLEAN NOT NULL DEFAULT true,
    "members_api_key_connections" BOOLEAN NOT NULL DEFAULT true,
    "builtin_web_search" BOOLEAN NOT NULL DEFAULT true,
    "builtin_image_generation" BOOLEAN NOT NULL DEFAULT true,
    "builtin_document_creation" BOOLEAN NOT NULL DEFAULT true,
    "interactive_replies_mode" "InteractiveRepliesMode" NOT NULL DEFAULT 'BLOCKS_AND_MINI_APPS',
    "device_tools_enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowed_device_tools" "DeviceToolKind"[] DEFAULT ARRAY['LOCAL_FILES', 'SCREEN', 'LOCAL_TOOL_SERVERS', 'CLIPBOARD', 'OPEN', 'CAMERA_SCANNER', 'CONTACTS', 'SEND_VIA_APPS', 'DEVICE_CALENDAR', 'LOCATION']::"DeviceToolKind"[],
    "members_local_tool_servers" BOOLEAN NOT NULL DEFAULT true,
    "automations_desktop_tools" BOOLEAN NOT NULL DEFAULT true,
    "biometric_approval_scopes" "BiometricApprovalScope"[] DEFAULT ARRAY[]::"BiometricApprovalScope"[],
    "cloud_computers_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cloud_computers_who" "WhoCan" NOT NULL DEFAULT 'EVERYONE',
    "computer_idle_pause" "IdlePause" NOT NULL DEFAULT 'MIN_15',
    "computer_max_session" "MaxSession" NOT NULL DEFAULT 'HOUR_4',
    "computer_storage_limit_bytes" BIGINT,
    "members_take_control" BOOLEAN NOT NULL DEFAULT true,
    "record_replays" BOOLEAN NOT NULL DEFAULT true,
    "blocked_websites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "min_approval_level" "MinApprovalLevel" NOT NULL DEFAULT 'NONE',
    "enforced_approvals" "ActionType"[] DEFAULT ARRAY['EXTERNAL_EMAIL', 'PURCHASE_PAYMENT']::"ActionType"[],
    "bots_consulting_enabled" BOOLEAN NOT NULL DEFAULT true,
    "approval_timeout_minutes" INTEGER,
    "who_can_create_skills" "WhoCan" NOT NULL DEFAULT 'EVERYONE',
    "starter_skills_enabled" BOOLEAN NOT NULL DEFAULT true,
    "skill_import_enabled" BOOLEAN NOT NULL DEFAULT true,
    "artifacts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "public_link_policy" "PublicLinkPolicy" NOT NULL DEFAULT 'EVERYONE',
    "public_link_require_password" BOOLEAN NOT NULL DEFAULT false,
    "public_link_max_lifetime" "PublicLinkLifetime" NOT NULL DEFAULT 'NO_LIMIT',
    "public_artifact_ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "public_artifact_uploads" BOOLEAN NOT NULL DEFAULT true,
    "artifact_embedding_enabled" BOOLEAN NOT NULL DEFAULT true,
    "artifact_design_default" "ArtifactDesignDefault" NOT NULL DEFAULT 'ORGANIZATION_BRAND',
    "voice_mode_enabled" BOOLEAN NOT NULL DEFAULT true,
    "voice_mode_who" "WhoCan" NOT NULL DEFAULT 'EVERYONE',
    "voice_max_session" "VoiceSessionLength" NOT NULL DEFAULT 'MIN_30',
    "voice_approvals_enabled" BOOLEAN NOT NULL DEFAULT true,
    "voice_keep_transcripts" BOOLEAN NOT NULL DEFAULT true,
    "automations_enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_automations_per_member" INTEGER,
    "automations_cloud_computer" BOOLEAN NOT NULL DEFAULT true,
    "automation_pre_approvals" BOOLEAN NOT NULL DEFAULT true,
    "max_schedule_frequency" "ScheduleFrequency" NOT NULL DEFAULT 'EVERY_HOUR',
    "usage_alert_thresholds" INTEGER[] DEFAULT ARRAY[80, 100]::INTEGER[],
    "limit_reached_action" "LimitReachedAction" NOT NULL DEFAULT 'PAUSE_AND_NOTIFY',
    "conversation_retention" "OrgConversationRetention" NOT NULL DEFAULT 'FOREVER',
    "computer_retention" "ComputerRetention" NOT NULL DEFAULT 'DAYS_90',
    "max_file_size" "MaxFileSize" NOT NULL DEFAULT 'MB_100',
    "members_may_export" BOOLEAN NOT NULL DEFAULT true,
    "temporary_chats_allowed" BOOLEAN NOT NULL DEFAULT true,
    "require_two_factor" BOOLEAN NOT NULL DEFAULT false,
    "allowed_sign_in_methods" "AuthProvider"[] DEFAULT ARRAY['EMAIL', 'GOOGLE', 'MICROSOFT', 'APPLE']::"AuthProvider"[],
    "session_inactivity" "SessionInactivity" NOT NULL DEFAULT 'DAYS_30',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT,
    "token_hash" TEXT NOT NULL,
    "is_link" BOOLEAN NOT NULL DEFAULT false,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_id" TEXT,
    "accepted_by_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "openrouter_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cost_tier" "ModelCostTier" NOT NULL DEFAULT 'MEDIUM',
    "input_price_per_m" DECIMAL(12,6),
    "output_price_per_m" DECIMAL(12,6),
    "context_length" INTEGER,
    "supports_vision" BOOLEAN NOT NULL DEFAULT false,
    "supports_tools" BOOLEAN NOT NULL DEFAULT true,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "fallback_model_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_allowed_models" (
    "organization_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_allowed_models_pkey" PRIMARY KEY ("organization_id","model_id")
);

-- CreateTable
CREATE TABLE "bot_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "welcome_message" TEXT,
    "conversation_starters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggested_services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "model_id" TEXT,
    "voice" TEXT,
    "approval_level" "ApprovalLevel" NOT NULL DEFAULT 'IMPORTANT_ACTIONS',
    "cloud_computer" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_template_skills" (
    "template_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,

    CONSTRAINT "bot_template_skills_pkey" PRIMARY KEY ("template_id","skill_id")
);

-- CreateTable
CREATE TABLE "organization_templates" (
    "organization_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "organization_templates_pkey" PRIMARY KEY ("organization_id","template_id")
);

-- CreateTable
CREATE TABLE "bots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "template_id" TEXT,
    "duplicated_from_id" TEXT,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🤖',
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "description" TEXT,
    "image_file_id" TEXT,
    "welcome_message" TEXT,
    "conversation_starters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "instructions" TEXT NOT NULL,
    "model_id" TEXT,
    "creativity" "Creativity" NOT NULL DEFAULT 'BALANCED',
    "style_override" BOOLEAN NOT NULL DEFAULT false,
    "reply_length" "ReplyLength",
    "reply_tone" "ReplyTone",
    "reply_formatting" "ReplyFormatting",
    "emoji_usage" "EmojiUsage",
    "lock_style" BOOLEAN NOT NULL DEFAULT false,
    "reply_language" "AppLanguage",
    "clarifying_questions" "BotClarifyingQuestions" NOT NULL DEFAULT 'USER_PREFERENCE',
    "group_response" "BotGroupResponse" NOT NULL DEFAULT 'WHEN_RELEVANT_OR_MENTIONED',
    "web_search_enabled" BOOLEAN NOT NULL DEFAULT true,
    "image_generation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "document_creation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "interactive_replies_mode" "InteractiveRepliesMode" NOT NULL DEFAULT 'BLOCKS_AND_MINI_APPS',
    "artifacts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cloud_computer_enabled" BOOLEAN NOT NULL DEFAULT false,
    "use_skills_automatically" BOOLEAN NOT NULL DEFAULT true,
    "org_knowledge_enabled" BOOLEAN NOT NULL DEFAULT true,
    "voice_mode_enabled" BOOLEAN NOT NULL DEFAULT true,
    "voice" TEXT,
    "spoken_reply_style" "SpokenReplyStyle" NOT NULL DEFAULT 'SHORT_CONVERSATIONAL',
    "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
    "memory_scope" "MemoryScope" NOT NULL DEFAULT 'PER_USER',
    "can_ask_other_bots" BOOLEAN NOT NULL DEFAULT true,
    "can_be_asked" BOOLEAN NOT NULL DEFAULT true,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "approval_level" "ApprovalLevel" NOT NULL DEFAULT 'IMPORTANT_ACTIONS',
    "max_task_duration" "MaxTaskDuration" NOT NULL DEFAULT 'HOUR_1',
    "monthly_usage_limit" DECIMAL(12,4),
    "visibility" "BotVisibility" NOT NULL DEFAULT 'PRIVATE',
    "edit_policy" "BotEditPolicy" NOT NULL DEFAULT 'CREATOR_ONLY',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_approval_rules" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "override" "ApprovalOverride" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_connections" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "is_default_for_service" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_tool_servers" (
    "bot_id" TEXT NOT NULL,
    "tool_server_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_tool_servers_pkey" PRIMARY KEY ("bot_id","tool_server_id")
);

-- CreateTable
CREATE TABLE "bot_credentials" (
    "bot_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_credentials_pkey" PRIMARY KEY ("bot_id","credential_id")
);

-- CreateTable
CREATE TABLE "bot_skills" (
    "bot_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_skills_pkey" PRIMARY KEY ("bot_id","skill_id")
);

-- CreateTable
CREATE TABLE "knowledge_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope" "KnowledgeScope" NOT NULL,
    "bot_id" TEXT,
    "kind" "KnowledgeKind" NOT NULL,
    "title" TEXT NOT NULL,
    "file_id" TEXT,
    "url" TEXT,
    "content" TEXT,
    "added_by_id" TEXT,
    "indexed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_links" (
    "id" TEXT NOT NULL,
    "knowledge_item_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "fetched_at" TIMESTAMP(3),
    "fetched_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "MemoryKind" NOT NULL,
    "bot_id" TEXT,
    "user_id" TEXT,
    "content" TEXT NOT NULL,
    "source_conversation_id" TEXT,
    "source_message_id" TEXT,
    "last_recalled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_folders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL,
    "name" TEXT,
    "emoji" TEXT,
    "color" TEXT,
    "lead_bot_id" TEXT,
    "created_by_id" TEXT,
    "is_temporary" BOOLEAN NOT NULL DEFAULT false,
    "last_message_at" TIMESTAMP(3),
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT,
    "bot_id" TEXT,
    "folder_id" TEXT,
    "is_favourite" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "last_read_at" TIMESTAMP(3),
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "author_type" "MessageAuthorType" NOT NULL,
    "author_user_id" TEXT,
    "author_bot_id" TEXT,
    "source" "MessageSource" NOT NULL DEFAULT 'TEXT',
    "status" "MessageStatus" NOT NULL DEFAULT 'COMPLETED',
    "content" TEXT,
    "parts" JSONB,
    "run_id" TEXT,
    "parent_message_id" TEXT,
    "branch_from_message_id" TEXT,
    "branch_index" INTEGER NOT NULL DEFAULT 0,
    "model_id" TEXT,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_by_id" TEXT,
    "pinned_at" TIMESTAMP(3),
    "edited_at" TIMESTAMP(3),
    "secret_masked" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_files" (
    "message_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "message_files_pkey" PRIMARY KEY ("message_id","file_id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_mentions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT,
    "bot_id" TEXT,
    "skill_id" TEXT,

    CONSTRAINT "message_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactive_responses" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactive_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_widgets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "source_message_id" TEXT,
    "title" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "refresh_prompt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "bot_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" "RunType" NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "title" TEXT,
    "trigger_message_id" TEXT,
    "parent_run_id" TEXT,
    "requested_by_bot_id" TEXT,
    "automation_run_id" TEXT,
    "voice_session_id" TEXT,
    "model_id" TEXT,
    "fallback_used" BOOLEAN NOT NULL DEFAULT false,
    "skill_id" TEXT,
    "uses_computer" BOOLEAN NOT NULL DEFAULT false,
    "state" JSONB,
    "error" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3),
    "last_check_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_steps" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "RunStepType" NOT NULL,
    "status" "RunStepStatus" NOT NULL DEFAULT 'RUNNING',
    "title" TEXT NOT NULL,
    "tool_name" TEXT,
    "runs_on" "ToolRunsOn" NOT NULL DEFAULT 'SERVER',
    "connection_id" TEXT,
    "device_id" TEXT,
    "skill_id" TEXT,
    "consulted_bot_id" TEXT,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,

    CONSTRAINT "run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "message_id" TEXT,
    "bot_id" TEXT NOT NULL,
    "requested_from_id" TEXT,
    "action_type" "ActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "preview" JSONB NOT NULL,
    "tool_call_id" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "is_urgent" BOOLEAN NOT NULL DEFAULT false,
    "requires_tap" BOOLEAN NOT NULL DEFAULT false,
    "requires_biometric" BOOLEAN NOT NULL DEFAULT false,
    "resolved_via_voice" BOOLEAN NOT NULL DEFAULT false,
    "edited_payload" JSONB,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "timeout_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "provider_session_id" TEXT,
    "input_mode" "VoiceInputMode" NOT NULL DEFAULT 'HANDS_FREE',
    "voice" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "end_reason" "VoiceSessionEndReason",
    "audio_seconds" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "owner_id" TEXT,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "required_tools" JSONB NOT NULL DEFAULT '[]',
    "result" TEXT,
    "sharing_level" "SharingLevel" NOT NULL DEFAULT 'PRIVATE',
    "is_starter" BOOLEAN NOT NULL DEFAULT false,
    "starter_key" TEXT,
    "imported_from" TEXT,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_versions" (
    "id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "required_tools" JSONB NOT NULL,
    "result" TEXT,
    "change_summary" TEXT,
    "created_by_id" TEXT,
    "restored_from_version" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_shares" (
    "id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "SkillRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_files" (
    "skill_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_files_pkey" PRIMARY KEY ("skill_id","file_id")
);

-- CreateTable
CREATE TABLE "organization_starter_skills" (
    "organization_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "organization_starter_skills_pkey" PRIMARY KEY ("organization_id","skill_id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "conversation_id" TEXT,
    "message_id" TEXT,
    "duplicated_from_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "sharing_level" "ArtifactSharingLevel" NOT NULL DEFAULT 'PRIVATE',
    "public_enabled" BOOLEAN NOT NULL DEFAULT false,
    "public_password_hash" TEXT,
    "public_expires_at" TIMESTAMP(3),
    "allow_search_engines" BOOLEAN NOT NULL DEFAULT false,
    "allow_embedding" BOOLEAN NOT NULL DEFAULT true,
    "public_ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "public_uploads_enabled" BOOLEAN NOT NULL DEFAULT true,
    "review_before_publish" BOOLEAN NOT NULL DEFAULT false,
    "current_version_id" TEXT,
    "draft_version_id" TEXT,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "is_pinned_by" JSONB,
    "taken_down_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_versions" (
    "id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ArtifactVersionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "label" TEXT,
    "change_summary" TEXT,
    "source" JSONB NOT NULL,
    "bundle_path" TEXT,
    "created_by_id" TEXT,
    "run_id" TEXT,
    "restored_from_version" INTEGER,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_shares" (
    "id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "user_id" TEXT,
    "role" "ArtifactRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_comments" (
    "id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "author_id" TEXT,
    "parent_comment_id" TEXT,
    "anchor" JSONB,
    "content" TEXT NOT NULL,
    "mentioned_bot_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifact_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_records" (
    "id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "submitted_by_id" TEXT,
    "visitor_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifact_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_reports" (
    "id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "reporter_id" TEXT,
    "reporter_email" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ArtifactReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "kind" "ConnectionKind" NOT NULL,
    "service_key" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "account_identifier" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "restricted_to_bots" BOOLEAN NOT NULL DEFAULT false,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "status_message" TEXT,
    "composio_connected_account_id" TEXT,
    "composio_auth_config_id" TEXT,
    "credential_id" TEXT,
    "tool_server_id" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_bot_restrictions" (
    "connection_id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_bot_restrictions_pkey" PRIMARY KEY ("connection_id","bot_id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_type" "CredentialOwnerType" NOT NULL DEFAULT 'USER',
    "owner_id" TEXT,
    "kind" "CredentialKind" NOT NULL,
    "label" TEXT NOT NULL,
    "service_key" TEXT,
    "service_name" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "masked_hint" TEXT,
    "expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "secret_resource_name" TEXT NOT NULL,
    "secret_version" TEXT,
    "last_tested_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "last_used_bot_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_events" (
    "id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "type" "CredentialEventType" NOT NULL,
    "actor_user_id" TEXT,
    "actor_bot_id" TEXT,
    "run_id" TEXT,
    "action" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_servers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "auth_kind" "ToolServerAuthKind" NOT NULL DEFAULT 'NONE',
    "credential_id" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "ToolServerStatus" NOT NULL DEFAULT 'ACTIVE',
    "status_message" TEXT,
    "tool_count" INTEGER NOT NULL DEFAULT 0,
    "last_listed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "uploaded_by_id" TEXT,
    "bucket" "FileBucket" NOT NULL,
    "area" "FileArea" NOT NULL,
    "object_path" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "checksum" TEXT,
    "conversation_id" TEXT,
    "bot_id" TEXT,
    "skill_id" TEXT,
    "artifact_id" TEXT,
    "automation_id" TEXT,
    "run_id" TEXT,
    "computer_session_id" TEXT,
    "is_public_upload" BOOLEAN NOT NULL DEFAULT false,
    "visitor_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "purge_after" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_computers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "daytona_sandbox_id" TEXT,
    "status" "CloudComputerStatus" NOT NULL DEFAULT 'OFF',
    "status_message" TEXT,
    "storage_used_bytes" BIGINT NOT NULL DEFAULT 0,
    "storage_limit_bytes" BIGINT,
    "last_active_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "session_started_at" TIMESTAMP(3),
    "total_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloud_computers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "computer_sessions" (
    "id" TEXT NOT NULL,
    "cloud_computer_id" TEXT NOT NULL,
    "kind" "ComputerSessionKind" NOT NULL,
    "run_id" TEXT,
    "user_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "replay_file_id" TEXT,
    "hidden_ranges" JSONB,
    "control_events" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "computer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signed_in_websites" (
    "id" TEXT NOT NULL,
    "cloud_computer_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "signed_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signed_in_websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "computer_transfers" (
    "id" TEXT NOT NULL,
    "cloud_computer_id" TEXT NOT NULL,
    "run_id" TEXT,
    "direction" "TransferDirection" NOT NULL,
    "source_kind" "TransferSourceKind" NOT NULL,
    "connection_id" TEXT,
    "file_id" TEXT,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL DEFAULT 0,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "computer_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "skill_id" TEXT,
    "trigger_kind" "AutomationTriggerKind" NOT NULL,
    "cron_expression" TEXT,
    "timezone" TEXT,
    "device_place_id" TEXT,
    "place_event" TEXT,
    "uses_cloud_computer" BOOLEAN NOT NULL DEFAULT false,
    "status" "AutomationStatus" NOT NULL DEFAULT 'ACTIVE',
    "status_reason" TEXT,
    "source_conversation_id" TEXT,
    "results_conversation_id" TEXT,
    "memory_notes" JSONB,
    "memory_plan" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "pre_approvals_confirmed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_connections" (
    "automation_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,

    CONSTRAINT "automation_connections_pkey" PRIMARY KEY ("automation_id","connection_id")
);

-- CreateTable
CREATE TABLE "automation_pre_approvals" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "connection_id" TEXT,
    "target" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_pre_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_result_destinations" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "kind" "ResultDestinationKind" NOT NULL,
    "conversation_id" TEXT,
    "email" TEXT,
    "connection_id" TEXT,
    "target" TEXT,

    CONSTRAINT "automation_result_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_trigger_subscriptions" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "trigger_key" TEXT NOT NULL,
    "composio_trigger_id" TEXT,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_trigger_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "is_retry" BOOLEAN NOT NULL DEFAULT false,
    "trigger_event_id" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "result_summary" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link_path" TEXT,
    "data" JSONB,
    "is_urgent" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "device_id" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "bot_id" TEXT,
    "model_id" TEXT,
    "artifact_id" TEXT,
    "run_id" TEXT,
    "kind" "UsageKind" NOT NULL,
    "period" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "cost" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_limits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope" "UsageLimitScope" NOT NULL,
    "user_id" TEXT,
    "bot_id" TEXT,
    "monthly_limit" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_alerts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope" "UsageLimitScope" NOT NULL,
    "user_id" TEXT,
    "bot_id" TEXT,
    "period" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stripe_invoice_id" TEXT NOT NULL,
    "number" TEXT,
    "status" "InvoiceStatus" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "amount_due" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "usage_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hosted_url" TEXT,
    "pdf_url" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_user_id" TEXT,
    "actor_bot_id" TEXT,
    "on_behalf_of_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "connection_id" TEXT,
    "run_id" TEXT,
    "device_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_exports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT NOT NULL,
    "kind" "ExportKind" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'QUEUED',
    "params" JSONB,
    "file_id" TEXT,
    "error" TEXT,
    "expires_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev_secret_blobs" (
    "resource_name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ciphertext" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dev_secret_blobs_pkey" PRIMARY KEY ("resource_name")
);

-- CreateTable
CREATE TABLE "app_version_policies" (
    "platform" "Platform" NOT NULL,
    "minimum_version" TEXT NOT NULL,
    "latest_version" TEXT,
    "update_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_version_policies_pkey" PRIMARY KEY ("platform")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_avatar_file_id_key" ON "users"("avatar_file_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_user_id_key" ON "auth_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_device_id_idx" ON "sessions"("device_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_uuid_idx" ON "password_reset_tokens"("user_uuid");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "documents_user_uuid_idx" ON "documents"("user_uuid");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "devices_push_token_idx" ON "devices"("push_token");

-- CreateIndex
CREATE UNIQUE INDEX "device_tool_settings_device_id_tool_key" ON "device_tool_settings"("device_id", "tool");

-- CreateIndex
CREATE INDEX "local_tool_servers_device_id_idx" ON "local_tool_servers"("device_id");

-- CreateIndex
CREATE INDEX "device_places_user_id_idx" ON "device_places"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "user_settings_default_bot_id_idx" ON "user_settings"("default_bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_event_key" ON "notification_preferences"("user_id", "event");

-- CreateIndex
CREATE INDEX "user_service_defaults_connection_id_idx" ON "user_service_defaults"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_service_defaults_user_id_organization_id_service_key_key" ON "user_service_defaults"("user_id", "organization_id", "service_key");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_logo_file_id_key" ON "organizations"("logo_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "organizations_created_by_id_idx" ON "organizations"("created_by_id");

-- CreateIndex
CREATE INDEX "organizations_deleted_at_idx" ON "organizations"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_organization_id_key" ON "organization_settings"("organization_id");

-- CreateIndex
CREATE INDEX "organization_settings_default_model_id_idx" ON "organization_settings"("default_model_id");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_organization_id_status_idx" ON "invitations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_invited_by_id_idx" ON "invitations"("invited_by_id");

-- CreateIndex
CREATE INDEX "invitations_accepted_by_id_idx" ON "invitations"("accepted_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_openrouter_id_key" ON "ai_models"("openrouter_id");

-- CreateIndex
CREATE INDEX "ai_models_fallback_model_id_idx" ON "ai_models"("fallback_model_id");

-- CreateIndex
CREATE INDEX "ai_models_is_available_is_recommended_idx" ON "ai_models"("is_available", "is_recommended");

-- CreateIndex
CREATE INDEX "organization_allowed_models_model_id_idx" ON "organization_allowed_models"("model_id");

-- CreateIndex
CREATE UNIQUE INDEX "bot_templates_key_key" ON "bot_templates"("key");

-- CreateIndex
CREATE INDEX "bot_templates_model_id_idx" ON "bot_templates"("model_id");

-- CreateIndex
CREATE INDEX "bot_template_skills_skill_id_idx" ON "bot_template_skills"("skill_id");

-- CreateIndex
CREATE INDEX "organization_templates_template_id_idx" ON "organization_templates"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "bots_image_file_id_key" ON "bots"("image_file_id");

-- CreateIndex
CREATE INDEX "bots_organization_id_visibility_idx" ON "bots"("organization_id", "visibility");

-- CreateIndex
CREATE INDEX "bots_created_by_id_idx" ON "bots"("created_by_id");

-- CreateIndex
CREATE INDEX "bots_template_id_idx" ON "bots"("template_id");

-- CreateIndex
CREATE INDEX "bots_model_id_idx" ON "bots"("model_id");

-- CreateIndex
CREATE INDEX "bots_duplicated_from_id_idx" ON "bots"("duplicated_from_id");

-- CreateIndex
CREATE INDEX "bots_deleted_at_idx" ON "bots"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "bot_approval_rules_bot_id_action_type_key" ON "bot_approval_rules"("bot_id", "action_type");

-- CreateIndex
CREATE INDEX "bot_connections_connection_id_idx" ON "bot_connections"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "bot_connections_bot_id_connection_id_key" ON "bot_connections"("bot_id", "connection_id");

-- CreateIndex
CREATE INDEX "bot_tool_servers_tool_server_id_idx" ON "bot_tool_servers"("tool_server_id");

-- CreateIndex
CREATE INDEX "bot_credentials_credential_id_idx" ON "bot_credentials"("credential_id");

-- CreateIndex
CREATE INDEX "bot_skills_skill_id_idx" ON "bot_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_items_file_id_key" ON "knowledge_items"("file_id");

-- CreateIndex
CREATE INDEX "knowledge_items_organization_id_scope_idx" ON "knowledge_items"("organization_id", "scope");

-- CreateIndex
CREATE INDEX "knowledge_items_bot_id_idx" ON "knowledge_items"("bot_id");

-- CreateIndex
CREATE INDEX "knowledge_items_added_by_id_idx" ON "knowledge_items"("added_by_id");

-- CreateIndex
CREATE INDEX "knowledge_links_knowledge_item_id_idx" ON "knowledge_links"("knowledge_item_id");

-- CreateIndex
CREATE INDEX "knowledge_links_fetched_by_id_idx" ON "knowledge_links"("fetched_by_id");

-- CreateIndex
CREATE INDEX "memories_organization_id_kind_idx" ON "memories"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "memories_bot_id_user_id_idx" ON "memories"("bot_id", "user_id");

-- CreateIndex
CREATE INDEX "memories_user_id_idx" ON "memories"("user_id");

-- CreateIndex
CREATE INDEX "memories_source_conversation_id_idx" ON "memories"("source_conversation_id");

-- CreateIndex
CREATE INDEX "conversation_folders_user_id_organization_id_idx" ON "conversation_folders"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "conversation_folders_organization_id_idx" ON "conversation_folders"("organization_id");

-- CreateIndex
CREATE INDEX "conversations_organization_id_type_idx" ON "conversations"("organization_id", "type");

-- CreateIndex
CREATE INDEX "conversations_lead_bot_id_idx" ON "conversations"("lead_bot_id");

-- CreateIndex
CREATE INDEX "conversations_created_by_id_idx" ON "conversations"("created_by_id");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "conversations_deleted_at_idx" ON "conversations"("deleted_at");

-- CreateIndex
CREATE INDEX "conversation_participants_user_id_is_archived_idx" ON "conversation_participants"("user_id", "is_archived");

-- CreateIndex
CREATE INDEX "conversation_participants_bot_id_idx" ON "conversation_participants"("bot_id");

-- CreateIndex
CREATE INDEX "conversation_participants_folder_id_idx" ON "conversation_participants"("folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_bot_id_key" ON "conversation_participants"("conversation_id", "bot_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_organization_id_idx" ON "messages"("organization_id");

-- CreateIndex
CREATE INDEX "messages_author_user_id_idx" ON "messages"("author_user_id");

-- CreateIndex
CREATE INDEX "messages_author_bot_id_idx" ON "messages"("author_bot_id");

-- CreateIndex
CREATE INDEX "messages_run_id_idx" ON "messages"("run_id");

-- CreateIndex
CREATE INDEX "messages_parent_message_id_idx" ON "messages"("parent_message_id");

-- CreateIndex
CREATE INDEX "messages_branch_from_message_id_idx" ON "messages"("branch_from_message_id");

-- CreateIndex
CREATE INDEX "messages_pinned_by_id_idx" ON "messages"("pinned_by_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_is_pinned_idx" ON "messages"("conversation_id", "is_pinned");

-- CreateIndex
CREATE INDEX "message_files_file_id_idx" ON "message_files"("file_id");

-- CreateIndex
CREATE INDEX "message_reactions_user_id_idx" ON "message_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_message_id_user_id_emoji_key" ON "message_reactions"("message_id", "user_id", "emoji");

-- CreateIndex
CREATE INDEX "message_mentions_message_id_idx" ON "message_mentions"("message_id");

-- CreateIndex
CREATE INDEX "message_mentions_user_id_idx" ON "message_mentions"("user_id");

-- CreateIndex
CREATE INDEX "message_mentions_bot_id_idx" ON "message_mentions"("bot_id");

-- CreateIndex
CREATE INDEX "message_mentions_skill_id_idx" ON "message_mentions"("skill_id");

-- CreateIndex
CREATE INDEX "interactive_responses_message_id_component_id_idx" ON "interactive_responses"("message_id", "component_id");

-- CreateIndex
CREATE INDEX "interactive_responses_user_id_idx" ON "interactive_responses"("user_id");

-- CreateIndex
CREATE INDEX "saved_widgets_user_id_organization_id_idx" ON "saved_widgets"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "saved_widgets_organization_id_idx" ON "saved_widgets"("organization_id");

-- CreateIndex
CREATE INDEX "saved_widgets_conversation_id_idx" ON "saved_widgets"("conversation_id");

-- CreateIndex
CREATE INDEX "saved_widgets_source_message_id_idx" ON "saved_widgets"("source_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "runs_automation_run_id_key" ON "runs"("automation_run_id");

-- CreateIndex
CREATE INDEX "runs_organization_id_status_idx" ON "runs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "runs_conversation_id_bot_id_status_idx" ON "runs"("conversation_id", "bot_id", "status");

-- CreateIndex
CREATE INDEX "runs_bot_id_idx" ON "runs"("bot_id");

-- CreateIndex
CREATE INDEX "runs_user_id_status_idx" ON "runs"("user_id", "status");

-- CreateIndex
CREATE INDEX "runs_trigger_message_id_idx" ON "runs"("trigger_message_id");

-- CreateIndex
CREATE INDEX "runs_parent_run_id_idx" ON "runs"("parent_run_id");

-- CreateIndex
CREATE INDEX "runs_requested_by_bot_id_idx" ON "runs"("requested_by_bot_id");

-- CreateIndex
CREATE INDEX "runs_voice_session_id_idx" ON "runs"("voice_session_id");

-- CreateIndex
CREATE INDEX "runs_model_id_idx" ON "runs"("model_id");

-- CreateIndex
CREATE INDEX "runs_skill_id_idx" ON "runs"("skill_id");

-- CreateIndex
CREATE INDEX "runs_type_status_idx" ON "runs"("type", "status");

-- CreateIndex
CREATE INDEX "run_steps_connection_id_idx" ON "run_steps"("connection_id");

-- CreateIndex
CREATE INDEX "run_steps_device_id_idx" ON "run_steps"("device_id");

-- CreateIndex
CREATE INDEX "run_steps_skill_id_idx" ON "run_steps"("skill_id");

-- CreateIndex
CREATE INDEX "run_steps_consulted_bot_id_idx" ON "run_steps"("consulted_bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "run_steps_run_id_sequence_key" ON "run_steps"("run_id", "sequence");

-- CreateIndex
CREATE INDEX "approvals_organization_id_status_idx" ON "approvals"("organization_id", "status");

-- CreateIndex
CREATE INDEX "approvals_run_id_idx" ON "approvals"("run_id");

-- CreateIndex
CREATE INDEX "approvals_conversation_id_idx" ON "approvals"("conversation_id");

-- CreateIndex
CREATE INDEX "approvals_message_id_idx" ON "approvals"("message_id");

-- CreateIndex
CREATE INDEX "approvals_bot_id_idx" ON "approvals"("bot_id");

-- CreateIndex
CREATE INDEX "approvals_requested_from_id_status_idx" ON "approvals"("requested_from_id", "status");

-- CreateIndex
CREATE INDEX "approvals_resolved_by_id_idx" ON "approvals"("resolved_by_id");

-- CreateIndex
CREATE INDEX "approvals_timeout_at_idx" ON "approvals"("timeout_at");

-- CreateIndex
CREATE INDEX "voice_sessions_organization_id_started_at_idx" ON "voice_sessions"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "voice_sessions_conversation_id_idx" ON "voice_sessions"("conversation_id");

-- CreateIndex
CREATE INDEX "voice_sessions_user_id_idx" ON "voice_sessions"("user_id");

-- CreateIndex
CREATE INDEX "voice_sessions_bot_id_idx" ON "voice_sessions"("bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_starter_key_key" ON "skills"("starter_key");

-- CreateIndex
CREATE INDEX "skills_organization_id_sharing_level_idx" ON "skills"("organization_id", "sharing_level");

-- CreateIndex
CREATE INDEX "skills_owner_id_idx" ON "skills"("owner_id");

-- CreateIndex
CREATE INDEX "skills_is_starter_idx" ON "skills"("is_starter");

-- CreateIndex
CREATE INDEX "skills_deleted_at_idx" ON "skills"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "skills_organization_id_slug_key" ON "skills"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "skill_versions_created_by_id_idx" ON "skill_versions"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_versions_skill_id_version_key" ON "skill_versions"("skill_id", "version");

-- CreateIndex
CREATE INDEX "skill_shares_user_id_idx" ON "skill_shares"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_shares_skill_id_user_id_key" ON "skill_shares"("skill_id", "user_id");

-- CreateIndex
CREATE INDEX "skill_files_file_id_idx" ON "skill_files"("file_id");

-- CreateIndex
CREATE INDEX "organization_starter_skills_skill_id_idx" ON "organization_starter_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "artifacts_current_version_id_key" ON "artifacts"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "artifacts_draft_version_id_key" ON "artifacts"("draft_version_id");

-- CreateIndex
CREATE INDEX "artifacts_organization_id_sharing_level_idx" ON "artifacts"("organization_id", "sharing_level");

-- CreateIndex
CREATE INDEX "artifacts_owner_id_idx" ON "artifacts"("owner_id");

-- CreateIndex
CREATE INDEX "artifacts_conversation_id_idx" ON "artifacts"("conversation_id");

-- CreateIndex
CREATE INDEX "artifacts_message_id_idx" ON "artifacts"("message_id");

-- CreateIndex
CREATE INDEX "artifacts_duplicated_from_id_idx" ON "artifacts"("duplicated_from_id");

-- CreateIndex
CREATE INDEX "artifacts_public_enabled_idx" ON "artifacts"("public_enabled");

-- CreateIndex
CREATE INDEX "artifacts_deleted_at_idx" ON "artifacts"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "artifacts_organization_id_slug_key" ON "artifacts"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "artifact_versions_created_by_id_idx" ON "artifact_versions"("created_by_id");

-- CreateIndex
CREATE INDEX "artifact_versions_run_id_idx" ON "artifact_versions"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_versions_artifact_id_version_key" ON "artifact_versions"("artifact_id", "version");

-- CreateIndex
CREATE INDEX "artifact_shares_user_id_idx" ON "artifact_shares"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_shares_artifact_id_user_id_key" ON "artifact_shares"("artifact_id", "user_id");

-- CreateIndex
CREATE INDEX "artifact_comments_artifact_id_created_at_idx" ON "artifact_comments"("artifact_id", "created_at");

-- CreateIndex
CREATE INDEX "artifact_comments_author_id_idx" ON "artifact_comments"("author_id");

-- CreateIndex
CREATE INDEX "artifact_comments_parent_comment_id_idx" ON "artifact_comments"("parent_comment_id");

-- CreateIndex
CREATE INDEX "artifact_comments_mentioned_bot_id_idx" ON "artifact_comments"("mentioned_bot_id");

-- CreateIndex
CREATE INDEX "artifact_records_artifact_id_collection_idx" ON "artifact_records"("artifact_id", "collection");

-- CreateIndex
CREATE INDEX "artifact_records_submitted_by_id_idx" ON "artifact_records"("submitted_by_id");

-- CreateIndex
CREATE INDEX "artifact_reports_artifact_id_status_idx" ON "artifact_reports"("artifact_id", "status");

-- CreateIndex
CREATE INDEX "artifact_reports_reporter_id_idx" ON "artifact_reports"("reporter_id");

-- CreateIndex
CREATE UNIQUE INDEX "connections_composio_connected_account_id_key" ON "connections"("composio_connected_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "connections_credential_id_key" ON "connections"("credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "connections_tool_server_id_key" ON "connections"("tool_server_id");

-- CreateIndex
CREATE INDEX "connections_organization_id_visibility_status_idx" ON "connections"("organization_id", "visibility", "status");

-- CreateIndex
CREATE INDEX "connections_owner_id_idx" ON "connections"("owner_id");

-- CreateIndex
CREATE INDEX "connections_service_key_idx" ON "connections"("service_key");

-- CreateIndex
CREATE INDEX "connections_deleted_at_idx" ON "connections"("deleted_at");

-- CreateIndex
CREATE INDEX "connection_bot_restrictions_bot_id_idx" ON "connection_bot_restrictions"("bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_secret_resource_name_key" ON "credentials"("secret_resource_name");

-- CreateIndex
CREATE INDEX "credentials_organization_id_visibility_status_idx" ON "credentials"("organization_id", "visibility", "status");

-- CreateIndex
CREATE INDEX "credentials_owner_id_idx" ON "credentials"("owner_id");

-- CreateIndex
CREATE INDEX "credentials_last_used_bot_id_idx" ON "credentials"("last_used_bot_id");

-- CreateIndex
CREATE INDEX "credentials_deleted_at_idx" ON "credentials"("deleted_at");

-- CreateIndex
CREATE INDEX "credential_events_credential_id_created_at_idx" ON "credential_events"("credential_id", "created_at");

-- CreateIndex
CREATE INDEX "credential_events_actor_user_id_idx" ON "credential_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "credential_events_actor_bot_id_idx" ON "credential_events"("actor_bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "tool_servers_credential_id_key" ON "tool_servers"("credential_id");

-- CreateIndex
CREATE INDEX "tool_servers_organization_id_visibility_idx" ON "tool_servers"("organization_id", "visibility");

-- CreateIndex
CREATE INDEX "tool_servers_owner_id_idx" ON "tool_servers"("owner_id");

-- CreateIndex
CREATE INDEX "tool_servers_deleted_at_idx" ON "tool_servers"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "files_object_path_key" ON "files"("object_path");

-- CreateIndex
CREATE INDEX "files_organization_id_area_idx" ON "files"("organization_id", "area");

-- CreateIndex
CREATE INDEX "files_uploaded_by_id_idx" ON "files"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "files_conversation_id_idx" ON "files"("conversation_id");

-- CreateIndex
CREATE INDEX "files_bot_id_idx" ON "files"("bot_id");

-- CreateIndex
CREATE INDEX "files_skill_id_idx" ON "files"("skill_id");

-- CreateIndex
CREATE INDEX "files_artifact_id_idx" ON "files"("artifact_id");

-- CreateIndex
CREATE INDEX "files_automation_id_idx" ON "files"("automation_id");

-- CreateIndex
CREATE INDEX "files_run_id_idx" ON "files"("run_id");

-- CreateIndex
CREATE INDEX "files_computer_session_id_idx" ON "files"("computer_session_id");

-- CreateIndex
CREATE INDEX "files_status_idx" ON "files"("status");

-- CreateIndex
CREATE INDEX "files_deleted_at_purge_after_idx" ON "files"("deleted_at", "purge_after");

-- CreateIndex
CREATE INDEX "files_expires_at_idx" ON "files"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_computers_bot_id_key" ON "cloud_computers"("bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_computers_daytona_sandbox_id_key" ON "cloud_computers"("daytona_sandbox_id");

-- CreateIndex
CREATE INDEX "cloud_computers_organization_id_status_idx" ON "cloud_computers"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "computer_sessions_replay_file_id_key" ON "computer_sessions"("replay_file_id");

-- CreateIndex
CREATE INDEX "computer_sessions_cloud_computer_id_started_at_idx" ON "computer_sessions"("cloud_computer_id", "started_at");

-- CreateIndex
CREATE INDEX "computer_sessions_run_id_idx" ON "computer_sessions"("run_id");

-- CreateIndex
CREATE INDEX "computer_sessions_user_id_idx" ON "computer_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "signed_in_websites_cloud_computer_id_domain_key" ON "signed_in_websites"("cloud_computer_id", "domain");

-- CreateIndex
CREATE INDEX "computer_transfers_cloud_computer_id_created_at_idx" ON "computer_transfers"("cloud_computer_id", "created_at");

-- CreateIndex
CREATE INDEX "computer_transfers_run_id_idx" ON "computer_transfers"("run_id");

-- CreateIndex
CREATE INDEX "computer_transfers_connection_id_idx" ON "computer_transfers"("connection_id");

-- CreateIndex
CREATE INDEX "computer_transfers_file_id_idx" ON "computer_transfers"("file_id");

-- CreateIndex
CREATE INDEX "automations_organization_id_status_idx" ON "automations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "automations_owner_id_idx" ON "automations"("owner_id");

-- CreateIndex
CREATE INDEX "automations_bot_id_idx" ON "automations"("bot_id");

-- CreateIndex
CREATE INDEX "automations_skill_id_idx" ON "automations"("skill_id");

-- CreateIndex
CREATE INDEX "automations_device_place_id_idx" ON "automations"("device_place_id");

-- CreateIndex
CREATE INDEX "automations_source_conversation_id_idx" ON "automations"("source_conversation_id");

-- CreateIndex
CREATE INDEX "automations_results_conversation_id_idx" ON "automations"("results_conversation_id");

-- CreateIndex
CREATE INDEX "automations_next_run_at_idx" ON "automations"("next_run_at");

-- CreateIndex
CREATE INDEX "automations_deleted_at_idx" ON "automations"("deleted_at");

-- CreateIndex
CREATE INDEX "automation_connections_connection_id_idx" ON "automation_connections"("connection_id");

-- CreateIndex
CREATE INDEX "automation_pre_approvals_connection_id_idx" ON "automation_pre_approvals"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_pre_approvals_automation_id_action_type_connecti_key" ON "automation_pre_approvals"("automation_id", "action_type", "connection_id", "target");

-- CreateIndex
CREATE INDEX "automation_result_destinations_automation_id_idx" ON "automation_result_destinations"("automation_id");

-- CreateIndex
CREATE INDEX "automation_result_destinations_connection_id_idx" ON "automation_result_destinations"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_trigger_subscriptions_composio_trigger_id_key" ON "automation_trigger_subscriptions"("composio_trigger_id");

-- CreateIndex
CREATE INDEX "automation_trigger_subscriptions_automation_id_idx" ON "automation_trigger_subscriptions"("automation_id");

-- CreateIndex
CREATE INDEX "automation_trigger_subscriptions_connection_id_idx" ON "automation_trigger_subscriptions"("connection_id");

-- CreateIndex
CREATE INDEX "automation_runs_automation_id_created_at_idx" ON "automation_runs"("automation_id", "created_at");

-- CreateIndex
CREATE INDEX "automation_runs_status_idx" ON "automation_runs"("status");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_device_id_idx" ON "notification_deliveries"("device_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_scheduled_for_idx" ON "notification_deliveries"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "usage_records_organization_id_period_idx" ON "usage_records"("organization_id", "period");

-- CreateIndex
CREATE INDEX "usage_records_user_id_period_idx" ON "usage_records"("user_id", "period");

-- CreateIndex
CREATE INDEX "usage_records_bot_id_period_idx" ON "usage_records"("bot_id", "period");

-- CreateIndex
CREATE INDEX "usage_records_model_id_idx" ON "usage_records"("model_id");

-- CreateIndex
CREATE INDEX "usage_records_artifact_id_idx" ON "usage_records"("artifact_id");

-- CreateIndex
CREATE INDEX "usage_records_run_id_idx" ON "usage_records"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_organization_id_period_day_kind_user_id_bot_i_key" ON "usage_records"("organization_id", "period", "day", "kind", "user_id", "bot_id", "model_id", "artifact_id");

-- CreateIndex
CREATE INDEX "usage_limits_user_id_idx" ON "usage_limits"("user_id");

-- CreateIndex
CREATE INDEX "usage_limits_bot_id_idx" ON "usage_limits"("bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_limits_organization_id_scope_user_id_bot_id_key" ON "usage_limits"("organization_id", "scope", "user_id", "bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_alerts_organization_id_scope_user_id_bot_id_period_th_key" ON "usage_alerts"("organization_id", "scope", "user_id", "bot_id", "period", "threshold");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripe_invoice_id_key" ON "invoices"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "invoices_organization_id_issued_at_idx" ON "invoices"("organization_id", "issued_at");

-- CreateIndex
CREATE INDEX "activity_logs_organization_id_created_at_idx" ON "activity_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_organization_id_action_idx" ON "activity_logs"("organization_id", "action");

-- CreateIndex
CREATE INDEX "activity_logs_actor_user_id_idx" ON "activity_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "activity_logs_actor_bot_id_idx" ON "activity_logs"("actor_bot_id");

-- CreateIndex
CREATE INDEX "activity_logs_on_behalf_of_id_idx" ON "activity_logs"("on_behalf_of_id");

-- CreateIndex
CREATE INDEX "activity_logs_target_type_target_id_idx" ON "activity_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "activity_logs_connection_id_idx" ON "activity_logs"("connection_id");

-- CreateIndex
CREATE INDEX "activity_logs_run_id_idx" ON "activity_logs"("run_id");

-- CreateIndex
CREATE INDEX "activity_logs_device_id_idx" ON "activity_logs"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_exports_file_id_key" ON "data_exports"("file_id");

-- CreateIndex
CREATE INDEX "data_exports_user_id_created_at_idx" ON "data_exports"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "data_exports_organization_id_idx" ON "data_exports"("organization_id");

-- CreateIndex
CREATE INDEX "data_exports_status_idx" ON "data_exports"("status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_file_id_fkey" FOREIGN KEY ("avatar_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tool_settings" ADD CONSTRAINT "device_tool_settings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_tool_servers" ADD CONSTRAINT "local_tool_servers_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_places" ADD CONSTRAINT "device_places_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_default_bot_id_fkey" FOREIGN KEY ("default_bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_service_defaults" ADD CONSTRAINT "user_service_defaults_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_service_defaults" ADD CONSTRAINT "user_service_defaults_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_service_defaults" ADD CONSTRAINT "user_service_defaults_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_logo_file_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_default_model_id_fkey" FOREIGN KEY ("default_model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_fallback_model_id_fkey" FOREIGN KEY ("fallback_model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_allowed_models" ADD CONSTRAINT "organization_allowed_models_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_allowed_models" ADD CONSTRAINT "organization_allowed_models_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_templates" ADD CONSTRAINT "bot_templates_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_template_skills" ADD CONSTRAINT "bot_template_skills_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "bot_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_template_skills" ADD CONSTRAINT "bot_template_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_templates" ADD CONSTRAINT "organization_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_templates" ADD CONSTRAINT "organization_templates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "bot_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "bot_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_duplicated_from_id_fkey" FOREIGN KEY ("duplicated_from_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_approval_rules" ADD CONSTRAINT "bot_approval_rules_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_connections" ADD CONSTRAINT "bot_connections_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_connections" ADD CONSTRAINT "bot_connections_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_tool_servers" ADD CONSTRAINT "bot_tool_servers_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_tool_servers" ADD CONSTRAINT "bot_tool_servers_tool_server_id_fkey" FOREIGN KEY ("tool_server_id") REFERENCES "tool_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_credentials" ADD CONSTRAINT "bot_credentials_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_credentials" ADD CONSTRAINT "bot_credentials_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_skills" ADD CONSTRAINT "bot_skills_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_skills" ADD CONSTRAINT "bot_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_links" ADD CONSTRAINT "knowledge_links_knowledge_item_id_fkey" FOREIGN KEY ("knowledge_item_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_links" ADD CONSTRAINT "knowledge_links_fetched_by_id_fkey" FOREIGN KEY ("fetched_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_source_conversation_id_fkey" FOREIGN KEY ("source_conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_folders" ADD CONSTRAINT "conversation_folders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_folders" ADD CONSTRAINT "conversation_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_bot_id_fkey" FOREIGN KEY ("lead_bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "conversation_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_bot_id_fkey" FOREIGN KEY ("author_bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_branch_from_message_id_fkey" FOREIGN KEY ("branch_from_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_pinned_by_id_fkey" FOREIGN KEY ("pinned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_files" ADD CONSTRAINT "message_files_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_files" ADD CONSTRAINT "message_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactive_responses" ADD CONSTRAINT "interactive_responses_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_widgets" ADD CONSTRAINT "saved_widgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_widgets" ADD CONSTRAINT "saved_widgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_widgets" ADD CONSTRAINT "saved_widgets_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_widgets" ADD CONSTRAINT "saved_widgets_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_trigger_message_id_fkey" FOREIGN KEY ("trigger_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_parent_run_id_fkey" FOREIGN KEY ("parent_run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_requested_by_bot_id_fkey" FOREIGN KEY ("requested_by_bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_automation_run_id_fkey" FOREIGN KEY ("automation_run_id") REFERENCES "automation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_voice_session_id_fkey" FOREIGN KEY ("voice_session_id") REFERENCES "voice_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_shares" ADD CONSTRAINT "skill_shares_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_shares" ADD CONSTRAINT "skill_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_starter_skills" ADD CONSTRAINT "organization_starter_skills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_starter_skills" ADD CONSTRAINT "organization_starter_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_duplicated_from_id_fkey" FOREIGN KEY ("duplicated_from_id") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "artifact_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_draft_version_id_fkey" FOREIGN KEY ("draft_version_id") REFERENCES "artifact_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_shares" ADD CONSTRAINT "artifact_shares_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_shares" ADD CONSTRAINT "artifact_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_comments" ADD CONSTRAINT "artifact_comments_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_comments" ADD CONSTRAINT "artifact_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_comments" ADD CONSTRAINT "artifact_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "artifact_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_comments" ADD CONSTRAINT "artifact_comments_mentioned_bot_id_fkey" FOREIGN KEY ("mentioned_bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_records" ADD CONSTRAINT "artifact_records_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_reports" ADD CONSTRAINT "artifact_reports_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_reports" ADD CONSTRAINT "artifact_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_tool_server_id_fkey" FOREIGN KEY ("tool_server_id") REFERENCES "tool_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_bot_restrictions" ADD CONSTRAINT "connection_bot_restrictions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_bot_restrictions" ADD CONSTRAINT "connection_bot_restrictions_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_last_used_bot_id_fkey" FOREIGN KEY ("last_used_bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_servers" ADD CONSTRAINT "tool_servers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_servers" ADD CONSTRAINT "tool_servers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_servers" ADD CONSTRAINT "tool_servers_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_computer_session_id_fkey" FOREIGN KEY ("computer_session_id") REFERENCES "computer_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_computers" ADD CONSTRAINT "cloud_computers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_computers" ADD CONSTRAINT "cloud_computers_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computer_sessions" ADD CONSTRAINT "computer_sessions_cloud_computer_id_fkey" FOREIGN KEY ("cloud_computer_id") REFERENCES "cloud_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computer_sessions" ADD CONSTRAINT "computer_sessions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computer_sessions" ADD CONSTRAINT "computer_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computer_sessions" ADD CONSTRAINT "computer_sessions_replay_file_id_fkey" FOREIGN KEY ("replay_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_in_websites" ADD CONSTRAINT "signed_in_websites_cloud_computer_id_fkey" FOREIGN KEY ("cloud_computer_id") REFERENCES "cloud_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computer_transfers" ADD CONSTRAINT "computer_transfers_cloud_computer_id_fkey" FOREIGN KEY ("cloud_computer_id") REFERENCES "cloud_computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computer_transfers" ADD CONSTRAINT "computer_transfers_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computer_transfers" ADD CONSTRAINT "computer_transfers_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computer_transfers" ADD CONSTRAINT "computer_transfers_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_device_place_id_fkey" FOREIGN KEY ("device_place_id") REFERENCES "device_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_source_conversation_id_fkey" FOREIGN KEY ("source_conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_results_conversation_id_fkey" FOREIGN KEY ("results_conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_connections" ADD CONSTRAINT "automation_connections_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_connections" ADD CONSTRAINT "automation_connections_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_pre_approvals" ADD CONSTRAINT "automation_pre_approvals_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_pre_approvals" ADD CONSTRAINT "automation_pre_approvals_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_result_destinations" ADD CONSTRAINT "automation_result_destinations_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_result_destinations" ADD CONSTRAINT "automation_result_destinations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_trigger_subscriptions" ADD CONSTRAINT "automation_trigger_subscriptions_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_trigger_subscriptions" ADD CONSTRAINT "automation_trigger_subscriptions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_limits" ADD CONSTRAINT "usage_limits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_limits" ADD CONSTRAINT "usage_limits_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_alerts" ADD CONSTRAINT "usage_alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_bot_id_fkey" FOREIGN KEY ("actor_bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
