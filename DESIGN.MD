---
version: 1.1
name: agent-space-design-system
description: A calm, friendly and confident interface for Agent Space — a messaging-style home for AI co-workers. Neutral monochrome by default (white and near-black, Grok-style), with an optional colour theme each person picks per organisation. A candy-bright bot palette, chunky rounded shapes, soft shadows and quick motion. Characterful grotesque display type paired with a clean, rounded humanist sans for everyday reading. The bots bring the colour; the chrome stays out of the way.

colors:
  # Brand (Neutral colour theme — the default; see "Colour themes" for the other presets)
  primary: "#0D0D0F"            # Near-black — main actions, user bubbles, links, focus
  primary-hover: "#27272A"
  primary-active: "#3F3F46"
  primary-soft: "#EFEFF1"       # Light grey — selected states, highlights
  primary-disabled: "#D4D4D8"
  on-primary: "#FFFFFF"
  accent-tangerine: "#FF7A3D"   # Energy — badges, "new", celebration
  accent-sunshine: "#FFC83D"    # Attention — approvals, highlights
  accent-mint: "#1FC98E"        # Success, "live", connected
  accent-bubblegum: "#FF5FAE"   # Fun moments, reactions
  accent-sky: "#38B6FF"         # Info, links in dark bubbles

  # Light surfaces
  canvas: "#FFFFFF"             # Clean white page floor
  surface: "#FFFFFF"            # Cards, chat panel, inputs
  surface-soft: "#F7F7F8"       # Sidebar, secondary panels
  surface-sunken: "#EFEFF1"     # Composer well, code blocks, wells
  hairline: "#E7E7EA"
  hairline-strong: "#D4D4D8"

  # Light text
  ink: "#0D0D0F"                # Near-black — headlines, primary text
  body: "#3F3F46"
  muted: "#71717A"
  muted-soft: "#A1A1AA"

  # Semantic
  success: "#12A574"
  success-soft: "#DDF7EC"
  warning: "#D98A00"
  warning-soft: "#FFF3D1"
  error: "#E5484D"
  error-soft: "#FFE4E4"
  info: "#1E90E0"
  info-soft: "#DFF1FF"

  # Dark mode
  dark-canvas: "#0A0A0A"
  dark-surface: "#141414"
  dark-surface-soft: "#111111"
  dark-surface-elevated: "#1C1C1C"
  dark-surface-sunken: "#050505"
  dark-hairline: "#262626"
  dark-hairline-strong: "#363636"
  dark-ink: "#FAFAFA"
  dark-body: "#D4D4D8"
  dark-muted: "#A1A1AA"
  dark-muted-soft: "#71717A"
  dark-primary: "#FAFAFA"       # White — main actions in dark mode
  dark-on-primary: "#0A0A0A"
  dark-primary-soft: "#262626"

color-themes:                   # Per user, per organisation (Settings > Appearance). Overrides brand + surface tint only.
  neutral:  { light-primary: "#0D0D0F", dark-primary: "#FAFAFA", light-canvas: "#FFFFFF", dark-canvas: "#0A0A0A" }   # default
  grape:    { light-primary: "#6B4EFF", dark-primary: "#8E78FF", light-canvas: "#FFFBF5", dark-canvas: "#13101F" }
  ocean:    { light-primary: "#2F5FE8", dark-primary: "#6F93FF", light-canvas: "#F7F9FF", dark-canvas: "#0E1220" }
  sky:      { light-primary: "#0B8FD8", dark-primary: "#4CBCFF", light-canvas: "#F5FBFF", dark-canvas: "#0B141C" }
  teal:     { light-primary: "#0F9A94", dark-primary: "#3FD0C8", light-canvas: "#F4FBFA", dark-canvas: "#0A1716" }
  forest:   { light-primary: "#1E8A4C", dark-primary: "#4FC97F", light-canvas: "#F6FAF5", dark-canvas: "#0C150F" }
  lime:     { light-primary: "#4F8A0B", dark-primary: "#A3DC3C", light-canvas: "#FAFCF3", dark-canvas: "#11140B" }
  sunset:   { light-primary: "#E8612A", dark-primary: "#FF8A57", light-canvas: "#FFF8F3", dark-canvas: "#1A100C" }
  amber:    { light-primary: "#B06F00", dark-primary: "#FFC23D", light-canvas: "#FFFAF0", dark-canvas: "#17130A" }
  rose:     { light-primary: "#E0458F", dark-primary: "#FF74B4", light-canvas: "#FFF7FA", dark-canvas: "#1A0D13" }
  crimson:  { light-primary: "#D42A3C", dark-primary: "#FF5C6C", light-canvas: "#FFF8F8", dark-canvas: "#1A0C0E" }
  lavender: { light-primary: "#8456E8", dark-primary: "#B79BFF", light-canvas: "#FCFAFF", dark-canvas: "#120F1C" }
  slate:    { light-primary: "#3F4A5C", dark-primary: "#A9B4C6", light-canvas: "#F8F9FB", dark-canvas: "#0F1115" }

