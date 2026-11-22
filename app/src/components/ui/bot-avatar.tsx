import { useRef, type FC } from "react";
import { useCursorFollow } from "@/hooks/use-cursor-follow";
import { cn } from "@/lib/utils";
import { ConversationTypes } from "@/features/conversations/interfaces/conversations.interfaces";
import { FALLBACK_BOT_COLOR, isLightBotColor } from "@/config/constants/dropdowns/shared/bot-colors.options";
import { BotPortrait } from "@/components/ui/bot-portrait";

const SIZES = { 24: "h-6 w-6 rounded-sm", 32: "h-8 w-8 rounded-sm", 40: "h-10 w-10 rounded-md", 56: "h-14 w-14 rounded-lg", 88: "h-[88px] w-[88px] rounded-xl", 120: "h-[120px] w-[120px] rounded-2xl" } as const;

interface BotAvatarProps {
  /** Seed for the generated portrait (bot.avatar_seed). */
  seed: string;
  color: string;
  size?: keyof typeof SIZES;
  working?: boolean;
  className?: string;
  name?: string;
  /** The portrait leans toward a nearby mouse pointer. Use on large, standalone avatars. */
  followCursor?: boolean;
}

/** Bots are squircles filled with their colour and a generated flat portrait. A soft ring pulses while the bot works. */
export const BotAvatar: FC<BotAvatarProps> = ({ seed, color, size = 40, working = false, className, name, followCursor = false }) => {
  const figureRef = useRef<HTMLSpanElement>(null);
  // Scale the pull and tilt down for small avatars so the figure stays inside its squircle.
  const scale = Math.min(1, size / 88);
  useCursorFollow(figureRef, { enabled: followCursor, maxShift: Math.max(1, 5 * scale), maxTilt: Math.max(3, 6 * scale) });
  return (
    <span
      role="img"
      aria-label={name ? `${name}, bot` : "bot"}
      className={cn("relative inline-flex shrink-0 select-none items-center justify-center leading-none", SIZES[size], isLightBotColor(color) && "ring-1 ring-inset ring-[rgba(28,22,51,0.12)]", working && "animate-pulse-ring", className)}
      style={{ backgroundColor: color, ["--ring-color" as string]: `${color}88` }}
    >
      <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <span ref={figureRef} aria-hidden className="block h-full w-full">
          <BotPortrait seed={seed} color={color} className="h-full w-full" />
        </span>
      </span>
    </span>
  );
};

interface ConversationAvatarProps {
  conversation: { type: string; color?: string | null; avatar_seed?: string | null; name: string; bots: { id: string; avatar_seed: string; color: string; name: string }[] };
  size?: keyof typeof SIZES;
  working?: boolean;
  followCursor?: boolean;
  className?: string;
}

/** Shared conversation avatar: groups show their own portrait (or their bots), direct chats the lead bot. */
export const ConversationAvatar: FC<ConversationAvatarProps> = ({ conversation: c, size = 40, working, followCursor, className }) => {
  const lead = c.bots[0];
  if (c.type === ConversationTypes.GROUP) return <GroupAvatar seed={c.avatar_seed} bots={c.bots} color={c.color ?? lead?.color ?? FALLBACK_BOT_COLOR} name={c.name} size={size} working={working} className={className} />;
  if (lead) return <BotAvatar seed={lead.avatar_seed} color={lead.color} name={lead.name} size={size} working={working} followCursor={followCursor} className={className} />;
  return <BotAvatarStack bots={c.bots} />;
};

interface GroupAvatarProps {
  /** The group's own portrait seed. Without one, the group shows its first two bots. */
  seed?: string | null;
  bots: { id: string; avatar_seed: string; color: string }[];
  color: string;
  name?: string;
  size?: keyof typeof SIZES;
  working?: boolean;
  className?: string;
}

/** A group squircle on the group colour: the group's own portrait, or up to two bot portraits side by side. */
export const GroupAvatar: FC<GroupAvatarProps> = ({ seed, bots, color, name, size = 40, working = false, className }) => {
  if (seed) return <BotAvatar seed={seed} color={color} name={name} size={size} working={working} className={className} />;
  const [front, back] = bots;
  return (
    <span
      role="img"
      aria-label={name ? `${name}, group` : "group"}
      className={cn("relative inline-flex shrink-0 select-none overflow-hidden", SIZES[size], isLightBotColor(color) && "ring-1 ring-inset ring-[rgba(28,22,51,0.12)]", working && "animate-pulse-ring", className)}
      style={{ backgroundColor: color, ["--ring-color" as string]: `${color}88` }}
    >
      {back && <BotPortrait seed={back.avatar_seed} color={color} className="absolute bottom-0 right-[-14%] h-[82%] w-[82%]" />}
      {front && <BotPortrait seed={front.avatar_seed} color={color} className={cn("absolute bottom-0 h-[82%] w-[82%]", back ? "left-[-14%]" : "left-[9%]")} />}
    </span>
  );
};

const PERSON_SIZES ={ 24: "h-6 w-6 text-[10px]", 32: "h-8 w-8 text-xs", 40: "h-10 w-10 text-sm", 56: "h-14 w-14 text-lg", 88: "h-[88px] w-[88px] text-3xl" } as const;
const PERSON_TINTS = ["#EEEAFF", "#FFEADF", "#DBF7EC", "#FFE3F1", "#DDF2FF", "#F2EBFF", "#D9F4F3", "#E1E9FF"];
const PERSON_INK = ["#4A2FD6", "#B54A16", "#0E7D57", "#B3246E", "#1468A3", "#6B44C9", "#0E7A76", "#2747B8"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

interface PersonAvatarProps {
  name?: string | null;
  email?: string | null;
  size?: keyof typeof PERSON_SIZES;
  online?: boolean;
  className?: string;
}

/** People are perfect circles: initials on a soft tint picked from the name. */
export const PersonAvatar: FC<PersonAvatarProps> = ({ name, email, size = 40, online, className }) => {
  const i = hash(name || email || "") % PERSON_TINTS.length;
  return (
    <span className={cn("relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-extrabold", PERSON_SIZES[size], className)} style={{ backgroundColor: PERSON_TINTS[i], color: PERSON_INK[i] }} aria-label={name || email || "person"} role="img">
      {initials(name, email)}
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-mint" />}
    </span>
  );
};

interface AvatarStackProps {
  bots: { id: string; avatar_seed: string; color: string; name: string }[];
  size?: 24 | 32 | 40;
  max?: number;
}

/** Stacked bot avatars overlap by 30% with a canvas outline. */
export const BotAvatarStack: FC<AvatarStackProps> = ({ bots, size = 32, max = 3 }) => (
  <span className="inline-flex items-center">
    {bots.slice(0, max).map((b, i) => (
      <BotAvatar key={b.id} seed={b.avatar_seed} color={b.color} name={b.name} size={size} className={cn("ring-2 ring-surface-soft", i > 0 && (size === 24 ? "-ml-2" : size === 32 ? "-ml-2.5" : "-ml-3"))} />
    ))}
    {bots.length > max && <span className="-ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-sunken px-1 text-[11px] font-bold text-muted-foreground ring-2 ring-surface-soft">+{bots.length - max}</span>}
  </span>
);
