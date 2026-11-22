-- usage_charges becomes the only usage store. Move every usage_records total into it, then drop usage_records.

-- 1. Remove the rough copy made by 20261122120000_usage_charges (rows dated at midnight with no token split).
DELETE FROM "usage_charges"
WHERE "input_tokens" IS NULL AND "output_tokens" IS NULL AND "created_at" = date_trunc('day', "created_at")
  AND "created_at" < '2026-11-22 14:00:00';

-- 2. Copy each daily total again, minus whatever was already logged as separate charges for the same
--    day / type / member / bot / model (those charges were also added to the daily totals), so nothing counts twice.
INSERT INTO "usage_charges" ("id", "organization_id", "user_id", "bot_id", "model_id", "run_id", "kind", "quantity", "cost", "created_at")
SELECT gen_random_uuid()::text, r."organization_id", r."user_id", r."bot_id", r."model_id", r."run_id", r."kind",
       GREATEST(r."quantity" - COALESCE(c.quantity, 0), 0), GREATEST(r."cost" - COALESCE(c.cost, 0), 0), r."day"::timestamp
FROM (
    SELECT "organization_id", "user_id", "bot_id", "model_id", MAX("run_id") AS "run_id", "kind", "day", SUM("quantity") AS "quantity", SUM("cost") AS "cost"
    FROM "usage_records"
    GROUP BY "organization_id", "user_id", "bot_id", "model_id", "kind", "day"
) r
LEFT JOIN (
    SELECT "organization_id", "user_id", "bot_id", "model_id", "kind", "created_at"::date AS "day", SUM("quantity") AS quantity, SUM("cost") AS cost
    FROM "usage_charges"
    GROUP BY "organization_id", "user_id", "bot_id", "model_id", "kind", "created_at"::date
) c ON c."organization_id" = r."organization_id" AND c."kind" = r."kind" AND c."day" = r."day"
   AND c."user_id" IS NOT DISTINCT FROM r."user_id" AND c."bot_id" IS NOT DISTINCT FROM r."bot_id" AND c."model_id" IS NOT DISTINCT FROM r."model_id"
WHERE r."cost" - COALESCE(c.cost, 0) > 0;

-- 3. Drop the daily totals table.
DROP TABLE "usage_records";
