-- Per-charge usage ledger. usage_records keeps the daily totals.
CREATE TABLE "usage_charges" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "bot_id" TEXT,
    "model_id" TEXT,
    "run_id" TEXT,
    "kind" "UsageKind" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_charges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "usage_charges_organization_id_created_at_idx" ON "usage_charges"("organization_id", "created_at");
CREATE INDEX "usage_charges_user_id_idx" ON "usage_charges"("user_id");
CREATE INDEX "usage_charges_bot_id_idx" ON "usage_charges"("bot_id");
CREATE INDEX "usage_charges_model_id_idx" ON "usage_charges"("model_id");
CREATE INDEX "usage_charges_run_id_idx" ON "usage_charges"("run_id");

ALTER TABLE "usage_charges" ADD CONSTRAINT "usage_charges_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_charges" ADD CONSTRAINT "usage_charges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "usage_charges" ADD CONSTRAINT "usage_charges_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "usage_charges" ADD CONSTRAINT "usage_charges_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "usage_charges" ADD CONSTRAINT "usage_charges_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- History before this table existed: one charge per daily total, dated at the start of that day.
INSERT INTO "usage_charges" ("id", "organization_id", "user_id", "bot_id", "model_id", "run_id", "kind", "quantity", "cost", "created_at")
SELECT gen_random_uuid()::text, "organization_id", "user_id", "bot_id", "model_id", "run_id", "kind", "quantity", "cost", "day"::timestamp
FROM "usage_records";
