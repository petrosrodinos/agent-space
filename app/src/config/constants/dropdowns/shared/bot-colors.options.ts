/** DESIGN.MD bot colours: identity, never status or actions. */
export const BotColorOptions = [
  { id: "#6B4EFF", label: "Grape", soft: "var(--bot-grape-soft)" },
  { id: "#FF7A3D", label: "Tangerine", soft: "var(--bot-tangerine-soft)" },
  { id: "#FFC83D", label: "Sunshine", soft: "var(--bot-sunshine-soft)", light: true },
  { id: "#1FC98E", label: "Mint", soft: "var(--bot-mint-soft)" },
  { id: "#FF5FAE", label: "Bubblegum", soft: "var(--bot-bubblegum-soft)" },
  { id: "#38B6FF", label: "Sky", soft: "var(--bot-sky-soft)" },
  { id: "#9BD62F", label: "Lime", soft: "var(--bot-lime-soft)", light: true },
  { id: "#FF5A5F", label: "Coral", soft: "var(--bot-coral-soft)" },
  { id: "#B18CFF", label: "Lavender", soft: "var(--bot-lavender-soft)" },
  { id: "#17B5B0", label: "Teal", soft: "var(--bot-teal-soft)" },
  { id: "#3A6BFF", label: "Ocean", soft: "var(--bot-ocean-soft)" },
  { id: "#4A4560", label: "Graphite", soft: "var(--bot-graphite-soft)" },
] as const;

export function botSoftColor(color: string | null | undefined): string {
  const c = BotColorOptions.find((o) => o.id.toLowerCase() === (color ?? "").toLowerCase());
  return c?.soft ?? "var(--primary-soft)";
}

export function isLightBotColor(color: string | null | undefined): boolean {
  const c = BotColorOptions.find((o) => o.id.toLowerCase() === (color ?? "").toLowerCase());
  return !!(c && "light" in c && c.light);
}

export const BotEmojiSuggestions = ["🤖", "🧑‍💼", "💼", "📣", "🛟", "🔎", "🗂️", "📊", "✍️", "🧠", "🚀", "💡", "🦉", "🐙", "🦊", "🌟", "📚", "🛠️", "💰", "⚖️", "🎨", "🧪", "🗓️", "📬"];

/** Default avatar emoji for a new group (users can change it). */
export const DEFAULT_GROUP_EMOJI = "🚀";
/** Default avatar emoji for a new bot and a new skill (users choose their own). */
export const DEFAULT_BOT_EMOJI = "🤖";
export const DEFAULT_SKILL_EMOJI = "📘";
