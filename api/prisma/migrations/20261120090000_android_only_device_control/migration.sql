-- iOS is no longer a platform (§14.2): drop its rows before narrowing the enums.
DELETE FROM "app_version_policies" WHERE "platform" = 'IOS';
DELETE FROM "devices" WHERE "platform" = 'IOS';
UPDATE "devices" SET "push_provider" = NULL, "push_token" = NULL WHERE "push_provider" = 'APNS';
-- AlterEnum
ALTER TYPE "DeviceToolKind" ADD VALUE 'CONTROL_COMPUTER';

-- AlterEnum
BEGIN;
CREATE TYPE "Platform_new" AS ENUM ('WEB', 'DESKTOP', 'ANDROID');
ALTER TABLE "devices" ALTER COLUMN "platform" TYPE "Platform_new" USING ("platform"::text::"Platform_new");
ALTER TABLE "app_version_policies" ALTER COLUMN "platform" TYPE "Platform_new" USING ("platform"::text::"Platform_new");
ALTER TYPE "Platform" RENAME TO "Platform_old";
ALTER TYPE "Platform_new" RENAME TO "Platform";
DROP TYPE "public"."Platform_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PushProvider_new" AS ENUM ('WEBPUSH', 'FCM');
ALTER TABLE "devices" ALTER COLUMN "push_provider" TYPE "PushProvider_new" USING ("push_provider"::text::"PushProvider_new");
ALTER TYPE "PushProvider" RENAME TO "PushProvider_old";
ALTER TYPE "PushProvider_new" RENAME TO "PushProvider";
DROP TYPE "public"."PushProvider_old";
COMMIT;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "blocked_apps" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN     "voice_visual_input" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "purge_deleted_artifacts" BOOLEAN NOT NULL DEFAULT false;
