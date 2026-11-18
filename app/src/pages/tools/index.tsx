import type { FC } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ListGroup, ListRow } from "@/components/ui/list-group";
import { BadgeTones, useWorkspaceLinks } from "@/components/layout/workspace-links";
import { cn } from "@/lib/utils";

/** Tools (mobile, opened from the Chats grid button): every workspace page as a list with icon, title and description. */
const ToolsPage: FC = () => {
  const links = useWorkspaceLinks();

  return (
    <PageContainer className="max-w-[720px]">
      <PageHeader title="Tools" className="mb-5" />
      <ListGroup>
        {links.map(({ key, to, label, description, icon, badge, badgeTone }) => (
          <ListRow
            key={key}
            to={to}
            icon={icon}
            label={label}
            description={description}
            badge={
              !!badge && (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold",
                    badgeTone === BadgeTones.ATTENTION ? "bg-sunshine text-ink" : "bg-primary text-primary-foreground",
                  )}
                >
                  {badge}
                </span>
              )
            }
          />
        ))}
      </ListGroup>
    </PageContainer>
  );
};

export default ToolsPage;
