import { useState, type FC, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Brain, Copy, LibraryBig, MessageCircle, Monitor, MoreHorizontal, Pencil, Plug, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Wrench, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CircleButton } from "@/components/ui/circle-button";
import { Skeleton } from "@/components/ui/skeleton";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { KnowledgePanel } from "@/components/layout/knowledge-panel";
import { MobileTopBar, useBack } from "@/components/layout/mobile-top-bar";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ComputerTab } from "../../components/computer-tab";
import { useBot, useDeleteBot, useDuplicateBot } from "@/features/bots/hooks/use-bots";
import { useOpenDirect } from "@/features/conversations/hooks/use-conversations";
import { useCurrentOrganization } from "@/features/organizations/hooks/use-organizations";
import type { Bot } from "@/features/bots/interfaces/bots.interfaces";
import { Routes } from "@/routes/routes";
import { AbilitiesTab, ApprovalsTab, BehaviourTab, ConnectionsTab, IdentityTab, MemoryTab, SharingTab, SkillsTab } from "../../components/bot-settings-tabs";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";

const SECTION_PARAM = "section";

const BotSections = {
  IDENTITY: "identity",
  BEHAVIOUR: "behaviour",
  ABILITIES: "abilities",
  CONNECTIONS: "connections",
  SKILLS: "skills",
  KNOWLEDGE: "knowledge",
  COMPUTER: "computer",
  APPROVALS: "approvals",
  MEMORY: "memory",
  SHARING: "sharing",
} as const;
type BotSection = (typeof BotSections)[keyof typeof BotSections];

interface SectionDef {
  id: BotSection;
  label: string;
  icon: LucideIcon;
  /** Short status shown on the row, e.g. "3" or "On". */
  value?: (bot: Bot) => string | undefined;
}

const count = (n?: number) => (n ? String(n) : undefined);

/** Rows on the bot page, Grok-style: the bot's own stuff first, then configuration. Identity opens from the "Edit" pill. */
const MAIN_SECTIONS: SectionDef[] = [
  { id: BotSections.KNOWLEDGE, label: "Library", icon: LibraryBig, value: (b) => count(b._count?.knowledge_items) },
  { id: BotSections.COMPUTER, label: "Computer", icon: Monitor, value: (b) => (b.cloud_computer_enabled ? "On" : "Off") },
];
const CONFIGURE_SECTIONS: SectionDef[] = [
  { id: BotSections.BEHAVIOUR, label: "Behaviour", icon: SlidersHorizontal },
  { id: BotSections.ABILITIES, label: "Abilities", icon: Wrench },
  { id: BotSections.CONNECTIONS, label: "Connections", icon: Plug, value: (b) => count(b._count?.bot_connections) },
  { id: BotSections.SKILLS, label: "Skills", icon: Sparkles, value: (b) => count(b._count?.bot_skills) },
  { id: BotSections.APPROVALS, label: "Approvals", icon: ShieldCheck },
  { id: BotSections.MEMORY, label: "Memory", icon: Brain, value: (b) => count(b._count?.memories) },
  { id: BotSections.SHARING, label: "Sharing", icon: Share2 },
];
const SECTION_LABELS: Record<BotSection, string> = { ...Object.fromEntries([...MAIN_SECTIONS, ...CONFIGURE_SECTIONS].map((s) => [s.id, s.label])), [BotSections.IDENTITY]: "Edit bot" } as Record<BotSection, string>;
/** Desktop side navigation (same layout as Settings): identity first, then the bot's own stuff. */
const DESKTOP_MAIN_SECTIONS: SectionDef[] = [{ id: BotSections.IDENTITY, label: "Identity", icon: Pencil }, ...MAIN_SECTIONS];
const DESKTOP_LABELS: Record<BotSection, string> = { ...SECTION_LABELS, [BotSections.IDENTITY]: "Identity" };
const isBotSection = (v: string | null): v is BotSection => !!v && Object.values(BotSections).includes(v as BotSection);

