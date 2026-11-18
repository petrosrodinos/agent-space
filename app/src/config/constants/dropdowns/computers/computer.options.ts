import { ComputerStatuses } from "@/features/computers/interfaces/computers.interfaces";
import { ComputerHandoffKinds } from "@/features/conversations/interfaces/conversations.interfaces";

export const ComputerStatusOptions = [
  { id: ComputerStatuses.OFF, label: "Off" },
  { id: ComputerStatuses.STARTING, label: "Starting" },
  { id: ComputerStatuses.RUNNING, label: "Running" },
  { id: ComputerStatuses.PAUSED, label: "Paused" },
  { id: ComputerStatuses.ERROR, label: "Error" },
] as const;

/** Why the bot asks the user to take control of its computer (§9.4). */
export const ComputerHandoffKindOptions = [
  { id: ComputerHandoffKinds.SIGN_IN, label: "Sign in needed" },
  { id: ComputerHandoffKinds.TWO_STEP_CODE, label: "Two-step code needed" },
  { id: ComputerHandoffKinds.CAPTCHA, label: "“Prove you're human” check" },
  { id: ComputerHandoffKinds.OTHER, label: "Your help is needed" },
] as const;
