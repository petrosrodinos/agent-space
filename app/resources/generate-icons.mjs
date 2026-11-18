/**
 * Renders the Agent Space app mark into the source images @capacitor/assets expects,
 * then run `npx capacitor-assets generate` (see npm script `icons`).
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const INK = { DARK: "#0A0A0A", LIGHT: "#FAFAFA" };

/** Orbit + agent core. `fg` = mark colour, `bg` = surface it sits on (used for the depth gap). */
const mark = (fg, bg) => `
  <g transform="rotate(-28)">
    <ellipse rx="330" ry="122" fill="none" stroke="${fg}" stroke-width="30" opacity="0.55"/>
  </g>
  <circle r="150" fill="${fg}"/>
  <rect x="-58" y="-52" width="34" height="74" rx="17" fill="${bg}"/>
  <rect x="24" y="-52" width="34" height="74" rx="17" fill="${bg}"/>
  <g transform="rotate(-28)">
    <path d="M 330 0 A 330 122 0 0 1 -330 0" fill="none" stroke="${bg}" stroke-width="58"/>
    <path d="M 330 0 A 330 122 0 0 1 -330 0" fill="none" stroke="${fg}" stroke-width="30" stroke-linecap="round"/>
    <circle cx="212" cy="-94" r="40" fill="${fg}" stroke="${bg}" stroke-width="14"/>
  </g>`;

const background = () => `
  <defs>
    <radialGradient id="bg" cx="0.3" cy="0.2" r="1">
      <stop offset="0" stop-color="#262626"/>
      <stop offset="1" stop-color="${INK.DARK}"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>`;

const svg = (body, size = SIZE) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

/** scale: mark is ~700px wide at 1, so 0.72 keeps it inside the Android adaptive-icon safe zone. */
const placed = (fg, bg, scale, size = SIZE) =>
  `<g transform="translate(${size / 2} ${size / 2}) scale(${scale})">${mark(fg, bg)}</g>`;

const files = {
  "icon-only.png": svg(background() + placed("#FFFFFF", "#141414", 1.0)),
  "icon-foreground.png": svg(placed("#FFFFFF", "#141414", 0.72)),
  "icon-background.png": svg(background()),
  "splash.png": svg(`<rect width="2732" height="2732" fill="${INK.LIGHT}"/>` + placed(INK.DARK, INK.LIGHT, 0.9, 2732), 2732),
  "splash-dark.png": svg(`<rect width="2732" height="2732" fill="${INK.DARK}"/>` + placed("#FFFFFF", INK.DARK, 0.9, 2732), 2732),
};

for (const [name, content] of Object.entries(files)) {
  await sharp(Buffer.from(content)).png().toFile(fileURLToPath(new URL(name, import.meta.url)));
}

// Web favicon (no emoji): rounded tile + mark.
writeFileSync(
  new URL("../public/favicon.svg", import.meta.url),
  svg(`<rect width="${SIZE}" height="${SIZE}" rx="230" fill="${INK.DARK}"/>` + placed("#FFFFFF", INK.DARK, 1.15)),
);
console.log("Rendered", Object.keys(files).join(", "), "+ public/favicon.svg");

// Raster favicons for browsers/home screens that don't use the SVG.
const pub = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const tile = Buffer.from(files["icon-only.png"]);
await sharp(tile).resize(180).png().toFile(pub("apple-touch-icon.png"));
await sharp(tile).resize(512).png().toFile(pub("icon-512.png"));
const rounded = Buffer.from(svg(`<rect width="${SIZE}" height="${SIZE}" rx="230" fill="${INK.DARK}"/>` + placed("#FFFFFF", INK.DARK, 1.15)));
await sharp(rounded).resize(32).png().toFile(pub("favicon-32.png"));
console.log("Rendered public/apple-touch-icon.png, icon-512.png, favicon-32.png");
