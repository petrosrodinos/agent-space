import { Bot, Users, type LucideIcon } from "lucide-react";
import { NewChatSteps, type NewChatStep } from "@/stores/ui";

export interface NewChatOption {
  step: Exclude<NewChatStep, typeof NewChatSteps.CHOOSE>;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Icon tile colour (DESIGN.MD bot colours). */
  color: string;
}

/** What the "new chat" chooser offers. Also drives the Chats page empty state. */
export const NEW_CHAT_OPTIONS: NewChatOption[] = [
  { step: NewChatSteps.BOT, label: "New bot", description: "Create an assistant with its own name and look, then start chatting with it.", icon: Bot, color: "#6B4EFF" },
  { step: NewChatSteps.GROUP, label: "New group", description: "Bring several bots and colleagues into one conversation, like a team meeting.", icon: Users, color: "#38B6FF" },
];
