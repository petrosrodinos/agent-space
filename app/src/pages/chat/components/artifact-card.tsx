import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MessagePart } from "@/features/conversations/interfaces/conversations.interfaces";
import { ArtifactTypeOptions } from "@/config/constants/dropdowns/artifacts/artifact.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { Routes } from "@/routes/routes";
import { ArtifactFrame } from "@/pages/artifacts/components/artifact-frame";
import { ArtifactTypeIcon } from "@/pages/artifacts/components/artifact-type-icon";
import { MessagePartTypes, ArtifactPartActions, ArtifactPartStatuses } from "@/features/conversations/interfaces/conversations.interfaces";

type ArtifactPart = Extract<MessagePart, { type: typeof MessagePartTypes.ARTIFACT }>;

/** An artifact a bot created or changed in this turn (§7.5 "Artifacts also appear in the conversation"). */
export const ArtifactCard: FC<{ part: ArtifactPart }> = ({ part: p }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="my-1.5 w-full max-w-[560px] overflow-hidden rounded-[20px] border border-hairline bg-surface shadow-sticker">
      <div className="flex items-center gap-3 p-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft text-xl" aria-hidden>
          <ArtifactTypeIcon type={p.artifact_type} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-ink">{p.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {getDropdownOptionLabel(ArtifactTypeOptions, p.artifact_type, "Artifact")} · {p.action === ArtifactPartActions.CREATED ? "Created" : `Updated to v${p.version}`}
            {p.status === ArtifactPartStatuses.DRAFT ? " · draft, not live yet" : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label={open ? "Hide preview" : "Show preview"} aria-expanded={open}>
          {open ? <ChevronUp /> : <ChevronDown />}
        </Button>
        <Button size="sm" onClick={() => navigate(Routes.artifacts.detail(p.artifact_id))}>
          <ExternalLink /> Open
        </Button>
      </div>
      {p.description && !open && <p className="line-clamp-2 border-t border-hairline px-3 py-2 text-sm text-body">{p.description}</p>}
      {open && (
        <div className="h-[360px] border-t border-hairline">
          <ArtifactFrame artifactId={p.artifact_id} title={p.title} rev={p.version} />
        </div>
      )}
    </div>
  );
};
