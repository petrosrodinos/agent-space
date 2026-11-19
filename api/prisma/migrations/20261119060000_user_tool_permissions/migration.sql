-- CreateEnum
CREATE TYPE "ToolPermission" AS ENUM ('ALWAYS_ALLOW', 'AUTO_REVIEW', 'NEEDS_APPROVAL', 'BLOCKED');

-- CreateTable
CREATE TABLE "user_tool_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "service_key" TEXT NOT NULL,
    "tool_slug" TEXT NOT NULL,
    "permission" "ToolPermission" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tool_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_tool_permissions_org_user_service_idx" ON "user_tool_permissions"("organization_id", "user_id", "service_key");

-- CreateIndex
CREATE UNIQUE INDEX "user_tool_permissions_user_org_service_tool_key" ON "user_tool_permissions"("user_id", "organization_id", "service_key", "tool_slug");

-- AddForeignKey
ALTER TABLE "user_tool_permissions" ADD CONSTRAINT "user_tool_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tool_permissions" ADD CONSTRAINT "user_tool_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
