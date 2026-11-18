import { useEffect, type FC, type ReactNode } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Activity, BarChart3, Bell, BookOpen, Brain, Building2, Cpu, Download, LogOut, MessageSquareText, Monitor, Palette, ShieldAlert, ShieldCheck, UserRound, Users, type LucideIcon } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ListGroup, ListRow, ListRowTones } from "@/components/ui/list-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/features/organizations/hooks/use-organizations";
import { useSignOut } from "@/features/auth/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInstallApp } from "@/hooks/use-install-app";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { KnowledgePanel } from "@/components/layout/knowledge-panel";
import { AppearanceSection, DevicesSection, MemorySection, NotificationsSection, ProfileSection, RepliesSection, SecuritySection } from "./components/personal-sections";
import { ActivitySection, AiModelsSection, DangerSection, MembersSection, OrganizationSection, SafetySection, UsageSection } from "./components/org-sections";
import { OrgRoles } from "@/features/users/interfaces/users.interfaces";

const SettingsSections = {
  PROFILE: "profile",
  APPEARANCE: "appearance",
  REPLIES: "replies",
  NOTIFICATIONS: "notifications",
  MEMORY: "memory",
  SECURITY: "security",
  DEVICES: "devices",
  ORGANIZATION: "organization",
  MEMBERS: "members",
  KNOWLEDGE: "knowledge",
  AI_MODELS: "ai-models",
  SAFETY: "safety",
  USAGE: "usage",
  ACTIVITY: "activity",
  DANGER: "danger",
} as const;

type Section = { id: string; path: string; label: string; icon: LucideIcon; admin?: boolean };

const PERSONAL: Section[] = [
  { id: SettingsSections.PROFILE, path: Routes.settings.profile, label: "Profile", icon: UserRound },
  { id: SettingsSections.APPEARANCE, path: Routes.settings.appearance, label: "Appearance", icon: Palette },
  { id: SettingsSections.REPLIES, path: Routes.settings.replies, label: "Replies & chat", icon: MessageSquareText },
  { id: SettingsSections.NOTIFICATIONS, path: Routes.settings.notifications, label: "Notifications", icon: Bell },
  { id: SettingsSections.MEMORY, path: Routes.settings.memory, label: "Memory & data", icon: Brain },
  { id: SettingsSections.SECURITY, path: Routes.settings.security, label: "Security", icon: ShieldCheck },
  { id: SettingsSections.DEVICES, path: Routes.settings.devices, label: "Devices", icon: Monitor },
];

const ORGANISATION: Section[] = [
  { id: SettingsSections.ORGANIZATION, path: Routes.settings.organization, label: "General", icon: Building2, admin: true },
  { id: SettingsSections.MEMBERS, path: Routes.settings.members, label: "Members", icon: Users },
  { id: SettingsSections.KNOWLEDGE, path: Routes.settings.knowledge, label: "Knowledge library", icon: BookOpen },
  { id: SettingsSections.AI_MODELS, path: Routes.settings.ai_models, label: "AI models", icon: Cpu, admin: true },
  { id: SettingsSections.SAFETY, path: Routes.settings.safety, label: "Approvals & safety", icon: ShieldAlert, admin: true },
  { id: SettingsSections.USAGE, path: Routes.settings.usage, label: "Usage", icon: BarChart3 },
  { id: SettingsSections.ACTIVITY, path: Routes.settings.activity, label: "Activity history", icon: Activity, admin: true },
  { id: SettingsSections.DANGER, path: Routes.settings.danger, label: "Leave or delete", icon: LogOut },
];

/** Desktop side navigation. */
const NavList: FC<{ sections: Section[]; title: string }> = ({ sections, title }) => (
  <div>
    <p className="eyebrow mb-1 px-3">{title}</p>
    <nav className="space-y-0.5">
      {sections.map((s) => (
        <NavLink
          key={s.id}
          to={s.path}
          className={({ isActive }) =>
            cn("flex min-h-[44px] items-center gap-3 rounded-md px-3 text-[15px] font-bold [&_svg]:h-5 [&_svg]:w-5", isActive ? "bg-primary-soft text-accent-foreground" : "text-body hover:bg-surface-sunken")
          }
        >
          <s.icon />
          <span className="flex-1">{s.label}</span>
        </NavLink>
      ))}
    </nav>
  </div>
);

