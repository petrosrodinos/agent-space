import { BotPanelTabs, type BotPanelTab } from "@/features/bots/interfaces/bots.interfaces";

/** Tabs of the bot side panel in a direct chat. */
export const BotPanelTabOptions: { id: BotPanelTab; label: string }[] = [
  { id: BotPanelTabs.ACTIVITY, label: "Activity" },
  { id: BotPanelTabs.LIBRARY, label: "Library" },
];
