import { useState, type FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Plus, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useAddStarterSkill, useCreateSkill, useDeleteSkill, useExportSkill, useSkill, useUpdateSkill } from "@/features/skills/hooks/use-skills";
import { useCurrentOrganization } from "@/features/organizations/hooks/use-organizations";
import { platform } from "@/platform";
import { Routes } from "@/routes/routes";
import { SkillForm, toDto, toFormValues } from "../../components/skill-form";
import { GiveToBotsCard, SharingCard, SkillFilesCard, VersionsCard } from "../../components/skill-side-cards";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";
import { SkillRoles, NEW_SKILL_ID } from "@/features/skills/interfaces/skills.interfaces";
import { DEFAULT_SKILL_EMOJI } from "@/config/constants/dropdowns/shared/bot-colors.options";

const SkillDetailPage: FC = () => {
  const { skillId = "" } = useParams();
  const isNew = skillId === NEW_SKILL_ID;
  const { data: skill, isPending, isError } = useSkill(isNew ? "" : skillId);
  const { data: org } = useCurrentOrganization();
  const isAdmin = org?.my_role === OrgRoles.OWNER || org?.my_role === OrgRoles.ADMIN;
  const create = useCreateSkill();
  const update = useUpdateSkill();
  const del = useDeleteSkill();
  const addStarter = useAddStarterSkill();
  const exportSkill = useExportSkill();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  const back = (
    <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate(Routes.skills.root)}>
      <ArrowLeft /> Skills
    </Button>
  );

  if (isNew)
    return (
      <PageContainer>
        {back}
        <div className="max-w-[720px]">
          <SkillForm isNew defaultValues={toFormValues()} loading={create.isPending} onSubmit={(v) => create.mutate(toDto(v), { onSuccess: (s) => navigate(Routes.skills.detail(s.id), { replace: true }) })} />
        </div>
      </PageContainer>
    );

  if (isPending)
    return (
      <PageContainer>
        {back}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,720px)_1fr]">
          <Skeleton className="h-[600px] rounded-[20px]" />
          <Skeleton className="h-72 rounded-[20px]" />
        </div>
      </PageContainer>
    );

  if (isError || !skill)
    return (
      <PageContainer>
        {back}
        <EmptyState title="Skill not found" description="It may have been deleted or not shared with you." />
      </PageContainer>
    );

  const canEdit = !skill.is_starter && (skill.my_role === SkillRoles.OWNER || skill.my_role === SkillRoles.EDITOR);
  const isOwner = skill.my_role === SkillRoles.OWNER && !skill.is_starter;

  const onExport = () =>
    exportSkill.mutate(skill.id, {
      onSuccess: (data) => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        platform.files.download(url, `${skill.slug}.skill.json`);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
    });

  return (
    <PageContainer wide>
      {back}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="font-display mr-auto text-[28px] font-bold text-ink">
          {skill.emoji ?? DEFAULT_SKILL_EMOJI} {skill.name}
        </h1>
        {skill.is_starter ? (
          <Button loading={addStarter.isPending} onClick={() => addStarter.mutate(skill.id, { onSuccess: (s) => navigate(Routes.skills.detail(s.id)) })}>
            <Plus /> Add to my skills
          </Button>
        ) : (
          <Button variant="outline" onClick={onExport} loading={exportSkill.isPending}>
            <Download /> Export
          </Button>
        )}
        {isOwner && (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Delete
          </Button>
        )}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,720px)_minmax(280px,1fr)]">
        <SkillForm defaultValues={toFormValues(skill)} readOnly={!canEdit} loading={update.isPending} onSubmit={(v) => update.mutate({ id: skill.id, ...toDto(v) })} />
        <div className="space-y-4">
          {!skill.is_starter && <SkillFilesCard skill={skill} canEdit={canEdit} />}
          {!skill.is_starter && <GiveToBotsCard skill={skill} />}
          {isOwner && <SharingCard skill={skill} isAdmin={isAdmin} />}
          {!skill.is_starter && <VersionsCard skill={skill} canEdit={canEdit} />}
        </div>
      </div>
      <ConfirmationDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${skill.name}?`}
        description="It will be removed from all bots. You can restore it for 30 days."
        confirmText="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => del.mutate(skill.id, { onSuccess: () => navigate(Routes.skills.root, { replace: true }) })}
      />
    </PageContainer>
  );
};

export default SkillDetailPage;
