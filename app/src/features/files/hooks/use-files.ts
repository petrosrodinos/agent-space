import { useQuery } from "@tanstack/react-query";
import { getFileUrl } from "../services/files.services";
import { QueryKeys } from "@/config/constants/query-keys";

/** Short-lived signed URL for previews (refreshed before it expires — URLs last 5 minutes). */
export const useFileUrl = (id: string | null | undefined, inline = true) =>
  useQuery({ queryKey: [QueryKeys.FILE_URL, id, inline], queryFn: () => getFileUrl(id!, inline), enabled: !!id, staleTime: 4 * 60_000, refetchInterval: 4 * 60_000 });
