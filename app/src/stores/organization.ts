import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { platform } from "@/platform";

const STORE_KEY = "organization";

interface OrganizationStore {
  /** The currently selected organisation (§5.1 switcher). Everything belongs to it. */
  current_id: string | null;
  setCurrent: (id: string | null) => void;
}

export const useOrganizationStore = create<OrganizationStore>()(
  devtools(
    persist(
      (set) => ({
        current_id: null,
        setCurrent: (id) => set({ current_id: id }),
      }),
      {
        name: STORE_KEY,
        storage: createJSONStorage(() => ({ getItem: platform.storage.get, setItem: platform.storage.set, removeItem: platform.storage.remove })),
      },
    ),
  ),
);

export const getOrganizationStoreState = () => useOrganizationStore.getState();
