import type { FC } from "react";
import { artifactTypeIcon } from "@/config/constants/dropdowns/artifacts/artifact.options";
import { cn } from "@/lib/utils";

/** Icon for an artifact type (cards, lists, chat). */
export const ArtifactTypeIcon: FC<{ type: string | null | undefined; className?: string }> = ({ type, className }) => {
  const Icon = artifactTypeIcon(type);
  return <Icon className={cn("text-accent-foreground", className)} aria-hidden />;
};
