import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-header";
import { useCompleteConnection } from "@/features/connections/hooks/use-connections";
import { Routes } from "@/routes/routes";
import { toast } from "@/hooks/use-toast";
import { ConnectionStatuses, ProviderCallbackStatuses } from "@/features/connections/interfaces/connections.interfaces";

type Result = { status: string; service_key: string; label: string; account_identifier: string | null } | null;

/**
 * Return address for service sign-ins (§14.1). Confirms the connection with the API, retrying briefly while it
 * activates, then opens the service's details page (accounts + tool permissions). Failures stay here.
 */
const ConnectionCallbackPage: FC = () => {
  const [params] = useSearchParams();
  const id = params.get("connection");
  const providerStatus = params.get("status");
  const complete = useCompleteConnection();
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!id) {
      setError("This link is missing the connection details.");
      return;
    }
    // mutateAsync, not mutate(…, { onSuccess }): React StrictMode remounts the page in development, which drops
    // per-call mutate callbacks, and the `started` guard stops the second mount from starting over — the page
    // then sat on the skeleton forever. A promise resolves regardless.
    const run = async () => {
      for (let attempt = 0; ; attempt++) {
        const r = await complete.mutateAsync(id);
        if (r.status === ConnectionStatuses.ACTIVE) {
          toast({ title: `${r.label} is connected`, description: r.account_identifier ?? undefined, duration: 2500 });
          navigate(Routes.connections.service(r.service_key), { replace: true });
          return;
        }
        if (attempt >= 5 || providerStatus === ProviderCallbackStatuses.FAILED) {
          setResult(r);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    };
    run().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const ok = result?.status === ConnectionStatuses.ACTIVE;
  return (
    <PageContainer className="flex min-h-[70dvh] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-8 text-center shadow-pop">
        {!result && !error ? (
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : ok ? (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" aria-hidden />
            <h1 className="font-display mt-4 text-2xl font-bold text-ink">{result!.label} is connected</h1>
            {result!.account_identifier && <p className="mt-1 text-muted-foreground">{result!.account_identifier}</p>}
            <p className="mt-3 text-sm text-body">Your bots can now use it. You can limit which bots use it in each bot's settings.</p>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto h-16 w-16 text-warning" aria-hidden />
            <h1 className="font-display mt-4 text-2xl font-bold text-ink">The connection didn't finish</h1>
            <p className="mt-2 text-sm text-body">{error ?? "The sign-in wasn't completed. You can try again from the Connections page."}</p>
          </>
        )}
        {(result || error) && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate(Routes.connections.root, { replace: true })}>Back to Connections</Button>
            {ok && (
              <Button variant="outline" onClick={() => navigate(Routes.chat.root, { replace: true })}>
                Start a chat
              </Button>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default ConnectionCallbackPage;
