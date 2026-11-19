import { useMemo, type FC } from "react";
import { Download, FileQuestion } from "lucide-react";
import { useFileSheets, useFileText, useFileUrl } from "@/features/files/hooks/use-files";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/date";

export interface PreviewFileRef {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
}

/** How a file is rendered inside the preview dialog. */
export const PreviewKinds = {
  IMAGE: "image",
  PDF: "pdf",
  VIDEO: "video",
  AUDIO: "audio",
  HTML: "html",
  MARKDOWN: "markdown",
  CSV: "csv",
  SPREADSHEET: "spreadsheet",
  TEXT: "text",
  NONE: "none",
} as const;
export type PreviewKind = (typeof PreviewKinds)[keyof typeof PreviewKinds];

const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";
const TEXT_EXT = new Set(["txt", "log", "json", "jsonl", "xml", "yaml", "yml", "toml", "ini", "css", "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "kt", "c", "h", "cpp", "cs", "php", "sh", "sql", "svg"]);

const SHEET_EXT = new Set(["xlsx", "xlsm", "xls", "ods"]);
const SHEET_MIME = /^application\/(vnd\.openxmlformats-officedocument\.spreadsheetml|vnd\.ms-excel|vnd\.oasis\.opendocument\.spreadsheet)/;

export function previewKind(f: Pick<PreviewFileRef, "filename" | "mimetype">): PreviewKind {
  const m = f.mimetype.toLowerCase();
  const e = ext(f.filename);
  if (m.startsWith("image/") && m !== "image/svg+xml") return PreviewKinds.IMAGE;
  if (m === "application/pdf" || e === "pdf") return PreviewKinds.PDF;
  if (m.startsWith("video/")) return PreviewKinds.VIDEO;
  if (m.startsWith("audio/")) return PreviewKinds.AUDIO;
  if (m === "text/html" || e === "html" || e === "htm") return PreviewKinds.HTML;
  if (m === "text/markdown" || e === "md" || e === "markdown") return PreviewKinds.MARKDOWN;
  if (SHEET_MIME.test(m) || SHEET_EXT.has(e)) return PreviewKinds.SPREADSHEET;
  if (m === "text/csv" || e === "csv" || e === "tsv") return PreviewKinds.CSV;
  if (m.startsWith("text/") || /^application\/(json|xml|javascript|x-yaml|yaml|x-sh|sql|toml)/.test(m) || TEXT_EXT.has(e)) return PreviewKinds.TEXT;
  return PreviewKinds.NONE;
}

const TEXT_KINDS: PreviewKind[] = [PreviewKinds.HTML, PreviewKinds.MARKDOWN, PreviewKinds.CSV, PreviewKinds.TEXT];
const MAX_CSV_ROWS = 500;

/** Minimal CSV/TSV parser (quoted fields, escaped quotes, newlines inside quotes). */
function parseDelimited(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < MAX_CSV_ROWS + 1; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

const CsvTable: FC<{ text: string; tsv: boolean }> = ({ text, tsv }) => {
  const rows = useMemo(() => parseDelimited(text, tsv ? "\t" : ","), [text, tsv]);
  return <RowsTable rows={rows} />;
};

/** First row is the header. Shared by CSV and spreadsheet previews. */
const RowsTable: FC<{ rows: string[][]; truncated?: boolean }> = ({ rows, truncated }) => {
  const [head, ...body] = rows;
  if (!head) return <p className="text-sm text-muted-foreground">This file is empty.</p>;
  return (
    <div className="overflow-auto rounded-md border border-hairline">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-surface-soft">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap border-b border-hairline px-3 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.slice(0, MAX_CSV_ROWS).map((r, i) => (
            <tr key={i} className="border-b border-hairline last:border-0">
              {r.map((c, j) => (
                <td key={j} className="whitespace-nowrap px-3 py-1.5 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(truncated || body.length > MAX_CSV_ROWS) && <p className="px-3 py-2 text-xs text-muted-foreground">Showing part of this sheet. Download the file to see everything.</p>}
    </div>
  );
};

const SheetBody: FC<{ file: PreviewFileRef }> = ({ file }) => {
  const { data, isPending, error } = useFileSheets(file.id);
  if (isPending) return <Skeleton className="h-[60vh] w-full rounded-md" />;
  if (error || !data) return <Unavailable message={(error as Error | null)?.message ?? "Could not load the preview."} />;
  if (!data.sheets.length) return <Unavailable message="This spreadsheet has no sheets." />;
  const table = (rows: string[][], truncated: boolean) => (
    <div className="max-h-[65vh] overflow-auto">
      <RowsTable rows={rows} truncated={truncated} />
    </div>
  );
  if (data.sheets.length === 1) return table(data.sheets[0].rows, data.sheets[0].truncated);
  return (
    <Tabs defaultValue="0" className="flex min-h-0 flex-col">
      <TabsList className="max-w-full justify-start self-start overflow-x-auto">
        {data.sheets.map((s, i) => (
          <TabsTrigger key={i} value={String(i)}>
            {s.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {data.sheets.map((s, i) => (
        <TabsContent key={i} value={String(i)}>
          {table(s.rows, s.truncated)}
        </TabsContent>
      ))}
    </Tabs>
  );
};

const TextBody: FC<{ file: PreviewFileRef; kind: PreviewKind }> = ({ file, kind }) => {
  const { data, isPending, error } = useFileText(file.id);
  if (isPending) return <Skeleton className="h-[60vh] w-full rounded-md" />;
  if (error || !data) return <Unavailable message={(error as Error | null)?.message ?? "Could not load the preview."} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {kind === PreviewKinds.HTML && <iframe title={file.filename} srcDoc={data.text} sandbox="allow-scripts" className="h-[70vh] w-full rounded-md border border-hairline bg-white" />}
      {kind === PreviewKinds.MARKDOWN && (
        <div className="max-h-[70vh] overflow-auto rounded-md border border-hairline p-4">
          <Markdown>{data.text}</Markdown>
        </div>
      )}
      {kind === PreviewKinds.CSV && (
        <div className="max-h-[70vh] min-h-0 overflow-hidden">
          <CsvTable text={data.text} tsv={ext(file.filename) === "tsv"} />
        </div>
      )}
      {kind === PreviewKinds.TEXT && <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-hairline bg-surface-soft p-4 font-mono text-xs leading-relaxed">{data.text}</pre>}
      {data.truncated && <p className="text-xs text-muted-foreground">Preview shows the first 1 MB. Download the file to see everything.</p>}
    </div>
  );
};

const MediaBody: FC<{ file: PreviewFileRef; kind: PreviewKind }> = ({ file, kind }) => {
  const { data, isPending, error } = useFileUrl(file.id, true);
  if (isPending) return <Skeleton className="h-[60vh] w-full rounded-md" />;
  if (error || !data?.url) return <Unavailable message="Could not load the preview." />;
  if (kind === PreviewKinds.IMAGE) return <img src={data.url} alt={file.filename} className="mx-auto max-h-[75vh] max-w-full rounded-md object-contain" />;
  if (kind === PreviewKinds.PDF) return <iframe title={file.filename} src={data.url} className="h-[75vh] w-full rounded-md border border-hairline bg-white" />;
  if (kind === PreviewKinds.VIDEO) return <video src={data.url} controls className="mx-auto max-h-[75vh] max-w-full rounded-md" />;
  return <audio src={data.url} controls className="w-full" />;
};

const Unavailable: FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
    <FileQuestion className="h-8 w-8" />
    {message}
  </div>
);

export const FilePreviewDialog: FC<{ file: PreviewFileRef; open: boolean; onOpenChange: (open: boolean) => void; onDownload: () => void }> = ({ file, open, onOpenChange, onDownload }) => {
  const kind = previewKind(file);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} closeOnOutsideClick>
      <DialogContent className="flex max-h-[calc(100dvh-24px)] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate text-lg">{file.filename}</DialogTitle>
          <DialogDescription>{formatBytes(file.size)}</DialogDescription>
        </DialogHeader>
        {open && (kind === PreviewKinds.NONE ? <Unavailable message="No preview for this file type." /> : kind === PreviewKinds.SPREADSHEET ? <SheetBody file={file} /> : TEXT_KINDS.includes(kind) ? <TextBody file={file} kind={kind} /> : <MediaBody file={file} kind={kind} />)}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
