import type { FC } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

const ACTION_BUTTON_CLASS = "h-10 w-10 shrink-0 rounded-full";

/**
 * Round Search + "+" buttons shared by the sidebar header and the Chats page header.
 * "+" opens the two-step new-chat modal. `vertical` stacks them for the icon rail.
 */
export const ChatActions: FC<{ vertical?: boolean; onSelect?: () => void; className?: string }> = ({ vertical, onSelect, className }) => {
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const openNewChat = useUiStore((s) => s.openNewChat);
  const actions = [
    { label: "Search (Ctrl+K)", icon: <Search />, run: () => setCommandOpen(true) },
    { label: "New bot or group", icon: <Plus />, run: () => openNewChat() },
  ];

  return (
    <div className={cn("flex items-center gap-2", vertical && "flex-col", className)}>
      {actions.map(({ label, icon, run }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className={ACTION_BUTTON_CLASS}
              onClick={() => {
                run();
                onSelect?.();
              }}
              aria-label={label}
            >
              {icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={vertical ? "right" : "bottom"}>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};
