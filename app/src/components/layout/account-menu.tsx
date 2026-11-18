import { useState, type FC, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Moon, Settings, Sun } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";
import { useMe, useUpdateSettings } from "@/features/users/hooks/use-users";
import { useSignOut } from "@/features/auth/hooks/use-auth";
import { Themes } from "@/features/users/interfaces/users.interfaces";
import { Routes } from "@/routes/routes";
import { CreateOrganizationDialog, OrgSubmenu } from "./org-switcher";

interface AccountMenuProps {
  /** The element that opens the menu (rendered with `asChild`, so it must forward refs). */
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end";
}

/** Account menu: organisation switcher, settings, notifications, theme and sign out. Shared by the sidebar footer and the mobile Chats header. */
export const AccountMenu: FC<AccountMenuProps> = ({ children, side = "top", align = "start" }) => {
  const { data: me } = useMe();
  const { data: notifications } = useNotifications();
  const signOut = useSignOut();
  const updateSettings = useUpdateSettings({ silent: true });
  const navigate = useNavigate();
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const dark = me?.settings.theme === Themes.DARK || (me?.settings.theme === Themes.SYSTEM && document.documentElement.classList.contains("dark"));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent side={side} align={align} className="w-64 rounded-md p-1.5 shadow-pop">
          <OrgSubmenu onCreate={() => setCreateOrgOpen(true)} />
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 rounded-sm py-2" onSelect={() => navigate(Routes.settings.root)}>
            <Settings className="h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 rounded-sm py-2" onSelect={() => navigate(Routes.settings.notifications)}>
            <Bell className="h-4 w-4" /> Notifications {!!notifications?.unread && <span className="ml-auto text-xs font-bold text-primary">{notifications.unread} new</span>}
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 rounded-sm py-2" onSelect={() => updateSettings.mutate({ theme: dark ? Themes.LIGHT : Themes.DARK })}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {dark ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 rounded-sm py-2 text-error focus:text-error" onSelect={() => signOut.mutate()}>
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateOrganizationDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
    </>
  );
};
