-- AlterTable
ALTER TABLE "messages" ADD COLUMN "reply_to_message_id" TEXT;

-- CreateIndex
CREATE INDEX "messages_reply_to_message_id_idx" ON "messages"("reply_to_message_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
