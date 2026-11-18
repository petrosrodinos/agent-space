import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { platform } from "@/platform";

/** Opens deep links (`agentspace://…`, quick-ask, notification taps) inside the app (§14.2). */
export function useDeepLinks() {
  const navigate = useNavigate();
  useEffect(() => platform.links.onDeepLink((path) => navigate(path.startsWith("/") ? path : `/${path}`)), [navigate]);
}

export function DeepLinkListener() {
  useDeepLinks();
  return null;
}