bot-colors:                     # Avatar fills; each has a soft tint for bubbles/backgrounds
  grape:      { fill: "#6B4EFF", soft: "#EEEAFF", dark-soft: "#2C2457" }
  tangerine:  { fill: "#FF7A3D", soft: "#FFEADF", dark-soft: "#3D2418" }
  sunshine:   { fill: "#FFC83D", soft: "#FFF5D6", dark-soft: "#3A3015" }
  mint:       { fill: "#1FC98E", soft: "#DBF7EC", dark-soft: "#123528" }
  bubblegum:  { fill: "#FF5FAE", soft: "#FFE3F1", dark-soft: "#3D1A2E" }
  sky:        { fill: "#38B6FF", soft: "#DDF2FF", dark-soft: "#13314A" }
  lime:       { fill: "#9BD62F", soft: "#EEF8D9", dark-soft: "#283612" }
  coral:      { fill: "#FF5A5F", soft: "#FFE3E4", dark-soft: "#3D1A1C" }
  lavender:   { fill: "#B18CFF", soft: "#F2EBFF", dark-soft: "#2F2548" }
  teal:       { fill: "#17B5B0", soft: "#D9F4F3", dark-soft: "#123433" }
  ocean:      { fill: "#3A6BFF", soft: "#E1E9FF", dark-soft: "#18244A" }
  graphite:   { fill: "#4A4560", soft: "#ECEAF2", dark-soft: "#2A2638" }

typography:
  display-xl:
    fontFamily: "Bricolage Grotesque, Plus Jakarta Sans, sans-serif"
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -1.5px
  display-lg:
    fontFamily: "Bricolage Grotesque, Plus Jakarta Sans, sans-serif"
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -1px
  display-md:
    fontFamily: "Bricolage Grotesque, Plus Jakarta Sans, sans-serif"
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.5px
  display-sm:
    fontFamily: "Bricolage Grotesque, Plus Jakarta Sans, sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.3px
  title-lg:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
  title-md:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.35
  title-sm:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.4
  body-lg:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.6
  body-md:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.6
  body-sm:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
  overline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: 1.2px
    textTransform: uppercase
  button:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6

rounded:
  xs: 6px
  sm: 10px
  md: 14px
  lg: 20px
  xl: 28px
  bubble: 20px                  # chat bubbles (one corner tightens to 6px — the "tail")
  pill: 9999px
  full: 50%

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  xxxl: 72px

shadows:
  none: "none"
  sticker: "0 1px 2px rgba(0,0,0,0.05)"                                       # resting cards, chips
  sticker-strong: "0 2px 4px rgba(0,0,0,0.08)"                                # buttons, raised cards
  pop: "0 1px 2px rgba(0,0,0,0.06), 0 12px 32px -8px rgba(0,0,0,0.16)"        # menus, popovers, dialogs
  glow-primary: "0 0 0 4px color-mix(in srgb, var(--primary) 22%, transparent)"  # focus ring, follows the colour theme
  dark-sticker: "0 2px 0 rgba(0,0,0,0.35)"
  dark-pop: "0 2px 0 rgba(0,0,0,0.35), 0 16px 40px -8px rgba(0,0,0,0.6)"

motion:
  duration-instant: 90ms
  duration-quick: 160ms
  duration-base: 240ms
  duration-slow: 400ms
  ease-standard: "cubic-bezier(0.2, 0, 0, 1)"
  ease-bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)"   # small overshoot for "pop" moments
  ease-exit: "cubic-bezier(0.4, 0, 1, 1)"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: 40px
    padding: 0 20px
    shadow: "{shadows.sticker-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1.5px solid {colors.hairline-strong}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: 40px
    padding: 0 20px
    shadow: "{shadows.sticker}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.body}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: 36px
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: 40px
  icon-button:
    backgroundColor: transparent
    textColor: "{colors.body}"
    rounded: "{rounded.full}"
    size: 36px
  bot-avatar:
    backgroundColor: "{bot-colors.<color>.fill}"
    rounded: "{rounded.md}"      # soft squircle — bots; people are perfect circles
    sizes: [24px, 32px, 40px, 56px, 88px]
    emojiScale: 0.6
  person-avatar:
    rounded: "{rounded.full}"
    sizes: [24px, 32px, 40px, 56px, 88px]
  message-bubble-user:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.bubble}"
    padding: 10px 16px
  message-bubble-bot:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.bubble}"
    padding: 12px 16px
  composer:
    backgroundColor: "{colors.surface}"
    border: "1.5px solid {colors.hairline-strong}"
    rounded: "{rounded.xl}"
    padding: 12px 12px 12px 18px
    shadow: "{shadows.pop}"
  activity-step:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: 6px 12px
  approval-card:
    backgroundColor: "{colors.warning-soft}"
    border: "1.5px solid {colors.accent-sunshine}"
    rounded: "{rounded.lg}"
    padding: 20px
    shadow: "{shadows.sticker-strong}"
  interactive-reply-frame:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    padding: 20px
    shadow: "{shadows.sticker}"
  artifact-card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    shadow: "{shadows.sticker}"
  skill-chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-active}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 4px 10px 4px 6px
  connection-tile:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    padding: 16px
    shadow: "{shadows.sticker}"
  sidebar:
    backgroundColor: "{colors.surface-soft}"
    width: 288px
  side-panel:
    backgroundColor: "{colors.surface}"
    width: 480px
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1.5px solid {colors.hairline-strong}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    height: 42px
    padding: 0 14px
  text-input-focused:
    border: "1.5px solid {colors.primary}"
    shadow: "{shadows.glow-primary}"
  badge:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.body}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  badge-new:
    backgroundColor: "{colors.accent-tangerine}"
    textColor: "{colors.on-primary}"
    typography: "{typography.overline}"
    rounded: "{rounded.pill}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
    shadow: "{shadows.pop}"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: 28px
    shadow: "{shadows.pop}"
