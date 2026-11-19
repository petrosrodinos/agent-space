import { useState, type FC } from "react";
import { Download, FileText, Image as ImageIcon } from "lucide-react";
import { useFileUrl } from "@/features/files/hooks/use-files";
import { getFileUrl } from "@/features/files/services/files.services";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/date";
import { Skeleton } from "@/components/ui/skeleton";
import { FilePreviewDialog, type PreviewFileRef } from "./file-preview-dialog";

type FileRef = PreviewFileRef;

/** Download links are signed for the signed-in user and expire after 5 minutes (§7.7). */
async function download(f: FileRef) {
  try {
    const { url } = await getFileUrl(f.id, false);
    platform.files.download(url, f.filename);
  } catch (e) {
    toast({ title: "Could not download", description: (e as Error).message, variant: "error" });
  }
}

const ImageThumb: FC<{ f: FileRef; onOpen: () => void }> = ({ f, onOpen }) => {
  const { data, isPending } = useFileUrl(f.id, true);
  if (isPending) return <Skeleton className="h-40 w-56 rounded-md" />;
  return (
    <button type="button" onClick={onOpen} className="block overflow-hidden rounded-md border border-hairline" aria-label={`Preview ${f.filename}`}>
      {data?.url ? <img src={data.url} alt={f.filename} className="max-h-64 max-w-[min(320px,70vw)] object-cover" loading="lazy" /> : <span className="block p-3 text-sm">{f.filename}</span>}
    </button>
  );
};

/** Colour context of the chip (inside a primary-coloured bubble or not). */
export const FileChipTones = { DEFAULT: "default", ON_PRIMARY: "onPrimary" } as const;
export type FileChipTone = (typeof FileChipTones)[keyof typeof FileChipTones];

/** Clicking a file opens an in-app preview; the download icon saves it. */
export const FileChip: FC<{ file: FileRef; tone?: FileChipTone }> = ({ file, tone = FileChipTones.DEFAULT }) => {
  const [open, setOpen] = useState(false);
  const isImage = /^image\//.test(file.mimetype) && file.mimetype !== "image/svg+xml";
  const onPrimary = tone === FileChipTones.ON_PRIMARY;

  return (
    <>
      {isImage ? (
        <ImageThumb f={file} onOpen={() => setOpen(true)} />
      ) : (
        <div
          className={
            onPrimary
              ? "inline-flex max-w-full items-center gap-1 rounded-md bg-white/15 text-sm text-white hover:bg-white/25"
              : "inline-flex max-w-full items-center gap-1 rounded-md border border-hairline bg-surface text-sm shadow-sticker hover:bg-surface-soft"
          }
        >
          <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 items-center gap-2.5 py-2 pl-3 text-left" aria-label={`Preview ${file.filename}`}>
            {/^image\//.test(file.mimetype) ? <ImageIcon className="h-5 w-5 shrink-0" /> : <FileText className={onPrimary ? "h-5 w-5 shrink-0" : "h-5 w-5 shrink-0 text-primary"} />}
            <span className="min-w-0">
              <span className="block truncate font-semibold">{file.filename}</span>
              <span className={onPrimary ? "text-xs text-white/70" : "text-xs text-muted-foreground"}>{formatBytes(file.size)}</span>
            </span>
          </button>
          <button type="button" onClick={() => download(file)} className="shrink-0 rounded-md p-2 pr-3 opacity-70 hover:opacity-100" aria-label={`Download ${file.filename}`}>
            <Download className="h-4 w-4" />
          </button>
        </div>
      )}
      <FilePreviewDialog file={file} open={open} onOpenChange={setOpen} onDownload={() => download(file)} />
    </>
  );
};
