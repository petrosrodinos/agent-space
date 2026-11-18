-- CreateEnum
CREATE TYPE "ColorTheme" AS ENUM ('GRAPE', 'OCEAN', 'SKY', 'TEAL', 'FOREST', 'LIME', 'SUNSET', 'AMBER', 'ROSE', 'CRIMSON', 'LAVENDER', 'SLATE');

-- AlterTable
ALTER TABLE "organization_members" ADD COLUMN "color_theme" "ColorTheme" NOT NULL DEFAULT 'GRAPE';