---

## Overview

Agent Space should feel like **opening a group chat with your favourite colleagues — who happen to be very capable bots.** It's a messaging app first: friendly, bright and easy, with real work happening underneath.

The personality is **calm, friendly and confident**. The chrome is neutral and quiet — like Grok or a well-made chat app — and the fun lives in specific places: the bots' candy-coloured avatars, chunky rounded shapes, small micro-moments and cheerful microcopy. When a bot is doing something serious (sending an email, spending money, touching sensitive data), clarity takes over.

**Key characteristics**
- **Neutral monochrome by default.** A clean white canvas with near-black text in light mode; a near-black canvas (`#0A0A0A`) with white text in dark mode. No tinted surfaces, no brand hue in the chrome.
- **Primary is black (light) / white (dark)** — `{colors.primary}` is the single action colour: primary buttons, the user's own chat bubbles, links, focus rings and selected states.
- **Colour is opt-in.** Each person can pick a **colour theme** per organisation (Settings > Appearance) — 13 presets from Neutral to Ocean, Forest, Sunset or Grape. A theme swaps the primary colour and lightly tints the surfaces; everything else stays the same.
- **Bots bring the colour.** Each bot picks one of 12 bright bot colours plus an emoji. Bot colours are the most saturated thing on screen, so users recognise bots instantly.
- **Chunky and round.** Pill buttons, 20px cards, squircle bot avatars, bubbly chat messages.
- **Soft shadows** — a faint 1–2px shadow under cards and buttons; larger blurred shadows only on floating things (menus, dialogs, composer).
- **Characterful headlines** in Bricolage Grotesque, bold and tightly tracked; everything else in Plus Jakarta Sans, a rounded, friendly sans that stays very readable at small sizes.
- **Motion with a little bounce** — quick, purposeful, with a small overshoot on "pop" moments (a new message, an approval, a published artifact).

## Colors

