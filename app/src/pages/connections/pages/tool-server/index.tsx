import { useEffect, useRef, type FC, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, LogIn, RefreshCw, Wrench } from "lucide-react";
import { PageContainer } from "@/components/ui/page-header";
import { BackButton } from "@/components/layout/mobile-top-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { useStartToolServerSignIn, useTestToolServer, useToolServer } from "@/features/tool-servers/hooks/use-tool-servers";
import { ToolServerAuthKinds, ToolServerStatuses } from "@/features/tool-servers/interfaces/tool-servers.interfaces";
import { Visibilities } from "@/features/connections/interfaces/connections.interfaces";
import { ConnectionStatusOptions } from "@/config/constants/dropdowns/shared/status.options";
import { ToolServerAuthOptions } from "@/config/constants/dropdowns/connections/tool-server.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { timeAgo } from "@/lib/date";
import { platform } from "@/platform";
import { Routes } from "@/routes/routes";

const Card: FC<{ children: ReactNode }> = ({ children }) => <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-sticker">{children}</div>;
const SectionTitle: FC<{ title: string; count?: number }> = ({ title, count }) => (
  <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-muted-foreground">
    {title}
    {count !== undefined && <span className="ml-1.5 font-normal">{count}</span>}
  </h2>
);
const InfoRow: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-3 text-sm last:border-b-0">
    <span className="font-semibold text-ink">{label}</span>
    <span className="min-w-0 truncate text-right text-muted-foreground">{children}</span>
  </div>
);

/** Custom tool server details (§8.4): connection info, who can use it, and the tools it offers. */
const ToolServerPage: FC = () => {
  const { toolServerId = "" } = useParams();
  const navigate = useNavigate();
  const { data: s, isPending, isError } = useToolServer(toolServerId);
  const test = useTestToolServer();
  const signIn = useStartToolServerSignIn();
  const loaded = useRef(false);

  // The tool list is not stored; ask the server for it once when the page opens.
  useEffect(() => {
    if (s && s.status === ToolServerStatuses.ACTIVE && !loaded.current) {
      loaded.current = true;
      test.mutate(s.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.id, s?.status]);

  const back = (
    <>
      <Button variant="ghost" size="sm" className="mb-3 hidden md:inline-flex" onClick={() => navigate(Routes.connections.root)}>
        <ArrowLeft /> Connections
      </Button>
      <div className="mb-3 md:hidden">
        <BackButton fallback={Routes.connections.root} />
      </div>
    </>
  );

  if (isPending) {
    return (
      <PageContainer>
        {back}
        <div className="max-w-[760px] space-y-6">
          <Skeleton className="h-14 w-72" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </PageContainer>
    );
  }
  if (isError || !s) {
    return (
      <PageContainer>
        {back}
        <EmptyState title="Tool server not found" description="It may have been removed or isn't shared with you." action={<Button onClick={() => navigate(Routes.connections.root)}>Back to Connections</Button>} />
      </PageContainer>
    );
  }

  const tools = test.data?.tools ?? [];
  const tone = s.status === ToolServerStatuses.ACTIVE ? "success" : s.status === ToolServerStatuses.ERROR ? "error" : "warning";
  const startSignIn = () => signIn.mutate(s.id, { onSuccess: (r) => r.authorization_url && platform.links.redirect(r.authorization_url) });

  return (
    <PageContainer>
      {back}
      <div className="max-w-[760px] space-y-8">
        <header>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary-soft text-accent-foreground">
                <Wrench className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{s.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusPill tone={tone}>{getDropdownOptionLabel(ConnectionStatusOptions, s.status)}</StatusPill>
                  {s.visibility === Visibilities.SHARED && <Badge variant="secondary">Shared</Badge>}
                </div>
              </div>
            </div>
            {s.can_manage && (
              <div className="flex flex-wrap gap-2">
                {s.auth_kind === ToolServerAuthKinds.OAUTH && (
                  <Button variant="outline" loading={signIn.isPending} onClick={startSignIn}>
                    <LogIn /> Sign in{s.status === ToolServerStatuses.ACTIVE ? " again" : ""}
                  </Button>
                )}
                <Button variant="outline" loading={test.isPending} onClick={() => test.mutate(s.id)}>
                  <RefreshCw /> Test connection
                </Button>
              </div>
            )}
          </div>
          {s.status !== ToolServerStatuses.ACTIVE && s.status_message && <p className="mt-3 text-[15px] text-body">{s.status_message}</p>}
        </header>

        <section>
          <SectionTitle title="Tools" count={tools.length || undefined} />
          <Card>
            {test.isPending ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : tools.length ? (
              tools.map((t) => (
                <div key={t.name} className="border-b border-hairline px-4 py-3 last:border-b-0">
                  <p className="break-all font-mono text-sm font-semibold text-ink">{t.name}</p>
                  {t.description && <p className="mt-0.5 text-[13px] text-muted-foreground">{t.description}</p>}
                </div>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {s.status === ToolServerStatuses.ACTIVE ? (test.data?.error ?? "This server lists no tools.") : "Tools appear once the server is connected."}
              </p>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle title="Bots" />
          <Card>
            {s.bots.length ? (
              s.bots.map((b) => (
                <div key={b.id} className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0">
                  <BotAvatar seed={b.avatar_seed} color={b.color} size={32} name={b.name} />
                  <span className="font-semibold text-ink">{b.name}</span>
                </div>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">All bots can use this server's tools.</p>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle title="Information" />
          <Card>
            <InfoRow label="Address">{s.url}</InfoRow>
            <InfoRow label="Sign-in">
              {getDropdownOptionLabel(ToolServerAuthOptions, s.auth_kind)}
              {s.masked_hint ? ` ${s.masked_hint}` : ""}
            </InfoRow>
            <InfoRow label="Tools">{s.tool_count}</InfoRow>
            {s.last_listed_at && <InfoRow label="Last checked">{timeAgo(s.last_listed_at)}</InfoRow>}
            <InfoRow label="Added by">{s.owner?.name ?? s.owner?.email ?? "Unknown"}</InfoRow>
            <InfoRow label="Added">{timeAgo(s.created_at)}</InfoRow>
          </Card>
        </section>
      </div>
    </PageContainer>
  );
};

export default ToolServerPage;
