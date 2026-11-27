-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN "draft" TEXT,
ADD COLUMN "draft_updated_at" TIMESTAMP(3);
