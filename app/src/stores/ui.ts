import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { platform } from "@/platform";

const STORE_KEY = "ui";

export const SidePanelKinds = { CONVERSATION_INFO: "conversation-info", TASK: "task", UI: "ui" } as const;
export type SidePanel = { kind: typeof SidePanelKinds.CONVERSATION_INFO } | { kind: typeof SidePanelKinds.TASK; run_id: string } | { kind: typeof SidePanelKinds.UI; message_id: string; ui_id: string } | null;

interface UiStore {
  sidebar_collapsed: boolean;
  mobile_nav_open: boolean;
  side_panel: SidePanel;
  command_open: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  setMobileNavOpen: (v: boolean) => void;
  openSidePanel: (p: SidePanel) => void;
  setCommandOpen: (v: boolean) => void;
}

export const useUiStore = create<UiStore>()(
  devtools(
    persist(
      (set) => ({
        sidebar_collapsed: false,
        mobile_nav_open: false,
        side_panel: null,
        command_open: false,
        setSidebarCollapsed: (v) => set({ sidebar_collapsed: v }),
        setMobileNavOpen: (v) => set({ mobile_nav_open: v }),
        openSidePanel: (p) => set({ side_panel: p }),
        setCommandOpen: (v) => set({ command_open: v }),
      }),
      {
        name: STORE_KEY,
        partialize: (s) => ({ sidebar_collapsed: s.sidebar_collapsed }),
        storage: createJSONStorage(() => ({ getItem: platform.storage.get, setItem: platform.storage.set, removeItem: platform.storage.remove })),
      },
    ),
  ),
);

export const getUiStoreState = () => useUiStore.getState();
