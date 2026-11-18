import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-header";
import { useCompleteToolServerSignIn } from "@/features/tool-servers/hooks/use-tool-servers";
import type { ToolServer } from "@/features/tool-servers/interfaces/tool-servers.interfaces";
import { Routes } from "@/routes/routes";
import { ToolServerStatuses } from "@/features/tool-servers/interfaces/tool-servers.interfaces";

/** Return address for a custom tool server's own sign-in (standard MCP sign-in, §8.4). */
const ToolServerCallbackPage: FC = () => {
  const [params] = useSearchParams();
  const code = params.get("code");
  const state = params.get("state");
  const providerError = params.get("error_description") || params.get("error");
  const complete = useCompleteToolServerSignIn();
  const [server, setServer] = useState<ToolServer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (providerError) return setError(`The sign-in was cancelled or refused: ${providerError}`);
    if (!code || !state) return setError("This link is missing the sign-in details.");
    complete.mutate({ code, state }, { onSuccess: setServer, onError: (e) => setError(e.message) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, state, providerError]);

  const ok = server?.status === ToolServerStatuses.ACTIVE;
  return (
    <PageContainer className="flex min-h-[70dvh] items-center justify-center">
      <div className="w-full max-w-md rounded-[28px] border border-hairline bg-surface p-8 text-center shadow-pop">
        {!server && !error ? (
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : ok ? (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" aria-hidden />
            <h1 className="font-display mt-4 text-2xl font-bold text-ink">{server!.name} is connected</h1>
            <p className="mt-3 text-sm text-body">
              {server!.tool_count} {server!.tool_count === 1 ? "tool is" : "tools are"} now available to your bots.
            </p>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto h-16 w-16 text-warning" aria-hidden />
            <h1 className="font-display mt-4 text-2xl font-bold text-ink">{server ? `Signed in to ${server.name}, but it isn't working yet` : "The sign-in didn't finish"}</h1>
            <p className="mt-2 text-sm text-body">{error ?? server?.status_message ?? "You can try again from the Connections page."}</p>
          </>
        )}
        {(server || error) && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate(Routes.connections.root, { replace: true })}>Back to Connections</Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default ToolServerCallbackPage;
