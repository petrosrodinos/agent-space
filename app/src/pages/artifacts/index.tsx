import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Globe, Lock, Pin, PinOff, Presentation, Puzzle, RotateCcw, Search, Users } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useArtifacts, useRestoreArtifact, useUpdateArtifact } from "@/features/artifacts/hooks/use-artifacts";
import type { ArtifactSummary, ArtifactTab, ArtifactType } from "@/features/artifacts/interfaces/artifacts.interfaces";
import { ArtifactRoleOptions, ArtifactSharingOptions, ArtifactTabOptions, ArtifactTypeOptions } from "@/config/constants/dropdowns/artifacts/artifact.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { timeAgo } from "@/lib/date";
import { Routes } from "@/routes/routes";
import { ArtifactTypeIcon } from "@/pages/artifacts/components/artifact-type-icon";
import { ArtifactSharingLevels, ArtifactTabs, ArtifactRoles } from "@/features/artifacts/interfaces/artifacts.interfaces";
import { ALL_FILTER } from "@/config/constants/filters";

const SharingIcon: FC<{ a: ArtifactSummary }> = ({ a }) =>
  a.public_enabled ? <Globe className="h-3.5 w-3.5" /> : a.sharing_level === ArtifactSharingLevels.PRIVATE ? <Lock className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />;

const ArtifactCard: FC<{ a: ArtifactSummary; tab: ArtifactTab }> = ({ a, tab }) => {
  const navigate = useNavigate();
  const pin = useUpdateArtifact(null);
  const restore = useRestoreArtifact();
  const deleted = tab === ArtifactTabs.DELETED;
  return (
    <div className="card-lift group relative flex flex-col rounded-[20px] border border-hairline bg-surface p-4 shadow-sticker">
      <button className="flex items-start gap-3 text-left" onClick={() => !deleted && navigate(Routes.artifacts.detail(a.id))} disabled={deleted}>
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft text-2xl" aria-hidden>
          <ArtifactTypeIcon type={a.type} className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1 pr-8">
          <span className="block truncate text-[17px] font-bold text-ink">{a.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {getDropdownOptionLabel(ArtifactTypeOptions, a.type)} · {a.owner?.name ?? a.owner?.email ?? "—"}
          </span>
        </span>
      </button>
      {!deleted && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 h-8 w-8"
          aria-label={a.pinned ? "Unpin" : "Pin"}
          onClick={() => pin.mutate({ id: a.id, pinned: !a.pinned })}
        >
          {a.pinned ? <PinOff className="text-primary" /> : <Pin />}
        </Button>
      )}
      <p className="mt-3 line-clamp-2 min-h-[40px] text-sm text-body">{a.description || "No description"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <SharingIcon a={a} /> {a.public_enabled ? "Public link" : getDropdownOptionLabel(ArtifactSharingOptions, a.sharing_level)}
        </Badge>
        {a.role !== ArtifactRoles.OWNER && <Badge variant="outline">{getDropdownOptionLabel(ArtifactRoleOptions, a.role)}</Badge>}
        {a.has_draft && <Badge variant="outline">Draft waiting</Badge>}
        {a.taken_down && <Badge variant="destructive">Taken down</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">
          {a.version ? `v${a.version} · ` : ""}
          {timeAgo(a.updated_at)}
        </span>
      </div>
      {deleted && (
        <Button className="mt-4 w-full" variant="outline" loading={restore.isPending} onClick={() => restore.mutate(a.id)}>
          <RotateCcw /> Restore {a.deleted_at ? `(deleted ${timeAgo(a.deleted_at)})` : ""}
        </Button>
      )}
    </div>
  );
};

/** Artifacts page (§7.5 Finding artifacts): Mine / Shared with me / Organisation, search, type filter, pins. */
const ArtifactsPage: FC = () => {
  const [tab, setTab] = useState<ArtifactTab>(ArtifactTabs.ALL);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ArtifactType | typeof ALL_FILTER>(ALL_FILTER);
  const { data, isPending } = useArtifacts(tab, search.trim() || undefined, type === ALL_FILTER ? undefined : type);

  return (
    <PageContainer wide>
      <PageHeader title="Artifacts" description="Apps, pages, dashboards, documents and decks your bots built — each with its own link." />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl ariaLabel="Filter artifacts" value={tab} options={ArtifactTabOptions} onChange={(v) => setTab(v as ArtifactTab)} />
        <div className="flex w-full gap-2 lg:max-w-md">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" placeholder="Search artifacts" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search artifacts" />
          </div>
          <Select value={type} onValueChange={(v) => setType(v as ArtifactType | typeof ALL_FILTER)}>
            <SelectTrigger className="w-[150px] shrink-0" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All types</SelectItem>
              {ArtifactTypeOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <o.icon className="h-4 w-4" /> {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-[20px]" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState
          title={tab === ArtifactTabs.DELETED ? "Nothing deleted recently" : search || type !== ALL_FILTER ? "No matches" : "Nothing built yet"}
          description={
            tab === ArtifactTabs.DELETED
              ? "Deleted artifacts can be restored here for 30 days."
              : "Ask any bot to build something — “Make a landing page for our Q4 webinar with a sign-up form” — and it shows up here."
          }
          stickers={[
            { icon: Puzzle, color: "#6B4EFF" },
            { icon: BarChart3, color: "#38B6FF" },
            { icon: Presentation, color: "#FF5FAE" },
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {data.map((a) => (
            <ArtifactCard key={a.id} a={a} tab={tab} />
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default ArtifactsPage;
