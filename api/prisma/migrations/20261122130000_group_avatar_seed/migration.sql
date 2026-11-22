-- Groups get their own portrait avatar. Existing groups get a random seed each (random() is evaluated per row).
ALTER TABLE "conversations" ADD COLUMN "avatar_seed" TEXT;
UPDATE "conversations" SET "avatar_seed" = substr(md5(random()::text || id), 1, 12) WHERE "type" = 'GROUP';
