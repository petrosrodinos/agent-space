import { useState, type FC } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Download, ExternalLink, Files, Maximize2, MessageCircle, Minimize2, MoreHorizontal, Pin, PinOff, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useArtifact, useDiscardDraft, useDuplicateArtifact, usePublishDraft, useUpdateArtifact } from "@/features/artifacts/hooks/use-artifacts";
import type { ArtifactVersion } from "@/features/artifacts/interfaces/artifacts.interfaces";
import { exportArtifact, exportArtifactFile, getViewUrl } from "@/features/artifacts/services/artifacts.services";
import { exportFormatsFor } from "@/features/artifacts/utils/export-formats.utils";
import { ArtifactExportFormats, type ArtifactExportFormat } from "@/features/artifacts/interfaces/artifacts.interfaces";
import { ArtifactExportFormOptions } from "@/config/constants/dropdowns/artifacts/artifact-export-form.options";
import { useMe } from "@/features/users/hooks/use-users";
import { useOrganizationStore } from "@/stores/organization";
import { ArtifactRoleOptions, ArtifactTypeOptions } from "@/config/constants/dropdowns/artifacts/artifact.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { timeAgo } from "@/lib/date";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { ArtifactFrame } from "../../components/artifact-frame";
import { SharePanel } from "./components/share-panel";
import { VersionsPanel } from "./components/versions-panel";
import { DataPanel } from "./components/data-panel";
import { CommentsPanel } from "./components/comments-panel";
import { SettingsPanel } from "./components/settings-panel";
import { ArtifactTypeIcon } from "@/pages/artifacts/components/artifact-type-icon";
import { ArtifactRoles } from "@/features/artifacts/interfaces/artifacts.interfaces";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";

