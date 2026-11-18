-- AlterEnum
ALTER TYPE "CredentialKind" ADD VALUE 'WEBSITE_LOGIN';

-- AlterTable
ALTER TABLE "credentials" ADD COLUMN "website_domain" TEXT;
