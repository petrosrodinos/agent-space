-- Organisation choice of OpenAI Realtime model for voice mode (null = platform default).
ALTER TABLE "organization_settings" ADD COLUMN "voice_model" TEXT;
