import { useRef, type FC } from "react";
import { useCursorFollow } from "@/hooks/use-cursor-follow";
import { cn } from "@/lib/utils";
import { isLightBotColor } from "@/config/constants/dropdowns/shared/bot-colors.options";

const SIZES = { 24: "h-6 w-6 rounded-sm text-[14px]", 32: "h-8 w-8 rounded-sm text-[19px]", 40: "h-10 w-10 rounded-md text-[24px]", 56: "h-14 w-14 rounded-lg text-[34px]", 88: "h-[88px] w-[88px] rounded-xl text-[52px]", 120: "h-[120px] w-[120px] rounded-2xl text-[72px]" } as const;

interface BotAvatarProps {
  emoji: string;
  color: string;
  size?: keyof typeof SIZES;
  working?: boolean;
  className?: string;
  name?: string;
  /** The emoji leans toward a nearby mouse pointer. Use on large, standalone avatars. */
  followCursor?: boolean;
}

/** Bots are squircles filled with their colour, emoji at 60% (DESIGN.MD). A soft ring pulses while the bot works. */
export const BotAvatar: FC<BotAvatarProps> = ({ emoji, color, size = 40, working = false, className, name, followCursor = false }) => {
  const emojiRef = useRef<HTMLSpanElement>(null);
  useCursorFollow(emojiRef, { enabled: followCursor });
  return (
    <span
      role="img"
      aria-label={name ? `${name}, bot` : "bot"}
      className={cn("relative inline-flex shrink-0 select-none items-center justify-center leading-none", SIZES[size], isLightBotColor(color) && "ring-1 ring-inset ring-[rgba(28,22,51,0.12)]", working && "animate-pulse-ring", className)}
      style={{ backgroundColor: color, ["--ring-color" as string]: `${color}88` }}
    >
      <span ref={emojiRef} aria-hidden className="inline-block">
        {emoji}
      </span>
    </span>
  );
};

const PERSON_SIZES = { 24: "h-6 w-6 text-[10px]", 32: "h-8 w-8 text-xs", 40: "h-10 w-10 text-sm", 56: "h-14 w-14 text-lg", 88: "h-[88px] w-[88px] text-3xl" } as const;
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
  bots: { id: string; emoji: string; color: string; name: string }[];
  size?: 24 | 32 | 40;
  max?: number;
}

/** Stacked bot avatars overlap by 30% with a canvas outline. */
export const BotAvatarStack: FC<AvatarStackProps> = ({ bots, size = 32, max = 3 }) => (
  <span className="inline-flex items-center">
    {bots.slice(0, max).map((b, i) => (
      <BotAvatar key={b.id} emoji={b.emoji} color={b.color} name={b.name} size={size} className={cn("ring-2 ring-surface-soft", i > 0 && (size === 24 ? "-ml-2" : size === 32 ? "-ml-2.5" : "-ml-3"))} />
    ))}
    {bots.length > max && <span className="-ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-sunken px-1 text-[11px] font-bold text-muted-foreground ring-2 ring-surface-soft">+{bots.length - max}</span>}
  </span>
);
