import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { restoreAppearance } from "@/hooks/use-theme";
import { isAppShell, platform, pwa } from "@/platform";

// After a deploy, an open tab still references the previous build's chunk hashes; those files are gone and the
// lazy import fails. Reload once to pick up the new build (guarded so a genuinely broken chunk can't loop).
const CHUNK_RELOAD_KEY = "chunk-reload-at";
const CHUNK_RELOAD_WINDOW_MS = 10_000;
window.addEventListener("vite:preloadError", (event) => {
  const last = Number(platform.storage.get(CHUNK_RELOAD_KEY)) || 0;
  if (Date.now() - last < CHUNK_RELOAD_WINDOW_MS) return; // already retried: let the error surface
  event.preventDefault();
  platform.storage.set(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
});

restoreAppearance();
// Installable web app: only in the browser — the desktop and mobile shells are already installed.
if (!isAppShell) pwa.start();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