### Brand
- **Primary** (`{colors.primary}` #0D0D0F light / #FAFAFA dark in the default Neutral theme) — primary buttons, user bubbles, links, focus, selection. Hover `{colors.primary-hover}`, pressed `{colors.primary-active}`. The value changes with the person's colour theme, so **always use the token, never a hex**.
- **Primary Soft** (`{colors.primary-soft}` #EFEFF1 light / #262626 dark) — selected conversation, active tab, skill chips, highlighted rows.
- **Tangerine** (`{colors.accent-tangerine}` #FF7A3D) — "New" badges, celebratory moments, streaks. Never for errors.
- **Sunshine** (`{colors.accent-sunshine}` #FFC83D) — approvals and "needs your attention".
- **Mint** (`{colors.accent-mint}` #1FC98E) — "live", "connected", "done".
- **Bubblegum** (`{colors.accent-bubblegum}` #FF5FAE) and **Sky** (`{colors.accent-sky}` #38B6FF) — reactions, illustrations, onboarding confetti.

Accent colours are **decoration and signals, not actions**. The only colour that means "click me" is primary.

### Surfaces (light, Neutral theme)
| Token | Hex | Use |
|---|---|---|
| `{colors.canvas}` | #FFFFFF | App background, chat area background |
| `{colors.surface}` | #FFFFFF | Cards, bot bubbles, inputs, side panel, dialogs |
| `{colors.surface-soft}` | #F7F7F8 | Left sidebar, settings navigation |
| `{colors.surface-sunken}` | #EFEFF1 | Activity steps, code blocks, empty wells |
| `{colors.hairline}` | #E7E7EA | Default borders and dividers |
| `{colors.hairline-strong}` | #D4D4D8 | Input and secondary-button borders |

### Text (light)
| Token | Hex | Use |
|---|---|---|
| `{colors.ink}` | #0D0D0F | Headlines, message text, primary labels |
| `{colors.body}` | #3F3F46 | Long-form text, descriptions |
| `{colors.muted}` | #71717A | Secondary text, timestamps, helper text |
| `{colors.muted-soft}` | #A1A1AA | Placeholders, disabled text |

Text greys are **pure neutral** (zinc scale) with no hue, so they sit well under every colour theme. Ink is near-black, not `#000`.

### Semantic
| Meaning | Strong | Soft background | Use |
|---|---|---|---|
| Success | #12A574 | #DDF7EC | Task done, connection active, published |
| Warning | #D98A00 | #FFF3D1 | Approval needed, connection expiring, near usage limit |
| Error | #E5484D | #FFE4E4 | Failed task, broken connection, validation |
| Info | #1E90E0 | #DFF1FF | Tips, neutral notices |

Status is **never shown by colour alone** — always pair it with an icon and a word.

### Dark mode
Dark mode is a neutral near-black — no colour cast. In the Neutral theme, primary flips to white with near-black text on it.

| Light token | Dark equivalent |
|---|---|
| canvas | `{colors.dark-canvas}` #0A0A0A |
| surface | `{colors.dark-surface}` #141414 |
| surface-soft | `{colors.dark-surface-soft}` #111111 |
| surface-sunken | `{colors.dark-surface-sunken}` #050505 |
| (menus, dialogs) | `{colors.dark-surface-elevated}` #1C1C1C |
| hairline / hairline-strong | #262626 / #363636 |
| ink / body / muted / muted-soft | #FAFAFA / #D4D4D8 / #A1A1AA / #71717A |
| primary / on-primary / primary-soft | #FAFAFA / #0A0A0A / #262626 |

Bot colour fills stay the same in dark mode; their soft tints switch to the `dark-soft` values.

## Colour themes

People can personalise the app with a **colour theme**, stored **per user per organisation** (on the organisation membership), so the same person can have Ocean in one organisation and Neutral in another. Switching organisation switches the theme. Light / Dark / System **mode** is a separate, personal setting that applies everywhere.

| Preset | Light primary | Dark primary | Feel |
|---|---|---|---|
| **Neutral** (default) | #0D0D0F | #FAFAFA | Clean monochrome |
| Grape | #6B4EFF | #8E78FF | Playful purple (the original look) |
| Ocean | #2F5FE8 | #6F93FF | Deep, calm blue |
| Sky | #0B8FD8 | #4CBCFF | Bright and airy |
| Teal | #0F9A94 | #3FD0C8 | Cool and focused |
| Forest | #1E8A4C | #4FC97F | Grounded green |
| Lime | #4F8A0B | #A3DC3C | Fresh and energetic |
| Sunset | #E8612A | #FF8A57 | Warm tangerine |
| Amber | #B06F00 | #FFC23D | Golden and cosy |
| Rose | #E0458F | #FF74B4 | Soft and playful |
| Crimson | #D42A3C | #FF5C6C | Bold and confident |
| Lavender | #8456E8 | #B79BFF | Gentle violet |
| Slate | #3F4A5C | #A9B4C6 | Neutral and minimal |

**What a theme changes:** `primary`, `primary-hover`, `primary-foreground`, `primary-soft` / `accent`, `accent-foreground`, `ring`, and a light tint on `canvas`, `surface-soft`, `surface-sunken`, `hairline` and `hairline-strong` (plus `surface` and `surface-elevated` in dark mode).
**What it never changes:** text greys, semantic colours (success / warning / error / info), bot colours, typography, radii, spacing.

**Rules**
- Never hard-code a brand hex in components. Use `bg-primary`, `text-primary`, `bg-primary-soft`, `ring`, `bg-canvas`, etc., so every theme works.
- A theme is applied as `data-color-theme="<PRESET>"` on `<html>`. The same attribute on any element re-themes just that subtree, which is how the theme picker shows real previews.
- Every preset is designed for both light and dark mode, and white text on its light-mode primary must stay readable (dark presets use near-black text on primary).
- Adding a preset means adding it to the `ColorTheme` enum (database), the `ColorThemes` const and `ColorThemeFormOptions`, plus a light and dark block in `index.css`.

## Bot colours

Bots are the stars of the interface. Every bot has **one emoji + one bot colour**, chosen when it's created (a random colour is suggested).

| Name | Fill | Soft | Feels like |
|---|---|---|---|
| Grape | #6B4EFF | #EEEAFF | Smart, default |
| Tangerine | #FF7A3D | #FFEADF | Energetic — sales |
| Sunshine | #FFC83D | #FFF5D6 | Cheerful — support |
| Mint | #1FC98E | #DBF7EC | Calm — finance, ops |
| Bubblegum | #FF5FAE | #FFE3F1 | Creative — marketing |
| Sky | #38B6FF | #DDF2FF | Curious — research |
| Lime | #9BD62F | #EEF8D9 | Fresh — growth |
| Coral | #FF5A5F | #FFE3E4 | Bold — leadership |
| Lavender | #B18CFF | #F2EBFF | Gentle — HR, people |
| Teal | #17B5B0 | #D9F4F3 | Steady — engineering |
| Ocean | #3A6BFF | #E1E9FF | Trustworthy — legal, admin |
| Graphite | #4A4560 | #ECEAF2 | Quiet — utilities |

**Where the bot colour appears**
- Avatar fill (with the emoji on top).
- A 3px colour bar on the left of the bot's name in group chats.
- Its soft tint behind the bot's name tag, its conversation in the sidebar when selected, and the header of its bot profile.
- The cursor and highlight colour when the bot is working on its cloud computer or editing an artifact.

**Rules**
- Bot colours are **identity, not meaning** — never use them for status, actions or errors.
- Text on a bot fill is the emoji only. Bot names are always written in `{colors.ink}` next to the avatar, never on the fill.
- Sunshine and Lime are light fills: their avatars get a 1px `rgba(0,0,0,0.12)` inner border to stay crisp on light surfaces.

## Typography

### Families
- **Bricolage Grotesque** (700) — display headlines: page titles, empty states, onboarding, bot profile names, artifact titles. Quirky, chunky, full of character.
- **Plus Jakarta Sans** (500 body, 600–800 labels) — everything else: messages, UI, settings. Rounded and friendly, highly readable.
- **JetBrains Mono** — code, scripts, file paths, cloud computer terminal output.

All three are free Google Fonts. Fallbacks: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

### Scale
| Token | Size / weight | Use |
|---|---|---|
| `display-xl` | 56 / 700 | Marketing and onboarding hero only |
| `display-lg` | 40 / 700 | Empty-state headlines ("Say hi to your first bot 👋") |
| `display-md` | 30 / 700 | Page titles (Bots, Skills, Artifacts, Settings) |
| `display-sm` | 24 / 700 | Dialog titles, bot profile name, section heads |
| `title-lg` | 20 / 700 | Card titles, panel headers |
| `title-md` | 17 / 700 | Conversation header, list group titles |
| `title-sm` | 15 / 700 | Names in chat, setting labels, tile titles |
| `body-lg` | 16 / 500 | Long bot answers, artifact body text |
| `body-md` | 15 / 500 | Default — chat messages and UI text |
| `body-sm` | 13 / 500 | Helper text, activity steps, metadata |
| `caption` | 12 / 600 | Timestamps, badges, chips |
| `overline` | 11 / 800 / caps | Section labels in sidebar ("BOTS", "GROUPS") |
| `code` | 13 / 400 | Code and terminal |

### Principles
- Headlines are **bold and tight** (negative tracking). Body is **medium (500)**, not regular — it gives the friendly, sturdy feel.
- Bricolage Grotesque is for moments, not for reading. Never use it for messages, buttons or form labels.
- Message text is never smaller than 15px; on mobile, 16px.
- Emoji are part of the typography: they're welcome in headlines, empty states and bot names.

## Layout

### App shell (desktop and web)
```
┌──────────────┬─────────────────────────────────┬────────────────────┐
│  Sidebar     │  Conversation                   │  Side panel        │
│  288px       │  fluid, message column max 760  │  480px (optional)  │
│              │                                 │                    │
│ Org switcher │  Header: avatars · name · tools │  Cloud computer    │
│ Search       │                                 │  Artifact preview  │
│ BOTS         │  Messages                       │  Files · Task      │
│ GROUPS       │                                 │  Bot / skill info  │
│ CHATS        │  ┌───────────────────────────┐  │                    │
│ ───────────  │  │ Composer (floating)       │  │  Resizable,        │
│ Tasks        │  └───────────────────────────┘  │  can go full width │
│ Skills       │                                 │                    │
│ Artifacts    │                                 │                    │
│ Connections  │                                 │                    │
│ Me / Settings│                                 │                    │
└──────────────┴─────────────────────────────────┴────────────────────┘
```
- **Sidebar** on `{colors.surface-soft}`; conversations grouped under overline labels; each row shows avatar(s), name, last message, unread dot (primary) and attention dot (Sunshine for approvals).
- **Conversation** on `{colors.canvas}`; messages in a centred column, max 760px wide.
- **Composer** floats 16px above the bottom with `{shadows.pop}`, so the chat scrolls underneath it.
- **Side panel** slides in from the right on `{colors.surface}`; resizable between 360px and 60% of the window; can expand to full screen.

### Spacing
- Base unit **4px**. Tokens: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72.
- Between messages from the same sender: 4px. Between different senders: 16px.
- Card padding: 16px (tiles), 20px (cards in chat), 24–28px (dialogs, settings cards).
- Page padding: 32px desktop, 16px mobile.

### Layout density
A personal setting (Settings > Appearance): **Comfortable** (default) or **Compact**. Compact sets `data-density="COMPACT"` on `<html>`, which lowers Tailwind's base `--spacing` unit from 0.25rem to 0.2125rem, so every padding, margin, gap and spacing-based size shrinks by about 15%. Text size, fixed pixel sizes (touch targets, sidebar width) and radii don't change. To make density work, **use Tailwind spacing utilities (`p-4`, `gap-3`) for spacing**, not arbitrary pixel values (`p-[16px]`).

### Pages
- Bots, Skills, Artifacts and Connections pages use a **card grid**: 4-up wide desktop, 3-up desktop, 2-up tablet, 1-up mobile, 16px gaps.
- Settings use a left category list + a single 720px column of grouped setting cards.

## Elevation and depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow | Sidebar, chat background, list rows |
| Sticker | `{shadows.sticker}` + hairline | Cards, tiles, bot bubbles, chips |
| Sticker strong | `{shadows.sticker-strong}` | Primary buttons, approval cards, raised/selected cards |
| Pop | `{shadows.pop}` | Composer, menus, popovers, dialogs, toasts |

**Shadows stay subtle**: a faint 1–2px shadow (`sticker`) lifts cards and buttons just enough to read as layers; depth comes mostly from hairline borders and surface contrast. On press, buttons move down 1px.

## Shapes

| Token | Value | Use |
|---|---|---|
| `xs` | 6px | Tiny elements, checkbox, code inline |
| `sm` | 10px | Menu items, small tiles, tooltips |
| `md` | 14px | Inputs, bot avatars (squircle), thumbnails |
| `lg` | 20px | Cards, interactive replies, artifact cards, approval cards |
| `xl` | 28px | Composer, dialogs, side-panel cards |
| `bubble` | 20px | Chat bubbles — the corner nearest the sender tightens to 6px |
| `pill` | 9999px | Buttons, badges, chips, activity steps, segmented controls |
| `full` | 50% | People avatars, icon buttons, status dots |

**Bots are squircles, people are circles.** This tiny rule lets users tell bots and humans apart instantly in any group, at any size.

## Motion

Motion is **quick and bouncy**, used to show cause and effect — never to slow anyone down.

| Moment | Animation |
|---|---|
| New message | Slides up 8px + fades in, `duration-base`, `ease-bounce` |
| Bot is thinking | Three dots in the bot's colour, gently bouncing |
| Streaming reply | Text appears in natural chunks; no blinking cursor |
| Activity step | Each step pops in (scale 0.96 → 1, `ease-bounce`); spinner turns into a Mint tick when done |
| Approval card | Arrives with a single soft "wiggle" (±2°, once) to draw attention |
| Button press | Moves down 2px, `duration-instant` |
| Side panel | Slides in from the right, `duration-base`, `ease-standard` |
| Published artifact / skill saved / first task done | Small confetti burst in bot and accent colours (max 1.2s) |
| Hover on cards | Lifts 2px, sticker shadow grows |

- Durations: 90ms (press) · 160ms (hover, small changes) · 240ms (enter, panels) · 400ms (celebrations).
- **Respect "reduce motion"**: replace slides and bounces with simple fades, and turn off confetti and wiggles.
- Never animate while the user is typing or reading long content.

## Components

### Bot avatar
Squircle (`{rounded.md}`) filled with the bot's colour, emoji centred at 60% of the size. Sizes 24 / 32 / 40 / 56 / 88px. When the bot is working, a ring in its colour softly pulses around the avatar. In groups, stacked avatars overlap by 30% with a 2px canvas-coloured outline.

### Person avatar
Circle with photo, or initials on a soft bot-colour tint chosen from the person's name. Same sizes as bot avatars. Online status: 10px Mint dot.

### Messages
- **User messages:** right-aligned, primary bubble, `on-primary` text, bottom-right corner 6px.
- **Bot messages:** left-aligned, avatar + bold name + time above, white bubble with hairline border, bottom-left corner 6px. Long answers drop the bubble and render as clean page-like text so tables, code and lists have room.
- **Other people in groups:** left-aligned, `{colors.surface-sunken}` bubble, circle avatar.
- **Message actions** (copy, retry, retry with another model, branch, react, pin) appear on hover as a small pill toolbar with `{shadows.pop}`; on mobile, on long-press.
- **Reactions:** emoji chips (pill, `{colors.surface}`, hairline) below the bubble; tapping adds yours with a tiny bounce.

### Composer
Large rounded (`{rounded.xl}`) floating box with `{shadows.pop}`. Contains: attach button, the text area (grows to 8 lines), an `@` bot picker, a `/` skill picker, voice button and a primary circular send button. When focused, the border turns primary with `{shadows.glow-primary}`. When a bot is working, the send button becomes a "Stop" button (square icon).

The `/` and `@` pickers open as a popover above the composer: skills show their emoji + name + one-line description; bots show avatar + name.

### Activity steps
A row of pill chips under the bot's message (`{colors.surface-sunken}`, `body-sm`, muted text) — "🔎 Searching Gmail – Sales", "🌐 Opening hubspot.com", "📝 Writing report.docx". The current step has a small spinner; finished steps get a Mint tick. Collapsed by default into a single summary pill ("7 steps · 1m 12s") that expands on click. A **"Watch"** pill with a Mint live dot appears when the bot is using its cloud computer.

### Approval card
The one place playfulness steps back. `{colors.warning-soft}` background, 1.5px Sunshine border, `{rounded.lg}`, `{shadows.sticker-strong}`. Shows: what the bot wants to do (title-md), which account, a full preview of the content (e.g. the exact email), and three buttons — **Approve** (primary), **Edit** (secondary), **Reject** (ghost). Sensitive bot-to-bot requests use the same card.

### Interactive reply frame
A white `{rounded.lg}` card with hairline border inside the message flow. Small header row: icon, title, and actions (open in panel, full screen, pin, save as widget, show as text). Content uses the same tokens as the app so it always looks native. Loading state: soft shimmer in `{colors.surface-sunken}`.

### Artifact card
Shown in chat and on the Artifacts page. Top: a live thumbnail on `{colors.surface-sunken}` (16:10). Bottom: type icon, title (title-sm), sharing badge (Private / Members / Organisation / Public with globe icon), version ("v12") and last edited time. Clicking opens the side panel with tabs: Preview · Versions · Comments · Share.

### Skill chip
Pill with emoji + skill name on `{colors.primary-soft}`, `caption` text in `{colors.primary-active}`. Used in the `/` picker, on bot profiles, and above a bot's reply when it follows a skill ("Using 🤝 Client onboarding").

### Connection tile
White card with the service logo (40px), the friendly label ("Gmail – Sales"), account email in muted text, and a status badge: Mint "Active", Sunshine "Reconnect", Coral-red "Error". Shared connections show a small "Shared" badge with a people icon.

### Cloud computer panel
Side-panel view with a dark frame (`{colors.dark-surface}`) around the live screen, `{rounded.lg}`. Top bar: Mint "LIVE" pill, bot avatar, the website or file being used, and buttons **Take control** (primary) / **Hand back** and **Full screen**. While the user has control, the frame border turns primary and shows "You're in control".

### Buttons
| Variant | Look | Use |
|---|---|---|
| Primary | Primary pill, `on-primary` text, sticker-strong shadow | One main action per view |
| Secondary | White pill, 1.5px hairline-strong border, sticker shadow | Other actions |
| Ghost | No background; soft tint on hover | Toolbars, low-priority actions |
| Danger | Error-red pill | Delete, disconnect, remove — always confirmed |
| Icon | 36px circle | Toolbars, message actions |

Heights: 32px (small), 40px (default), 48px (large / mobile primary).

### Inputs and forms
42px tall, `{rounded.md}`, 1.5px hairline-strong border, white background. Focus: primary border + glow ring. Error: error border + message below with an icon. Toggles are chunky pills (44×26) that turn primary when on with a little knob bounce. Segmented controls (e.g. "Short / Balanced / Detailed") are pills inside a sunken pill track.

### Badges, toasts and dialogs
- **Badges:** pill, caption type. "New" badges are Tangerine with overline type.
- **Toasts:** near-black (`{colors.ink}`) pill-ish cards bottom-centre, with an icon and an optional action ("Undo", "View"), auto-hide after 5s.
- **Dialogs:** `{rounded.xl}`, 28px padding, `{shadows.pop}`, Bricolage `display-sm` title. Backdrop: `rgba(0,0,0,0.4)` with a slight blur.

### Empty states
Every empty page gets a friendly illustration-style composition of bot avatars (big emoji squircles in bot colours, slightly rotated like stickers), a Bricolage headline and one clear primary button:
- Bots: "Your team is a little quiet 🦗" → **Create a bot**
- Skills: "Teach your bots a trick 🎩" → **Create a skill**
- Artifacts: "Nothing built yet — ask a bot to make something ✨"
- Tasks: "All caught up 🎉"

## Icons and illustration
- **Icons:** Lucide, 1.75px stroke, rounded caps and joins, 18px default (16px in dense UI, 20px in navigation).
- **Emoji** are a first-class visual element (bot avatars, skills, empty states, activity steps). Use the system emoji font; never replace emoji with icons where a bot or skill is being identified.
- **Illustrations** are built from the product's own pieces — squircle bot avatars, chat bubbles, chips — arranged playfully, tilted ±6°, with soft shadows. No stock photography, no 3D robots, no glowing brains.

## Writing in the interface
Friendly and short, with personality in the small places:
- Buttons are plain and exact: "Create bot", "Give to bots", "Publish", "Take control".
- Personality lives in empty states, success messages and loading lines: "Sharpening pencils…", "Done! Sent 12 emails ✉️".
- **No jokes in errors, approvals, security or billing.** Say what happened and what to do next.
- Use the product's words consistently: bot, conversation, group, connection, skill, artifact, cloud computer, task, automation, approval.

## Do's and Don'ts

### Do
- Keep primary as the **only** action colour, and reference it by token so colour themes work.
- Let bots be the most colourful thing on screen.
- Use squircles for bots and circles for people — everywhere.
- Keep shadows subtle on resting cards and buttons; save larger blurred shadows for floating layers.
- Keep long reading areas calm: no bubbles, no decoration, generous line height.
- Celebrate real achievements (first bot, first task, published artifact) — briefly.
- Design every screen in light **and** dark mode.

### Don't
- Don't use bot colours or accents for buttons, links or status.
- Don't use Bricolage Grotesque for body text, buttons or form labels.
- Don't use pure `#000` for text or tint the neutral greys — keep text on the zinc scale so it works under every colour theme.
- Don't add playful motion or copy to approvals, errors, security or money.
- Don't stack more than one celebration at a time, and never block the user with one.
- Don't show status by colour alone.
- Don't use sharp corners (under 6px) anywhere except inline code.

## Responsive behaviour

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 768px | One screen at a time: conversation list → chat → side panel opens as a full-screen sheet. Bottom tab bar: Chats · Tasks · Artifacts · Me. Composer docks to the bottom. |
| Tablet | 768–1199px | Sidebar collapses to a 72px rail of avatars (expands on tap); side panel overlays the chat. |
| Desktop | 1200–1599px | Full three-column shell; side panel pushes the chat narrower. |
| Wide | ≥ 1600px | Same as desktop; side panel default width 560px. |

- Touch targets at least 44×44px on mobile; primary buttons 48px tall.
- Mobile message text 16px; composer stays above the keyboard.
- On mobile, the cloud computer view supports pinch-to-zoom and a simplified control bar.

## Accessibility
- All text meets **WCAG AA contrast** (4.5:1 body, 3:1 large text and UI). Neutral primary (near-black on white, white on near-black) is above 15:1; every colour theme keeps `on-primary` text readable on its primary.
- Light bot colours (Sunshine, Lime) are never used behind text.
- Visible focus on everything: 2px primary outline + glow ring, in both modes and every colour theme.
- Full keyboard navigation: `Ctrl/Cmd+K` search, `Ctrl/Cmd+N` new chat, `↑` to edit last message, `Esc` to stop a bot or close a panel.
- Screen readers: bots announced as "[name], bot"; activity steps and streaming replies use polite live regions; interactive replies always offer a text version.
- Respect reduced motion and the user's text-size setting.

## Implementation mapping (shadcn/ui)
The app uses shadcn/ui; its theme variables map to these tokens (values shown for the default Neutral colour theme; other presets override them via `[data-color-theme]` in `app/src/index.css`):

| shadcn variable | Light | Dark |
|---|---|---|
| `--background` | canvas #FFFFFF | #0A0A0A |
| `--foreground` | ink #0D0D0F | #FAFAFA |
| `--card` / `--popover` | surface #FFFFFF | #141414 / #1C1C1C |
| `--primary` / `--primary-foreground` | #0D0D0F / #FFFFFF | #FAFAFA / #0A0A0A |
| `--secondary` | surface-sunken #EFEFF1 | #050505 |
| `--muted` / `--muted-foreground` | surface-soft #F7F7F8 / #71717A | #111111 / #A1A1AA |
| `--accent` / `--accent-foreground` | primary-soft #EFEFF1 / ink | #262626 / ink |
| `--destructive` | #E5484D | #FF6B6F |
| `--border` / `--input` | #E7E7EA / #D4D4D8 | #262626 / #363636 |
| `--ring` | = primary | = primary |
| `--radius` | 14px | 14px |

Bot colours are exposed as `--bot-<name>` and `--bot-<name>-soft` variables. Artifacts and interactive replies load the same theme so everything bots build looks native, unless the organisation chooses its own brand colour, which then replaces the primary colour inside artifacts only.

## Iteration guide
1. Work on one component at a time and reference its token key (e.g. `{components.approval-card}`).
2. Always use tokens — never hard-code colours, radii or shadows.
3. New variants go in `components:` as `<name>-<variant>` (e.g. `button-primary-small`).
4. Before adding a new colour, check whether a bot colour, accent or semantic colour already covers it. The palette is complete on purpose.
5. When something feels dull, add personality through **shape, emoji, copy or a micro-interaction** — not more colours.
6. When something feels risky for the user, remove the playfulness and make it clearer.
