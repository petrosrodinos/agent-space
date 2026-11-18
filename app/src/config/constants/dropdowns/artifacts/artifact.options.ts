import { BarChart3, ClipboardList, FileText, Gamepad2, Globe, Network, Presentation, Puzzle, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import { ArtifactRoles, ArtifactSharingLevels, ArtifactTabs, ArtifactTypes } from "@/features/artifacts/interfaces/artifacts.interfaces";

export const ArtifactTabOptions = [
  { id: ArtifactTabs.ALL, label: "All" },
  { id: ArtifactTabs.MINE, label: "Mine" },
  { id: ArtifactTabs.SHARED, label: "Shared with me" },
  { id: ArtifactTabs.ORGANIZATION, label: "Organisation" },
  { id: ArtifactTabs.DELETED, label: "Recently deleted" },
] as const;

export const ArtifactTypeOptions = [
  { id: ArtifactTypes.WEB_APP, label: "Web app", icon: Puzzle },
  { id: ArtifactTypes.DASHBOARD, label: "Dashboard", icon: BarChart3 },
  { id: ArtifactTypes.PAGE, label: "Page", icon: Globe },
  { id: ArtifactTypes.DOCUMENT, label: "Document", icon: FileText },
  { id: ArtifactTypes.PRESENTATION, label: "Presentation", icon: Presentation },
  { id: ArtifactTypes.DIAGRAM, label: "Diagram", icon: Network },
  { id: ArtifactTypes.FORM, label: "Form", icon: ClipboardList },
  { id: ArtifactTypes.TOOL, label: "Tool", icon: Wrench },
  { id: ArtifactTypes.GAME, label: "Game", icon: Gamepad2 },
  { id: ArtifactTypes.OTHER, label: "Other", icon: Sparkles },
] as const;

export const ArtifactSharingOptions = [
  { id: ArtifactSharingLevels.PRIVATE, label: "Private", description: "Only you" },
  { id: ArtifactSharingLevels.SPECIFIC_MEMBERS, label: "Specific members", description: "People you choose" },
  { id: ArtifactSharingLevels.ORGANIZATION, label: "Organisation", description: "Everyone in the organisation" },
  { id: ArtifactSharingLevels.PUBLIC_LINK, label: "Public link", description: "Anyone with the link, no sign-in" },
] as const;

export const ArtifactRoleOptions = [
  { id: ArtifactRoles.OWNER, label: "Owner" },
  { id: ArtifactRoles.EDITOR, label: "Editor" },
  { id: ArtifactRoles.COMMENTER, label: "Commenter" },
  { id: ArtifactRoles.VIEWER, label: "Viewer" },
] as const;

/** Roles that can be given to others (one Owner per artifact). */
export const ArtifactShareRoleOptions = ArtifactRoleOptions.filter((o) => o.id !== ArtifactRoles.OWNER);

/** Icon for an artifact type (cards, lists, chat). */
export const artifactTypeIcon = (type: string | null | undefined): LucideIcon => ArtifactTypeOptions.find((o) => o.id === type)?.icon ?? Sparkles;
