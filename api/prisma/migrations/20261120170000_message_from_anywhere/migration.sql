-- CreateEnum
CREATE TYPE "ExternalChannel" AS ENUM ('EMAIL', 'SLACK', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ChannelLinkStatus" AS ENUM ('PENDING', 'ACTIVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageSource" ADD VALUE 'EMAIL';
ALTER TYPE "MessageSource" ADD VALUE 'SLACK';
ALTER TYPE "MessageSource" ADD VALUE 'WHATSAPP';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "channel_meta" JSONB;

-- CreateTable
CREATE TABLE "channel_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "channel" "ExternalChannel" NOT NULL,
    "status" "ChannelLinkStatus" NOT NULL DEFAULT 'PENDING',
    "external_id" TEXT,
    "inbound_token" TEXT,
    "link_code" TEXT,
    "link_code_expires_at" TIMESTAMP(3),
    "conversation_id" TEXT,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_links_inbound_token_key" ON "channel_links"("inbound_token");

-- CreateIndex
CREATE UNIQUE INDEX "channel_links_link_code_key" ON "channel_links"("link_code");

-- CreateIndex
CREATE INDEX "channel_links_bot_id_idx" ON "channel_links"("bot_id");

-- CreateIndex
CREATE INDEX "channel_links_user_id_idx" ON "channel_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_links_organization_id_user_id_channel_key" ON "channel_links"("organization_id", "user_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "channel_links_channel_external_id_key" ON "channel_links"("channel", "external_id");

-- AddForeignKey
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
