-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "knowledge_items" ADD COLUMN     "status" "KnowledgeStatus" NOT NULL DEFAULT 'PROCESSING',
ADD COLUMN     "status_error" TEXT;

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "knowledge_item_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_knowledge_item_id_position_key" ON "knowledge_chunks"("knowledge_item_id", "position");

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_knowledge_item_id_fkey" FOREIGN KEY ("knowledge_item_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing items are re-indexed (chunked + embedded) by the knowledge worker on start-up.
UPDATE "knowledge_items" SET "status" = 'PROCESSING' WHERE "deleted_at" IS NULL;
