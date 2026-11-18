import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { restoreAppearance } from "@/hooks/use-theme";
import { isAppShell, pwa } from "@/platform";

restoreAppearance();
// Installable web app: only in the browser — the desktop and mobile shells are already installed.
if (!isAppShell) pwa.start();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
