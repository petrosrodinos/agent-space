-- Neutral (monochrome) is the new default colour theme; nobody has picked a theme yet, so move everyone to it.
ALTER TABLE "organization_members" ALTER COLUMN "color_theme" SET DEFAULT 'NEUTRAL';
UPDATE "organization_members" SET "color_theme" = 'NEUTRAL' WHERE "color_theme" = 'GRAPE';
