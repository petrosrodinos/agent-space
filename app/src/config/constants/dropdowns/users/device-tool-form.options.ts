import { DesktopToolKinds, type DesktopToolKind } from "@/platform/device-bridge";
import { DeviceToolPermissions, type DeviceToolPermission } from "@/features/users/interfaces/users.interfaces";

/** Desktop device tools (§14.3) as shown in Settings → Devices. */
export const DesktopToolOptions: { id: DesktopToolKind; label: string; description: string }[] = [
  { id: DesktopToolKinds.LOCAL_FILES, label: "Local files", description: "List, search, read and save files in the folders you allow. Deleting or replacing a file always asks first." },
  { id: DesktopToolKinds.SCREEN, label: "Look at my screen", description: "A picture of a window or screen you pick, only when you ask." },
  { id: DesktopToolKinds.LOCAL_TOOL_SERVERS, label: "Local tool servers", description: "Tool servers (MCP) that run only on this computer." },
  { id: DesktopToolKinds.CLIPBOARD, label: "Clipboard", description: "Copy results to the clipboard; read it only when you ask." },
  { id: DesktopToolKinds.OPEN, label: "Open", description: "Open links, files and apps on this computer." },
  { id: DesktopToolKinds.CONTROL_COMPUTER, label: "Control my computer", description: "Use the apps on this computer to finish a task. Asks every time, for one task, at most 30 minutes." },
];

export const DeviceToolPermissionFormOptions: { id: DeviceToolPermission; label: string }[] = [
  { id: DeviceToolPermissions.ASK_EACH_TIME, label: "Ask each time" },
  { id: DeviceToolPermissions.ALWAYS_ALLOW, label: "Always allow" },
  { id: DeviceToolPermissions.NEVER, label: "Never" },
];

/** Control my computer has no "Always allow" (§14.3). */
export const ControlComputerPermissionFormOptions = DeviceToolPermissionFormOptions.filter((o) => o.id !== DeviceToolPermissions.ALWAYS_ALLOW);
