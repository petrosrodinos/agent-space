-- CreateTable
CREATE TABLE "artifact_data_grants" (
    "id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "service_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_data_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "artifact_data_grants_user_id_idx" ON "artifact_data_grants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_data_grants_artifact_id_user_id_service_key_key" ON "artifact_data_grants"("artifact_id", "user_id", "service_key");

-- AddForeignKey
ALTER TABLE "artifact_data_grants" ADD CONSTRAINT "artifact_data_grants_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_data_grants" ADD CONSTRAINT "artifact_data_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
