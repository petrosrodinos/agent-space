-- AlterTable
ALTER TABLE "organization_settings" ALTER COLUMN "allowed_device_tools" SET DEFAULT ARRAY['LOCAL_FILES', 'SCREEN', 'LOCAL_TOOL_SERVERS', 'CLIPBOARD', 'OPEN', 'CONTROL_COMPUTER', 'CAMERA_SCANNER', 'CONTACTS', 'SEND_VIA_APPS', 'DEVICE_CALENDAR', 'LOCATION', 'BROWSER']::"DeviceToolKind"[];

-- Existing organisations that allow device tools also allow the browser tool (each member still decides per computer, §14.3).
UPDATE "organization_settings" SET "allowed_device_tools" = array_append("allowed_device_tools", 'BROWSER') WHERE NOT ('BROWSER' = ANY("allowed_device_tools"));
