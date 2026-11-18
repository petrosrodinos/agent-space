import { ColorThemes, type ColorTheme } from "@/features/users/interfaces/users.interfaces";

/** Colour theme presets (Settings > Appearance). Colours live in index.css under [data-color-theme]. */
export const ColorThemeFormOptions: { id: ColorTheme; label: string; description: string }[] = [
  { id: ColorThemes.NEUTRAL, label: "Neutral", description: "Clean monochrome (default)" },
  { id: ColorThemes.GRAPE, label: "Grape", description: "Playful purple" },
  { id: ColorThemes.OCEAN, label: "Ocean", description: "Deep, calm blue" },
  { id: ColorThemes.SKY, label: "Sky", description: "Bright and airy" },
  { id: ColorThemes.TEAL, label: "Teal", description: "Cool and focused" },
  { id: ColorThemes.FOREST, label: "Forest", description: "Grounded green" },
  { id: ColorThemes.LIME, label: "Lime", description: "Fresh and energetic" },
  { id: ColorThemes.SUNSET, label: "Sunset", description: "Warm tangerine" },
  { id: ColorThemes.AMBER, label: "Amber", description: "Golden and cosy" },
  { id: ColorThemes.ROSE, label: "Rose", description: "Soft and playful" },
  { id: ColorThemes.CRIMSON, label: "Crimson", description: "Bold and confident" },
  { id: ColorThemes.LAVENDER, label: "Lavender", description: "Gentle violet" },
  { id: ColorThemes.SLATE, label: "Slate", description: "Neutral and minimal" },
];

export function getColorThemeLabel(theme: ColorTheme | string): string {
  return ColorThemeFormOptions.find((option) => option.id === theme)?.label ?? theme;
}
