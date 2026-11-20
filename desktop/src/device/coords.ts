/**
 * Coordinate mapping for control my computer (§14.3). Pure: no Electron imports.
 *
 * - Electron reports display bounds in DIPs (logical points); the display's real pixel size is bounds × scaleFactor.
 * - Screenshots sent to the bot are scaled down to at most 1280 px wide; the bot's x/y are in screenshot pixels.
 * - shotToDip maps them back to a global DIP point on that display. control.ts then converts to what the input library
 *   expects: physical pixels on Windows (screen.dipToScreenPoint, which handles mixed-DPI setups) and Linux (× scale),
 *   logical points on macOS.
 */

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface DisplayGeometry {
    bounds: Rect;
    scaleFactor: number;
}

export const SCREENSHOT_MAX_WIDTH = 1280;
export const CAPTURE_MAX_WIDTH = 1600;

/** Real pixel size of a display. */
export function physicalSize(d: DisplayGeometry): { width: number; height: number } {
    return { width: Math.round(d.bounds.width * d.scaleFactor), height: Math.round(d.bounds.height * d.scaleFactor) };
}

/** Scales (width, height) down to at most maxWidth wide, keeping the aspect ratio. Never scales up. */
export function fitWidth(width: number, height: number, maxWidth: number): { width: number; height: number } {
    if (width <= maxWidth) return { width: Math.round(width), height: Math.round(height) };
    return { width: maxWidth, height: Math.max(1, Math.round((height * maxWidth) / width)) };
}

/** Size of the screenshot the bot sees for a display. */
export function screenshotSize(d: DisplayGeometry, maxWidth = SCREENSHOT_MAX_WIDTH): { width: number; height: number } {
    const real = physicalSize(d);
    return fitWidth(real.width, real.height, maxWidth);
}

/** Checks the bot's coordinates are numbers inside the screenshot. */
export function assertInShot(x: unknown, y: unknown, shot: { width: number; height: number }, label = 'x/y'): { x: number; y: number } {
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} must be numbers.`);
    if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) throw new Error(`${label} (${x}, ${y}) is outside the screenshot (${shot.width}×${shot.height}).`);
    return { x, y };
}

/** Screenshot pixel → global DIP point on the display (centre of the pixel, clamped inside the display). */
export function shotToDip(sx: number, sy: number, d: DisplayGeometry, shot: { width: number; height: number }): { x: number; y: number } {
    const fx = (sx + 0.5) / shot.width;
    const fy = (sy + 0.5) / shot.height;
    const x = d.bounds.x + Math.min(d.bounds.width - 1, Math.max(0, Math.floor(fx * d.bounds.width)));
    const y = d.bounds.y + Math.min(d.bounds.height - 1, Math.max(0, Math.floor(fy * d.bounds.height)));
    return { x, y };
}

/** DIP → physical pixels for a single-scale setup (Linux/X11). Windows uses screen.dipToScreenPoint instead. */
export function dipToPhysical(pt: { x: number; y: number }, scaleFactor: number): { x: number; y: number } {
    return { x: Math.round(pt.x * scaleFactor), y: Math.round(pt.y * scaleFactor) };
}
