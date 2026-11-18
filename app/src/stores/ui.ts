import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { platform } from "@/platform";

const STORE_KEY = "ui";

export const SidePanelKinds = { CONVERSATION_INFO: "conversation-info", TASK: "task", UI: "ui" } as const;
export const NewChatSteps = { CHOOSE: "choose", BOT: "bot", GROUP: "group" } as const;
export type NewChatStep = (typeof NewChatSteps)[keyof typeof NewChatSteps];

export type SidePanel = { kind: typeof SidePanelKinds.CONVERSATION_INFO } | { kind: typeof SidePanelKinds.TASK; run_id: string } | { kind: typeof SidePanelKinds.UI; message_id: string; ui_id: string } | null;

interface UiStore {
  nav_expanded: boolean;
  mobile_nav_open: boolean;
  side_panel: SidePanel;
  command_open: boolean;
  /** Open step of the "new chat" modal, or null when closed. */
  new_chat_step: NewChatStep | null;
  /** Step the modal was opened at; Back is offered only when it was opened at the chooser. */
  new_chat_entry: NewChatStep | null;
  setNavExpanded: (v: boolean) => void;
  setMobileNavOpen: (v: boolean) => void;
  openSidePanel: (p: SidePanel) => void;
  setCommandOpen: (v: boolean) => void;
  openNewChat: (step?: NewChatStep) => void;
  setNewChatStep: (step: NewChatStep) => void;
  closeNewChat: () => void;
}

export const useUiStore = create<UiStore>()(
  devtools(
    persist(
      (set) => ({
        nav_expanded: false,
        mobile_nav_open: false,
        side_panel: null,
        command_open: false,
        new_chat_step: null,
        new_chat_entry: null,
        setNavExpanded: (v) => set({ nav_expanded: v }),
        setMobileNavOpen: (v) => set({ mobile_nav_open: v }),
        openSidePanel: (p) => set({ side_panel: p }),
        setCommandOpen: (v) => set({ command_open: v }),
        openNewChat: (step = NewChatSteps.CHOOSE) => set({ new_chat_step: step, new_chat_entry: step }),
        setNewChatStep: (step) => set({ new_chat_step: step }),
        closeNewChat: () => set({ new_chat_step: null, new_chat_entry: null }),
      }),
      {
        name: STORE_KEY,
        partialize: (s) => ({ nav_expanded: s.nav_expanded }),
        storage: createJSONStorage(() => ({ getItem: platform.storage.get, setItem: platform.storage.set, removeItem: platform.storage.remove })),
      },
    ),
  ),
);

export const getUiStoreState = () => useUiStore.getState();
