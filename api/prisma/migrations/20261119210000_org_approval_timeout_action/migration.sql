-- What happens when the organisation approval timeout is reached: cancel (default) or accept automatically.
CREATE TYPE "ApprovalTimeoutAction" AS ENUM ('CANCEL', 'APPROVE');
ALTER TABLE "organization_settings" ADD COLUMN "approval_timeout_action" "ApprovalTimeoutAction" NOT NULL DEFAULT 'CANCEL';
