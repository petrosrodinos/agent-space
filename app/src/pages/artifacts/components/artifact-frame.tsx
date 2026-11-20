import { useEffect, useRef, useState, type FC } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useArtifactViewUrl, useGrantArtifactData } from "@/features/artifacts/hooks/use-artifacts";
import { cn } from "@/lib/utils";

/** Messages between the sandboxed page's runtime (`agentspace.live`) and the app. */
const FrameMessages = { PERMISSION: "agentspace:permission", PERMISSION_RESULT: "agentspace:permission-result" } as const;

interface PermissionRequest {
  id: string;
  service: string;
  service_name: string;
}

/**
 * Live preview of an artifact (§7.5). The page comes from the isolated artifact host and runs in a sandboxed
 * iframe without `allow-same-origin`, so it can never reach the app, the viewer's session or other artifacts.
 * When the page asks for live data from a connected service the viewer hasn't allowed yet, the app (not the page)
 * asks the viewer, so the prompt can't be faked.
 */
export const ArtifactFrame: FC<{ artifactId: string; versionId?: string; rev?: string | number; title: string; className?: string }> = ({ artifactId, versionId, rev, title, className }) => {
  const { data, isPending, isError, error } = useArtifactViewUrl(artifactId, versionId, rev);
  const frame = useRef<HTMLIFrameElement>(null);
  const [request, setRequest] = useState<PermissionRequest | null>(null);
  const grant = useGrantArtifactData();

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (!frame.current || ev.source !== frame.current.contentWindow) return;
      const d = ev.data as Partial<PermissionRequest> & { type?: string };
      if (d?.type !== FrameMessages.PERMISSION || typeof d.id !== "string" || typeof d.service !== "string") return;
      setRequest({ id: d.id, service: d.service, service_name: String(d.service_name ?? d.service) });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const answer = (granted: boolean) => {
    if (request) frame.current?.contentWindow?.postMessage({ type: FrameMessages.PERMISSION_RESULT, id: request.id, granted }, "*");
    setRequest(null);
  };

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-surface", className)}>
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      {isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-6 w-6 text-error" />
          {(error as Error).message}
        </div>
      )}
      {data && (
        <iframe
          ref={frame}
          key={data.url}
          src={data.url}
          title={title}
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
          referrerPolicy="no-referrer"
          allow="clipboard-write"
        />
      )}
      <ConfirmationDialog
        isOpen={!!request}
        onClose={() => answer(false)}
        title={`Let "${title}" read your ${request?.service_name ?? ""} data?`}
        description={`It will show live information from your own ${request?.service_name ?? ""} account, only what you can already see. It can't send, change or delete anything. You can remove access in the artifact's Settings.`}
        confirmText="Allow"
        cancelText="Don't allow"
        isLoading={grant.isPending}
        onConfirm={() => request && grant.mutate({ id: artifactId, service: request.service }, { onSuccess: () => answer(true), onError: () => answer(false) })}
      />
    </div>
  );
};
