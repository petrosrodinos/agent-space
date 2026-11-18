import { type FC } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useArtifactViewUrl } from "@/features/artifacts/hooks/use-artifacts";
import { cn } from "@/lib/utils";

/**
 * Live preview of an artifact (§7.5). The page comes from the isolated artifact host and runs in a sandboxed
 * iframe without `allow-same-origin`, so it can never reach the app, the viewer's session or other artifacts.
 */
export const ArtifactFrame: FC<{ artifactId: string; versionId?: string; rev?: string | number; title: string; className?: string }> = ({ artifactId, versionId, rev, title, className }) => {
  const { data, isPending, isError, error } = useArtifactViewUrl(artifactId, versionId, rev);
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
          key={data.url}
          src={data.url}
          title={title}
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
          referrerPolicy="no-referrer"
          allow="clipboard-write"
        />
      )}
    </div>
  );
};
