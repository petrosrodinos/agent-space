import { BrowserRouter } from "react-router-dom";
import AppRoutes from "@/routes";
import { DeepLinkListener } from "@/hooks/use-deep-links";
import { DesktopUpdateListener } from "@/hooks/use-desktop-updates";
import QueryProvider from "@/components/providers/query-provider";
import { DesktopTitleBar } from "@/components/layout/desktop-title-bar";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RadixPointerEventsGuard } from "@/components/providers/radix-pointer-events-guard";

function App() {
  return (
    <BrowserRouter>
      <QueryProvider>
        <TooltipProvider delayDuration={300}>
          <DeepLinkListener />
          <DesktopUpdateListener />
          <DesktopTitleBar />
          <AppRoutes />
          <Toaster />
          <RadixPointerEventsGuard />
        </TooltipProvider>
      </QueryProvider>
    </BrowserRouter>
  );
}

export default App;
