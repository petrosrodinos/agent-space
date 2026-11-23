import { memo, useState, type FC, type ReactNode } from "react";
import { avatarFileId } from "@/lib/avatar-seed";
import { useFileUrl } from "@/features/files/hooks/use-files";

/**
 * Flat-portrait bot avatars. Every look (skin tone, hair, glasses, expression, shirt) is derived from the bot's
 * `avatar_seed`, so a bot keeps the same face everywhere and "Shuffle" just means a new seed. The bot colour is
 * the background (painted by the caller) and tints the shirt.
 */

const SKIN_TONES = ["#F6D3B8", "#EDBF9B", "#D9A273", "#B07449", "#7E4D30", "#F3CBA6"] as const;
const HAIR_COLORS = ["#1E1915", "#3A2517", "#6A4127", "#B07A41", "#D8B46E", "#8C9099", "#9E3A28"] as const;

const HairStyles = { SHORT: "SHORT", SIDE: "SIDE", BUN: "BUN", LONG: "LONG", CURLY: "CURLY", BUZZ: "BUZZ" } as const;
type HairStyle = (typeof HairStyles)[keyof typeof HairStyles];
const HAIR_STYLE_LIST = Object.values(HairStyles);

const INK = "#1a1a1a";
const SHORT_HAIR = "M32 44 C30 26 41 20 51 20 C62 20 70 27 68 44 C66 36 62 31 56 30 C50 33 40 33 34 38 Z";
const CURLS: [number, number, number][] = [[36, 32, 7], [42, 25, 7], [50, 22, 7.5], [58, 25, 7], [64, 32, 7], [33, 40, 5], [67, 40, 5]];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: small deterministic PRNG so a seed always produces the same face. */
function seededRandom(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];

function toRgb(hex: string): [number, number, number] {
  const h = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.slice(1) : "4A4560";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function mix(a: string, b: string, t: number) {
  const x = toRgb(a);
  const y = toRgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** A fresh random seed for a new bot or a shuffle. */
export function randomAvatarSeed() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Several distinct seeds at once, for the picker's preselects. */
export function randomAvatarSeeds(count: number) {
  return Array.from({ length: count }, randomAvatarSeed);
}

function hair(style: HairStyle, fill: string): { back: ReactNode; front: ReactNode } {
  switch (style) {
    case HairStyles.SHORT:
      return { back: null, front: <path d={SHORT_HAIR} fill={fill} /> };
    case HairStyles.SIDE:
      return { back: null, front: <path d="M32 46 C29 25 42 19 52 20 C63 21 71 29 68 46 C67 37 64 32 60 30 C52 36 44 30 38 33 C35 36 33 40 32 46 Z" fill={fill} /> };
    case HairStyles.BUN:
      return { back: null, front: <><circle cx="50" cy="17" r="7.5" fill={fill} /><path d={SHORT_HAIR} fill={fill} /></> };
    case HairStyles.LONG:
      return {
        back: <path d="M30 46 C28 24 40 19 50 19 C61 19 72 25 70 46 L72 73 C62 76 38 76 28 73 Z" fill={fill} />,
        front: <path d="M32 46 C30 25 42 20 50 20 C60 20 70 26 68 46 C64 34 56 28 50 29 C44 30 36 34 32 46 Z" fill={fill} />,
      };
    case HairStyles.CURLY:
      return { back: null, front: <>{CURLS.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={fill} />)}</> };
    case HairStyles.BUZZ:
      return { back: null, front: <path d="M33 40 C33 27 42 22 50 22 C58 22 67 27 67 40 C62 32 56 30 50 30 C44 30 38 32 33 40 Z" fill={fill} opacity={0.85} /> };
  }
}

interface BotPortraitProps {
  seed: string;
  color: string;
  className?: string;
}

/** The figure only, on a transparent background (viewBox 0 0 100 100). Callers paint the bot colour behind it. */
export const BotPortrait: FC<BotPortraitProps> = memo(({ seed, color, className }) => {
  const fileId = avatarFileId(seed);
  return fileId ? <PortraitImage fileId={fileId} seed={seed} color={color} className={className} /> : <GeneratedPortrait seed={seed} color={color} className={className} />;
});
BotPortrait.displayName = "BotPortrait";

/** An uploaded or AI-generated avatar. Falls back to a generated face while loading or when the file can't be read (e.g. a shared link). */
const PortraitImage: FC<BotPortraitProps & { fileId: string }> = ({ fileId, seed, color, className }) => {
  const { data, isError } = useFileUrl(fileId);
  const [broken, setBroken] = useState(false);
  if (isError || broken) return <GeneratedPortrait seed={seed} color={color} className={className} />;
  if (!data) return <span className={className} aria-hidden />;
  return <img src={data.url} alt="" aria-hidden draggable={false} onError={() => setBroken(true)} className={`${className ?? ""} object-cover`} />;
};

const GeneratedPortrait: FC<BotPortraitProps> = ({ seed, color, className }) => {
  const r = seededRandom(seed || "bot");
  const skin = pick(r, SKIN_TONES);
  const hairColor = pick(r, HAIR_COLORS);
  const { back, front } = hair(pick(r, HAIR_STYLE_LIST), hairColor);
  const glasses = r() < 0.3;
  const smile = r() < 0.5;
  const darkShirt = r() < 0.5;
  // Light bot colours (Sunshine, Lime) always get a dark shirt so the figure stands out from the background.
  const shirt = luminance(color) > 0.6 || darkShirt ? mix(color, "#000000", luminance(color) > 0.6 ? 0.55 : 0.45) : mix(color, "#ffffff", 0.78);
  const neck = mix(skin, "#000000", 0.12);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden focusable="false">
      {back}
      <path d="M12 104 C12 81 28 70 50 70 C72 70 88 81 88 104 Z" fill={shirt} />
      <path d="M43 56 L43 70 Q50 75 57 70 L57 56 Z" fill={neck} />
      <path d="M43 71 L50 79 L57 71" fill="none" stroke={mix(shirt, "#000000", 0.25)} strokeWidth="1.6" strokeLinejoin="round" />
      <ellipse cx="33" cy="46" rx="3.6" ry="5" fill={skin} />
      <ellipse cx="67" cy="46" rx="3.6" ry="5" fill={skin} />
      <ellipse cx="50" cy="43" rx="17" ry="20" fill={skin} />
      {front}
      <path d="M40 40 Q43.5 38.3 47 40 M53 40 Q56.5 38.3 60 40" fill="none" stroke={mix(hairColor, "#000000", 0.2)} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="43.5" cy="45.5" r="1.9" fill={INK} />
      <circle cx="56.5" cy="45.5" r="1.9" fill={INK} />
      <circle cx="40" cy="51.5" r="3" fill="#ff6b6b" opacity={0.22} />
      <circle cx="60" cy="51.5" r="3" fill="#ff6b6b" opacity={0.22} />
      {smile ? (
        <path d="M45 54.5 Q50 59.5 55 54.5 Z" fill="#7a2d2d" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      ) : (
        <path d="M45.5 55 Q50 58 54.5 55" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      )}
      {glasses && (
        <g fill="none" stroke={INK} strokeWidth="1.5">
          <circle cx="43.5" cy="45.5" r="5.3" />
          <circle cx="56.5" cy="45.5" r="5.3" />
          <path d="M48.8 45.5 H51.2" />
        </g>
      )}
    </svg>
  );
};
