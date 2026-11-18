import { useEffect } from "react";
import { platform } from "@/platform";
import {
  ColorThemes,
  Themes,
  TextSizes,
  LayoutDensities,
  type ColorTheme,
  type Theme,
} from "@/features/users/interfaces/users.interfaces";

export type ThemeSetting = Theme;
const KEY = "appearance";

/**
 * Applies theme mode (System/Light/Dark), colour theme preset, text size and density (§13.2 Appearance) to <html>;
 * remembered for the sign-in screens and the next launch (before /me loads).
 */
export function applyAppearance(
  theme: ThemeSetting,
  textSize: string = TextSizes.MEDIUM,
  density: string = LayoutDensities.COMFORTABLE,
  colorTheme: ColorTheme = ColorThemes.NEUTRAL,
) {
  const root = document.documentElement;
  const dark = theme === Themes.DARK || (theme === Themes.SYSTEM && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.colorTheme = colorTheme;
  root.dataset.textSize = textSize;
  root.dataset.density = density;
  platform.storage.set(KEY, JSON.stringify({ theme, textSize, density, colorTheme }));
}

export function restoreAppearance() {
  try {
    const saved = JSON.parse(platform.storage.get(KEY) ?? "{}");
    applyAppearance(saved.theme ?? Themes.SYSTEM, saved.textSize, saved.density, saved.colorTheme);
  } catch {
    applyAppearance(Themes.SYSTEM);
  }
}

export function useAppearance(theme: ThemeSetting | undefined, textSize?: string, density?: string, colorTheme?: ColorTheme) {
  useEffect(() => {
    if (!theme) return;
    applyAppearance(theme, textSize, density, colorTheme);
    if (theme !== Themes.SYSTEM) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance(Themes.SYSTEM, textSize, density, colorTheme);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, textSize, density, colorTheme]);
}