const SectionBody: FC<{ section: BotSection; bot: Bot; isAdmin: boolean }> = ({ section, bot, isAdmin }) => {
  const props = { bot, isAdmin };
  switch (section) {
    case BotSections.IDENTITY:
      return <IdentityTab {...props} />;
    case BotSections.BEHAVIOUR:
      return <BehaviourTab {...props} />;
    case BotSections.ABILITIES:
      return <AbilitiesTab {...props} />;
    case BotSections.CONNECTIONS:
      return <ConnectionsTab {...props} />;
    case BotSections.SKILLS:
      return <SkillsTab {...props} />;
    case BotSections.KNOWLEDGE:
      return <KnowledgePanel botId={bot.id} canEdit={bot.can_edit} />;
    case BotSections.COMPUTER:
      return <ComputerTab bot={bot} />;
    case BotSections.APPROVALS:
      return <ApprovalsTab {...props} />;
    case BotSections.MEMORY:
      return <MemoryTab {...props} />;
    case BotSections.SHARING:
      return <SharingTab {...props} />;
  }
};

/** Desktop nav group, styled like the Settings side navigation. */
const BotNavList: FC<{ sections: SectionDef[]; title: string; bot: Bot; active: BotSection; onSelect: (id: BotSection) => void }> = ({ sections, title, bot, active, onSelect }) => (
  <div>
    <p className="eyebrow mb-1 px-3">{title}</p>
    <nav className="space-y-0.5">
      {sections.map((s) => {
        const value = s.value?.(bot);
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-bold [&_svg]:h-5 [&_svg]:w-5",
              isActive ? "bg-primary-soft text-accent-foreground" : "text-body hover:bg-surface-sunken",
            )}
          >
            <s.icon />
            <span className="flex-1">{s.label}</span>
            {value && <span className="text-sm font-medium text-muted-foreground">{value}</span>}
          </button>
        );
      })}
    </nav>
  </div>
);

