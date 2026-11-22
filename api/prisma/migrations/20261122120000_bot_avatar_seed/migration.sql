-- Generated flat-portrait avatars replace bot emoji. random() is volatile, so every existing row gets its own seed.
ALTER TABLE "bots" ADD COLUMN "avatar_seed" TEXT NOT NULL DEFAULT substr(md5(random()::text), 1, 12);
ALTER TABLE "bot_templates" ADD COLUMN "avatar_seed" TEXT NOT NULL DEFAULT substr(md5(random()::text), 1, 12);
ALTER TABLE "bot_templates" ALTER COLUMN "emoji" SET DEFAULT '';