/** Artifact viewer (§7.5): live preview with Share, Versions, Data, Comments and Settings alongside. */
const ArtifactDetailPage: FC = () => {
  const { artifactId = "" } = useParams();
  const navigate = useNavigate();
  const { data: a, isPending, isError, error } = useArtifact(artifactId);
  const { data: me } = useMe();
  const orgId = useOrganizationStore((s) => s.current_id);
  const isAdmin = ([OrgRoles.OWNER, OrgRoles.ADMIN] as string[]).includes(me?.organizations.find((o) => o.id === orgId)?.role ?? "");
  const duplicate = useDuplicateArtifact();
  const publish = usePublishDraft();
  const discard = useDiscardDraft();
  const pin = useUpdateArtifact(null);
  const [full, setFull] = useState(false);
  const [preview, setPreview] = useState<ArtifactVersion | null>(null);
  const [compare, setCompare] = useState<ArtifactVersion | null>(null);
  const [showDraft, setShowDraft] = useState(false);

  if (isPending)
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="flex-1 rounded-lg" />
      </div>
    );
  if (isError || !a)
    return <EmptyState title="Can't open this artifact" description={(error as Error)?.message ?? "It may have been deleted or you no longer have access."} action={<Button onClick={() => navigate(Routes.artifacts.root)}>All artifacts</Button>} />;

  const isEditor = a.role === ArtifactRoles.OWNER || a.role === ArtifactRoles.EDITOR;
  const canComment = isEditor || a.role === ArtifactRoles.COMMENTER;
  const rev = `${a.current_version?.id ?? ""}:${a.draft_version?.id ?? ""}`;
  const shownVersionId = preview?.id ?? (showDraft && a.draft_version ? a.draft_version.id : undefined);

  const copyLink = async () => {
    await platform.clipboard.writeText(a.url);
    toast({ title: a.public_link.enabled ? "Public link copied" : "Link copied — only people with access can open it", duration: 2200 });
  };
  const openTab = async () => {
    try {
      const v = await getViewUrl(a.id, shownVersionId);
      platform.links.openExternal(v.url);
    } catch (e) {
      toast({ title: "Could not open", description: (e as Error).message, variant: "error" });
    }
  };
  const download = async (format: ArtifactExportFormat) => {
    try {
      let blob: Blob;
      let filename: string;
      if (format === ArtifactExportFormats.HTML) {
        const r = await exportArtifact(a.id);
        blob = new Blob([r.html], { type: "text/html" });
        filename = r.filename;
      } else {
        toast({ title: `Preparing your ${getDropdownOptionLabel(ArtifactExportFormOptions, format)}…`, duration: 2500 });
        ({ blob, filename } = await exportArtifactFile(a.id, format));
      }
      const url = URL.createObjectURL(blob);
      platform.files.download(url, filename);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast({ title: "Could not download", description: (e as Error).message, variant: "error" });
    }
  };

  const tabs = [
    { id: "share", label: "Share" },
    ...(isEditor ? [{ id: "versions", label: "Versions" }] : []),
    ...(isEditor ? [{ id: "data", label: `Data${a.stats?.records ? ` · ${a.stats.records}` : ""}` }] : []),
    ...(canComment ? [{ id: "comments", label: `Comments${a.open_comments ? ` · ${a.open_comments}` : ""}` }] : []),
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className={cn("flex h-full min-h-0 flex-col", full && "fixed inset-0 z-50 bg-canvas")}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5 sm:px-4">
        {!full && (
          <Button variant="ghost" size="icon" asChild aria-label="All artifacts">
            <Link to={Routes.artifacts.root}>
              <ArrowLeft />
            </Link>
          </Button>
        )}
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-lg" aria-hidden>
          <ArtifactTypeIcon type={a.type} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-bold leading-tight text-ink sm:text-[17px]">{a.title}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {getDropdownOptionLabel(ArtifactTypeOptions, a.type)}
            {a.current_version ? ` · v${a.current_version.version}` : ""} · {getDropdownOptionLabel(ArtifactRoleOptions, a.role)}
            {a.stats ? ` · ${a.stats.views} views · ${a.stats.uses} uses` : ""} · updated {timeAgo(a.updated_at)}
          </p>
        </div>
        <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={copyLink}>
          <Copy /> Copy link
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setFull((f) => !f)} aria-label={full ? "Exit full screen" : "Full screen"}>
          {full ? <Minimize2 /> : <Maximize2 />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={copyLink} className="sm:hidden">
              <Copy /> Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={openTab}>
              <ExternalLink /> Open in a new tab
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => pin.mutate({ id: a.id, pinned: !a.pinned })}>
              {a.pinned ? <PinOff /> : <Pin />} {a.pinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => duplicate.mutate(a.id, { onSuccess: (copy) => navigate(Routes.artifacts.detail(copy.id)) })}>
              <Files /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Download /> Download as
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {exportFormatsFor(a.type).map((f) => (
                  <DropdownMenuItem key={f} onSelect={() => void download(f)}>
                    {getDropdownOptionLabel(ArtifactExportFormOptions, f)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {a.conversation && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate(Routes.chat.conversation(a.conversation!.id))}>
                  <MessageCircle /> Open conversation
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Draft / preview banners */}
      {isEditor && a.draft_version && !preview && (
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-warning-soft px-4 py-2 text-sm">
          <span className="font-semibold text-ink">Draft v{a.draft_version.version} is waiting{a.draft_version.change_summary ? `: ${a.draft_version.change_summary}` : ""}</span>
          <div className="ml-auto flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setShowDraft((s) => !s)}>
              {showDraft ? "Show live" : "Preview draft"}
            </Button>
            <Button variant="ghost" size="sm" loading={discard.isPending} onClick={() => discard.mutate(a.id, { onSuccess: () => setShowDraft(false) })}>
              Discard
            </Button>
            <Button size="sm" loading={publish.isPending} onClick={() => publish.mutate(a.id, { onSuccess: () => setShowDraft(false) })}>
              <Upload /> Publish
            </Button>
          </div>
        </div>
      )}
      {preview && (
        <div className="flex items-center gap-2 border-b border-hairline bg-primary-soft px-4 py-2 text-sm">
          <span className="font-semibold text-ink">
            Previewing version {preview.version}
            {preview.label ? ` (“${preview.label}”)` : ""}
            {compare ? ` beside version ${compare.version}` : ""}
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => (setPreview(null), setCompare(null))}>
            <X /> Close
          </Button>
        </div>
      )}
      {a.taken_down && <div className="border-b border-hairline bg-error-soft px-4 py-2 text-sm font-semibold text-ink">This artifact was taken down after a report. Its public link no longer works.</div>}

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col desk:flex-row">
        <div className={cn("flex min-h-[60vh] flex-1 gap-2 bg-surface-sunken p-2 desk:min-h-0 sm:p-3", full && "min-h-0")}>
          {compare && (
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-hairline shadow-sticker">
              <p className="border-b border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-muted-foreground">Version {compare.version}</p>
              <ArtifactFrame artifactId={a.id} versionId={compare.id} title={`${a.title} v${compare.version}`} />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-hairline shadow-sticker">
            {compare && <p className="border-b border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-muted-foreground">{preview ? `Version ${preview.version}` : "Live"}</p>}
            <ArtifactFrame artifactId={a.id} versionId={shownVersionId} rev={rev} title={a.title} />
          </div>
        </div>
        {!full && (
          <aside className="w-full shrink-0 border-t border-hairline bg-surface desk:w-[400px] desk:border-l desk:border-t-0">
            <Tabs defaultValue="share" className="flex h-full min-h-0 flex-col">
              <div className="overflow-x-auto px-4 pt-3 scrollbar-thin">
                <TabsList className="w-max">
                  {tabs.map((t) => (
                    <TabsTrigger key={t.id} value={t.id}>
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
                <TabsContent value="share" className="mt-0">
                  <SharePanel artifact={a} isAdmin={isAdmin} />
                </TabsContent>
                {isEditor && (
                  <TabsContent value="versions" className="mt-0">
                    <VersionsPanel artifact={a} previewId={preview?.id ?? null} compareId={compare?.id ?? null} onPreview={setPreview} onCompare={setCompare} />
                  </TabsContent>
                )}
                {isEditor && (
                  <TabsContent value="data" className="mt-0">
                    <DataPanel artifact={a} />
                  </TabsContent>
                )}
                {canComment && (
                  <TabsContent value="comments" className="mt-0">
                    <CommentsPanel artifact={a} />
                  </TabsContent>
                )}
                <TabsContent value="settings" className="mt-0">
                  <SettingsPanel artifact={a} />
                </TabsContent>
              </div>
            </Tabs>
          </aside>
        )}
      </div>
    </div>
  );
};

export default ArtifactDetailPage;