/** Duplicate / delete menu shared by the mobile and desktop layouts. */
const BotMenu: FC<{ bot: Bot; onDuplicate: () => void; onDelete: () => void }> = ({ bot, onDuplicate, onDelete }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <CircleButton aria-label="Bot menu">
        <MoreHorizontal />
      </CircleButton>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56 rounded-md p-1.5 shadow-pop">
      <DropdownMenuItem className="gap-2 rounded-sm py-2" onSelect={onDuplicate}>
        <Copy className="h-4 w-4" /> Duplicate
      </DropdownMenuItem>
      {bot.can_edit && !bot.is_starter && (
        <DropdownMenuItem className="gap-2 rounded-sm py-2 text-error focus:text-error" onSelect={onDelete}>
          <Trash2 className="h-4 w-4" /> Delete bot
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const Frame: FC<{ children: ReactNode; wide?: boolean }> = ({ children, wide }) => <div className={wide ? "mx-auto w-full max-w-[760px] px-4 pb-10" : "mx-auto w-full max-w-[600px] px-4 pb-10"}>{children}</div>;

/** Bot page (Grok-style): big avatar, name, Chat / Edit pills and grouped rows; each row opens its settings section. */
const BotDetailPage: FC = () => {
  const { botId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const sectionParam = params.get(SECTION_PARAM);
  const section = isBotSection(sectionParam) ? sectionParam : null;
  const { data: bot, isPending, isError } = useBot(botId);
  const { data: org } = useCurrentOrganization();
  const isAdmin = org?.my_role === OrgRoles.OWNER || org?.my_role === OrgRoles.ADMIN;
  const openDirect = useOpenDirect();
  const duplicate = useDuplicateBot();
  const del = useDeleteBot();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();
  const backToOverview = useBack(Routes.bots.detail(botId));
  const isMobile = useIsMobile();
  const openSection = (id: BotSection) => setParams({ [SECTION_PARAM]: id });
  const startChat = (id: string) => openDirect.mutate({ bot_id: id }, { onSuccess: (c) => navigate(Routes.chat.conversation(c.id)) });
  const onDuplicate = (id: string) => duplicate.mutate(id, { onSuccess: (b) => navigate(Routes.bots.detail(b.id)) });

  if (isPending)
    return (
      <>
        <MobileTopBar />
        <Frame>
          <div className="flex flex-col items-center gap-3 pt-2">
            <Skeleton className="h-[120px] w-[120px] rounded-2xl" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-40 rounded-full" />
          </div>
          <Skeleton className="mt-8 h-28 w-full rounded-lg" />
          <Skeleton className="mt-6 h-72 w-full rounded-lg" />
        </Frame>
      </>
    );
  if (isError || !bot)
    return (
      <>
        <MobileTopBar />
        <EmptyState title="Bot not found" description="It may have been deleted, or you don't have access." action={<Button onClick={() => navigate(Routes.bots.root)}>Back to bots</Button>} />
      </>
    );

  const deleteDialog = (
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
  );
  const menu = <BotMenu bot={bot} onDuplicate={() => onDuplicate(bot.id)} onDelete={() => setConfirmDelete(true)} />;

  // Desktop: Settings-style layout — side navigation on the left, the open section on the right.
  if (!isMobile) {
    const active = section ?? BotSections.IDENTITY;
    return (
      <PageContainer wide>
        <PageHeader title={DESKTOP_LABELS[active]} className="mb-5" backTo={Routes.bots.root} />
        <div className="flex gap-8">
          <aside className="w-60 shrink-0 space-y-5">
            <div className="space-y-3 px-3">
              <div className="flex items-center gap-3">
                <BotAvatar seed={bot.avatar_seed} color={bot.color} name={bot.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold text-ink">{bot.name}</p>
                  {bot.description && <p className="truncate text-sm text-muted-foreground">{bot.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button className="flex-1" loading={openDirect.isPending} onClick={() => startChat(bot.id)}>
                  <MessageCircle /> Chat
                </Button>
                {menu}
              </div>
            </div>
            <BotNavList sections={DESKTOP_MAIN_SECTIONS} title="Bot" bot={bot} active={active} onSelect={openSection} />
            <BotNavList sections={CONFIGURE_SECTIONS} title="Configure bot" bot={bot} active={active} onSelect={openSection} />
            <p className="px-3 text-xs text-muted-foreground">{`${bot.model?.name ?? "Recommended model"} · created by ${bot.created_by?.name ?? "someone"}`}</p>
          </aside>
          <div className="min-w-0 max-w-[720px] flex-1">
            <SectionBody section={active} bot={bot} isAdmin={isAdmin} />
          </div>
        </div>
        {deleteDialog}
      </PageContainer>
    );
  }

  if (section)
    return (
      <>
        <MobileTopBar
          onBack={backToOverview}
          center={
            <span className="flex h-11 min-w-0 items-center gap-2 rounded-full border border-hairline bg-surface-sunken py-1 pl-1.5 pr-4 shadow-sticker">
              <BotAvatar seed={bot.avatar_seed} color={bot.color} name={bot.name} size={32} className="rounded-full" />
              <span className="truncate text-[16px] font-bold text-ink">{SECTION_LABELS[section]}</span>
            </span>
          }
        />
        <Frame wide>
          <SectionBody section={section} bot={bot} isAdmin={isAdmin} />
        </Frame>
      </>
    );

  return (
    <>
      <MobileTopBar
        actions={menu}
      />
      <Frame>
        <div className="flex flex-col items-center text-center">
          <BotAvatar seed={bot.avatar_seed} color={bot.color} name={bot.name} size={120} followCursor />
          <h1 className="mt-4 font-display text-[30px] font-bold leading-tight text-ink">{bot.name}</h1>
          {bot.description && <p className="mt-1 max-w-md text-[15px] text-muted-foreground">{bot.description}</p>}
          <div className="mt-4 flex gap-2">
            <Button loading={openDirect.isPending} onClick={() => startChat(bot.id)}>
              <MessageCircle /> Chat
            </Button>
            <Button variant="secondary" onClick={() => openSection(BotSections.IDENTITY)}>
              Edit
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <ListGroup>
            {MAIN_SECTIONS.map((s) => (
              <ListRow key={s.id} icon={s.icon} label={s.label} value={s.value?.(bot)} onClick={() => openSection(s.id)} />
            ))}
          </ListGroup>
          <ListGroup title="Configure bot" footer={`${bot.model?.name ?? "Recommended model"} · created by ${bot.created_by?.name ?? "someone"}`}>
            {CONFIGURE_SECTIONS.map((s) => (
              <ListRow key={s.id} icon={s.icon} label={s.label} value={s.value?.(bot)} onClick={() => openSection(s.id)} />
            ))}
          </ListGroup>
        </div>
      </Frame>

      {deleteDialog}
    </>
  );
};

export default BotDetailPage;
