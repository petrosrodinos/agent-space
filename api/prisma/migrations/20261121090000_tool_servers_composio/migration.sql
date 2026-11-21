-- §8.4 Custom tool servers move to Composio custom toolkits. Status, sign-in and bot limits now live on the linked
-- connection. Servers added before this change have no toolkit yet and must be removed and added again.

-- Carry each server's bot limits over to its connection ("Limit to bots" now applies through the connection).
INSERT INTO "connection_bot_restrictions" ("connection_id", "bot_id", "created_at")
SELECT c."id", b."bot_id", b."created_at"
FROM "bot_tool_servers" b
JOIN "connections" c ON c."tool_server_id" = b."tool_server_id"
ON CONFLICT DO NOTHING;

UPDATE "connections" c
SET "restricted_to_bots" = TRUE
WHERE c."tool_server_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "bot_tool_servers" b WHERE b."tool_server_id" = c."tool_server_id");

-- Existing servers stop working until re-added: say so on their connection.
UPDATE "connections"
SET "status" = 'NEEDS_RECONNECTING',
    "status_message" = 'Remove this tool server and add it again to reconnect it.'
WHERE "tool_server_id" IS NOT NULL
  AND "deleted_at" IS NULL;

-- DropForeignKey
ALTER TABLE "bot_tool_servers" DROP CONSTRAINT "bot_tool_servers_bot_id_fkey";

-- DropForeignKey
ALTER TABLE "bot_tool_servers" DROP CONSTRAINT "bot_tool_servers_tool_server_id_fkey";

-- DropForeignKey
ALTER TABLE "tool_servers" DROP CONSTRAINT "tool_servers_credential_id_fkey";

-- DropIndex
DROP INDEX "tool_servers_credential_id_key";

-- AlterTable
ALTER TABLE "tool_servers" DROP COLUMN "credential_id",
DROP COLUMN "status",
DROP COLUMN "status_message",
ADD COLUMN     "composio_toolkit_slug" TEXT;

-- DropTable
DROP TABLE "bot_tool_servers";

-- DropEnum
DROP TYPE "ToolServerStatus";
