import { useState, type FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, MessageCircle, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { SettingsCard, SettingRow } from "@/components/ui/setting-row";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { KnowledgePanel } from "@/components/layout/knowledge-panel";
import { ComputerTab } from "../../components/computer-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBot, useDeleteBot, useDuplicateBot } from "@/features/bots/hooks/use-bots";
import { useOpenDirect } from "@/features/conversations/hooks/use-conversations";
import { useCurrentOrganization } from "@/features/organizations/hooks/use-organizations";
import { botSoftColor } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { Routes } from "@/routes/routes";
import { AbilitiesTab, ApprovalsTab, BehaviourTab, ConnectionsTab, IdentityTab, MemoryTab, SharingTab, SkillsTab } from "../../components/bot-settings-tabs";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";

const TABS = [
  { id: "identity", label: "Identity" },
  { id: "behaviour", label: "Behaviour" },
  { id: "abilities", label: "Abilities" },
  { id: "connections", label: "Connections" },
  { id: "skills", label: "Skills" },
  { id: "knowledge", label: "Knowledge" },
  { id: "computer", label: "Computer" },
  { id: "approvals", label: "Approvals" },
  { id: "memory", label: "Memory" },
  { id: "sharing", label: "Sharing" },
  { id: "danger", label: "More" },
];

const BotDetailPage: FC = () => {
  const { botId = "" } = useParams();
  const { data: bot, isPending, isError } = useBot(botId);
  const { data: org } = useCurrentOrganization();
  const isAdmin = org?.my_role === OrgRoles.OWNER || org?.my_role === OrgRoles.ADMIN;
  const openDirect = useOpenDirect();
  const duplicate = useDuplicateBot();
  const del = useDeleteBot();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  if (isPending)
    return (
      <PageContainer>
        <div className="flex items-center gap-4">
          <Skeleton className="h-[88px] w-[88px] rounded-[28px]" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Skeleton className="mt-6 h-10 w-full max-w-xl rounded-full" />
        <Skeleton className="mt-4 h-80 w-full max-w-[720px] rounded-[20px]" />
      </PageContainer>
    );
  if (isError || !bot)
    return (
      <PageContainer>
        <EmptyState title="Bot not found" description="It may have been deleted, or you don't have access." action={<Button onClick={() => navigate(Routes.bots.root)}>Back to bots</Button>} />
      </PageContainer>
    );

  const props = { bot, isAdmin };
  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate(Routes.bots.root)}>
        <ArrowLeft /> Bots
      </Button>
      <div className="mb-6 flex flex-col gap-4 rounded-[28px] p-5 sm:flex-row sm:items-center" style={{ backgroundColor: botSoftColor(bot.color) }}>
        <BotAvatar emoji={bot.emoji} color={bot.color} name={bot.name} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[28px] font-bold leading-tight text-ink">{bot.name}</h1>
          <p className="text-[15px] text-body">{bot.description || "No description yet."}</p>
          <p className="mt-1 text-xs text-muted-foreground">{bot.model?.name ?? "Recommended model"} · created by {bot.created_by?.name ?? "someone"}</p>
        </div>
        <Button size="lg" loading={openDirect.isPending} onClick={() => openDirect.mutate({ bot_id: bot.id }, { onSuccess: (c) => navigate(Routes.chat.conversation(c.id)) })}>
          <MessageCircle /> Chat
        </Button>
      </div>

      <Tabs defaultValue="identity">
        <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-1">
          <TabsList className="w-max">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="mt-4 max-w-[720px]">
          <TabsContent value="identity"><IdentityTab {...props} /></TabsContent>
          <TabsContent value="behaviour"><BehaviourTab {...props} /></TabsContent>
          <TabsContent value="abilities"><AbilitiesTab {...props} /></TabsContent>
          <TabsContent value="connections"><ConnectionsTab {...props} /></TabsContent>
          <TabsContent value="skills"><SkillsTab {...props} /></TabsContent>
          <TabsContent value="knowledge"><KnowledgePanel botId={bot.id} canEdit={bot.can_edit} /></TabsContent>
          <TabsContent value="computer"><ComputerTab bot={bot} /></TabsContent>
          <TabsContent value="approvals"><ApprovalsTab {...props} /></TabsContent>
          <TabsContent value="memory"><MemoryTab {...props} /></TabsContent>
          <TabsContent value="sharing"><SharingTab {...props} /></TabsContent>
          <TabsContent value="danger">
            <SettingsCard title="More">
              <SettingRow label="Duplicate" description="Copy this bot as a starting point for a new one.">
                <Button variant="outline" loading={duplicate.isPending} onClick={() => duplicate.mutate(bot.id, { onSuccess: (b) => navigate(Routes.bots.detail(b.id)) })}>
                  <Copy /> Duplicate
                </Button>
              </SettingRow>
              {bot.can_edit && (
                <SettingRow label="Delete bot" description="Removes the bot from your chats. Past messages stay.">
                  <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete
                  </Button>
                </SettingRow>
              )}
            </SettingsCard>
          </TabsContent>
        </div>
      </Tabs>

      <ConfirmationDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${bot.name}?`}
        description="The bot will be removed from your chats. Past messages stay in conversations."
        confirmText="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => del.mutate(bot.id, { onSuccess: () => navigate(Routes.bots.root, { replace: true }) })}
      />
    </PageContainer>
  );
};

export default BotDetailPage;