/** Mobile category list (Grok-style grouped card). */
const SectionGroup: FC<{ sections: Section[]; title: string }> = ({ sections, title }) => (
  <ListGroup title={title}>
    {sections.map((s) => (
      <ListRow key={s.id} icon={s.icon} label={s.label} to={s.path} />
    ))}
  </ListGroup>
);

const SettingsPage: FC = () => {
  const { section } = useParams();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { data: org, isPending } = useCurrentOrganization();
  const signOut = useSignOut();
  const installApp = useInstallApp();
  const isAdmin = org?.my_role === OrgRoles.OWNER || org?.my_role === OrgRoles.ADMIN;
  const orgSections = ORGANISATION.filter((s) => !s.admin || isAdmin);

  useEffect(() => {
    if (!section && !isMobile) navigate(Routes.settings.profile, { replace: true });
  }, [section, isMobile, navigate]);

  const all = [...PERSONAL, ...ORGANISATION];
  const current = all.find((s) => s.id === section);
  const blocked = current?.admin && org && !isAdmin;

  let body: ReactNode = null;
  if (isPending || !org) body = <Skeleton className="h-80 rounded-lg" />;
  else if (blocked) body = <p className="rounded-lg border border-hairline bg-surface p-6 text-muted-foreground">Only Owners and Admins can change these settings.</p>;
  else
    switch (section) {
      case SettingsSections.PROFILE:
        body = <ProfileSection />;
        break;
      case SettingsSections.APPEARANCE:
        body = <AppearanceSection />;
        break;
      case SettingsSections.REPLIES:
        body = <RepliesSection />;
        break;
      case SettingsSections.NOTIFICATIONS:
        body = <NotificationsSection />;
        break;
      case SettingsSections.MEMORY:
        body = <MemorySection isAdmin={isAdmin} />;
        break;
      case SettingsSections.SECURITY:
        body = <SecuritySection />;
        break;
      case SettingsSections.DEVICES:
        body = <DevicesSection />;
        break;
      case SettingsSections.ORGANIZATION:
        body = <OrganizationSection />;
        break;
      case SettingsSections.MEMBERS:
        body = <MembersSection org={org} />;
        break;
      case SettingsSections.KNOWLEDGE:
        body = <KnowledgePanel botId={null} canEdit={isAdmin} title="Knowledge library" description="Company documents, pages and notes that every bot with “Organisation knowledge” turned on can search and read." />;
        break;
      case SettingsSections.AI_MODELS:
        body = <AiModelsSection />;
        break;
      case SettingsSections.SAFETY:
        body = <SafetySection />;
        break;
      case SettingsSections.USAGE:
        body = <UsageSection isAdmin={isAdmin} />;
        break;
      case SettingsSections.ACTIVITY:
        body = <ActivitySection />;
        break;
      case SettingsSections.DANGER:
        body = <DangerSection org={org} onLeft={() => navigate(Routes.chat.root, { replace: true })} />;
        break;
      default:
        body = null;
    }

  // Mobile with no section: show the category list.
  if (isMobile && !section)
    return (
      <PageContainer>
        <PageHeader title="Settings" className="mb-5" backTo={Routes.chat.root} />
        <div className="space-y-5">
          <SectionGroup sections={PERSONAL} title="You" />
          <SectionGroup sections={orgSections} title={org?.name ?? "Organisation"} />
          {installApp.available && (
            <ListGroup>
              <ListRow
                icon={Download}
                label="Install the app"
                description="Add Agent Space to your home screen"
                onClick={() => void installApp.install()}
              />
            </ListGroup>
          )}
          <ListGroup>
            <ListRow icon={LogOut} label="Sign out" onClick={() => signOut.mutate()} tone={ListRowTones.DESTRUCTIVE} />
          </ListGroup>
        </div>
      </PageContainer>
    );

  return (
    <PageContainer wide>
      <PageHeader title={current?.label ?? "Settings"} className="mb-5" backTo={Routes.settings.root} />
      <div className="flex gap-8">
        <aside className="hidden w-60 shrink-0 space-y-5 md:block">
          <NavList sections={PERSONAL} title="You" />
          <NavList sections={orgSections} title={org?.name ?? "Organisation"} />
        </aside>
        <div className="min-w-0 max-w-[720px] flex-1">{body}</div>
      </div>
    </PageContainer>
  );
};

export default SettingsPage;
