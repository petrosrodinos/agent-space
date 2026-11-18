import axios from "axios";
import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { request } from "@/lib/request";

export type UploadPurpose = "chat" | "knowledge" | "avatar" | "logo" | "bot_image" | "skill";

export interface StoredFile {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  status: string;
}

/** How the signed upload works: GCS resumable session, or a single PUT (local dev storage). */
export const UploadProtocols = { GCS_RESUMABLE: "gcs-resumable", PUT: "put" } as const;

interface UploadTarget {
  protocol: (typeof UploadProtocols)[keyof typeof UploadProtocols];
  url: string;
  headers: Record<string, string>;
}

/**
 * §7.7 upload: ask the API for a signed upload, send the bytes straight to storage, then confirm.
 * Signed URLs are short-lived and never stored.
 */
export async function uploadFile(file: File, purpose: UploadPurpose, opts: { conversation_id?: string; bot_id?: string; onProgress?: (pct: number) => void } = {}): Promise<StoredFile> {
  const created = await request<{ file: StoredFile; upload: UploadTarget }>(
    () => axiosInstance.post(ApiRoutes.files.uploads, { filename: file.name, mimetype: file.type || "application/octet-stream", size: file.size, purpose, conversation_id: opts.conversation_id, bot_id: opts.bot_id }),
    "Could not start the upload.",
  );
  const { upload } = created;
  try {
    let target = upload.url;
    if (upload.protocol === UploadProtocols.GCS_RESUMABLE) {
      const start = await axios.post(upload.url, null, { headers: upload.headers });
      target = String(start.headers.location);
    }
    await axios.put(target, file, {
      headers: { "Content-Type": file.type || "application/octet-stream" },
      onUploadProgress: (e) => opts.onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    });
  } catch {
    throw new Error(`Uploading ${file.name} failed. Please try again.`);
  }
  return request<StoredFile>(() => axiosInstance.post(ApiRoutes.files.confirm(created.file.id)), "The upload could not be confirmed.");
}

export const getFileUrl = (id: string, inline = false) => request<{ url: string; filename: string; mimetype: string; expires_at: string }>(() => axiosInstance.get(ApiRoutes.files.url(id), { params: { inline } }));
