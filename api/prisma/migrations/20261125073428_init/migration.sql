-- AlterTable
ALTER TABLE "bot_templates" ALTER COLUMN "avatar_seed" SET DEFAULT substr(md5(random()::text), 1, 12);

-- AlterTable
ALTER TABLE "bots" ALTER COLUMN "avatar_seed" SET DEFAULT substr(md5(random()::text), 1, 12);
