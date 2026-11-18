import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Handshake, Plus, RotateCcw, Search, Upload, Wand2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { BotAvatarStack } from "@/components/ui/bot-avatar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAddStarterSkill, useImportSkill, useRestoreSkill, useSkills } from "@/features/skills/hooks/use-skills";
import type { SkillSummary, SkillTab } from "@/features/skills/interfaces/skills.interfaces";
import { SkillSharingOptions, SkillTabOptions } from "@/config/constants/dropdowns/shared/status.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { toast } from "@/hooks/use-toast";
import { platform } from "@/platform";
import { Routes } from "@/routes/routes";
import { timeAgo } from "@/lib/date";
import { SkillTabs } from "@/features/skills/interfaces/skills.interfaces";

const SkillCard: FC<{ skill: SkillSummary; tab: SkillTab }> = ({ skill, tab }) => {
  const navigate = useNavigate();
  const add = useAddStarterSkill();
  const restore = useRestoreSkill();
  const deleted = tab === SkillTabs.DELETED;
  return (
    <div className="card-lift flex flex-col rounded-[20px] border border-hairline bg-surface p-4 shadow-sticker">
      <button className="flex items-start gap-3 text-left" onClick={() => !deleted && navigate(Routes.skills.detail(skill.id))} disabled={deleted}>
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft text-2xl">{skill.emoji ?? <BookOpen className="h-6 w-6 text-accent-foreground" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-bold text-ink">{skill.name}</span>
          <span className="mt-0.5 inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">/{skill.slug}</span>
        </span>
      </button>
      <p className="mt-3 line-clamp-2 min-h-[40px] text-sm text-body">{skill.description}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {skill.is_starter ? <Badge variant="secondary">Starter</Badge> : <Badge variant="secondary">{getDropdownOptionLabel(SkillSharingOptions, skill.sharing_level)}</Badge>}
          {!skill.is_starter && <span className="text-xs text-muted-foreground">v{skill.current_version}</span>}
        </div>
        {skill.bots.length > 0 ? <BotAvatarStack bots={skill.bots} size={24} max={4} /> : <span className="text-xs text-muted-foreground">No bots yet</span>}
      </div>
      {skill.is_starter && (
        <Button className="mt-4 w-full" variant="outline" loading={add.isPending} onClick={() => add.mutate(skill.id, { onSuccess: (s) => navigate(Routes.skills.detail(s.id)) })}>
          <Plus /> Add to my skills
        </Button>
      )}
      {deleted && (
        <Button className="mt-4 w-full" variant="outline" loading={restore.isPending} onClick={() => restore.mutate(skill.id)}>
          <RotateCcw /> Restore {skill.deleted_at ? `(deleted ${timeAgo(skill.deleted_at)})` : ""}
        </Button>
      )}
    </div>
  );
};

const SkillsPage: FC = () => {
  const [tab, setTab] = useState<SkillTab>(SkillTabs.ALL);
  const [search, setSearch] = useState("");
  const { data: skills, isPending } = useSkills(tab, search || undefined);
  const importSkill = useImportSkill();
  const navigate = useNavigate();

  const onImport = async () => {
    const [file] = await platform.files.pick({ accept: ".json,application/json" });
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      importSkill.mutate(json.skill ?? json, { onSuccess: (s) => navigate(Routes.skills.detail(s.id)) });
    } catch {
      toast({ title: "That file isn't a skill", description: "Choose a skill file exported from Agent Space.", variant: "error" });
    }
  };

  return (
    <PageContainer wide>
      <PageHeader
        title="Skills"
        description="Reusable, step-by-step ways of doing a job. Give them to any bot, or mention one with /."
        actions={
          <>
            <Button variant="outline" onClick={onImport} loading={importSkill.isPending}>
              <Upload /> Import
            </Button>
            <Button onClick={() => navigate(Routes.skills.detail("new"))}>
              <Plus /> New skill
            </Button>
          </>
        }
      />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl ariaLabel="Filter skills" value={tab} options={SkillTabOptions} onChange={(v) => setTab(v as SkillTab)} />
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search skills" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search skills" />
        </div>
      </div>
      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-[20px]" />
          ))}
        </div>
      ) : !skills?.length ? (
        <EmptyState
          title={tab === SkillTabs.DELETED ? "Nothing deleted recently" : "Teach your bots a trick"}
          description={tab === SkillTabs.DELETED ? "Deleted skills can be restored here for 30 days." : "Capture how you do things here, so every bot does them the same way."}
          stickers={[{ icon: Wand2, color: "#6B4EFF" }, { icon: BookOpen, color: "#38B6FF" }, { icon: Handshake, color: "#1FC98E" }]}
          action={
            tab !== SkillTabs.DELETED && (
              <Button size="lg" onClick={() => navigate(Routes.skills.detail("new"))}>
                <Plus /> Create a skill
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {skills.map((s) => (
            <SkillCard key={s.id} skill={s} tab={tab} />
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default SkillsPage;
