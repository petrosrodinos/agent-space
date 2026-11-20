-- AlterTable
ALTER TABLE "run_steps" ADD COLUMN     "undo" JSONB,
ADD COLUMN     "undo_until" TIMESTAMP(3),
ADD COLUMN     "undone_at" TIMESTAMP(3),
ADD COLUMN     "undone_by_id" TEXT;
