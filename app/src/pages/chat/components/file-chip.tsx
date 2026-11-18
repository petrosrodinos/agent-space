import type { FC } from "react";
import { Download, FileText, Image as ImageIcon } from "lucide-react";
import { useFileUrl } from "@/features/files/hooks/use-files";
import { getFileUrl } from "@/features/files/services/files.services";
import { platform } from "@/platform";
import { toast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/date";
import { Skeleton } from "@/components/ui/skeleton";

interface FileRef {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
}

/** Download links are signed for the signed-in user and expire after 5 minutes (§7.7). */
async function download(f: FileRef) {
  try {
    const { url } = await getFileUrl(f.id, false);
    platform.files.download(url, f.filename);
  } catch (e) {
    toast({ title: "Could not download", description: (e as Error).message, variant: "error" });
  }
}

const ImagePreview: FC<{ f: FileRef }> = ({ f }) => {
  const { data, isPending } = useFileUrl(f.id, true);
  if (isPending) return <Skeleton className="h-40 w-56 rounded-[14px]" />;
  return (
    <button type="button" onClick={() => download(f)} className="block overflow-hidden rounded-[14px] border border-hairline" aria-label={`Download ${f.filename}`}>
      {data?.url ? <img src={data.url} alt={f.filename} className="max-h-64 max-w-[min(320px,70vw)] object-cover" loading="lazy" /> : <span className="block p-3 text-sm">{f.filename}</span>}
    </button>
  );
};

/** Colour context of the chip (inside a primary-coloured bubble or not). */
export const FileChipTones = { DEFAULT: "default", ON_PRIMARY: "onPrimary" } as const;
export type FileChipTone = (typeof FileChipTones)[keyof typeof FileChipTones];

export const FileChip: FC<{ file: FileRef; tone?: FileChipTone }> = ({ file, tone = FileChipTones.DEFAULT }) => {
  if (/^image\//.test(file.mimetype)) return <ImagePreview f={file} />;
  return (
    <button
      type="button"
      onClick={() => download(file)}
      className={
        tone === FileChipTones.ON_PRIMARY
          ? "inline-flex max-w-full items-center gap-2 rounded-[14px] bg-white/15 px-3 py-2 text-left text-sm text-white hover:bg-white/25"
          : "inline-flex max-w-full items-center gap-2.5 rounded-[14px] border border-hairline bg-surface px-3 py-2 text-left text-sm shadow-sticker hover:bg-surface-soft"
      }
    >
      {/^image\//.test(file.mimetype) ? <ImageIcon className="h-5 w-5 shrink-0" /> : <FileText className="h-5 w-5 shrink-0 text-primary" />}
      <span className="min-w-0">
        <span className="block truncate font-semibold">{file.filename}</span>
        <span className={tone === FileChipTones.ON_PRIMARY ? "text-xs text-white/70" : "text-xs text-muted-foreground"}>{formatBytes(file.size)}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </button>
  );
};
