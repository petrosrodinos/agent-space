---
version: 1.0
name: agent-space-design-system
description: A playful, friendly and confident interface for Agent Space — a messaging-style home for AI co-workers. Warm cream canvas, a vivid "Grape" primary, a candy-bright bot palette, chunky rounded shapes, soft "sticker" shadows and bouncy-but-quick motion. Characterful grotesque display type paired with a clean, rounded humanist sans for everyday reading. Playful in personality, serious about clarity, safety and accessibility.

colors:
  # Brand
  primary: "#6B4EFF"            # Grape — main actions, links, focus
  primary-hover: "#5A3DF0"
  primary-active: "#4A2FD6"
  primary-soft: "#EEEAFF"       # Grape tint — selected states, highlights
  primary-disabled: "#D9D3FF"
  on-primary: "#FFFFFF"
  accent-tangerine: "#FF7A3D"   # Energy — badges, "new", celebration
  accent-sunshine: "#FFC83D"    # Attention — approvals, highlights
  accent-mint: "#1FC98E"        # Success, "live", connected
  accent-bubblegum: "#FF5FAE"   # Fun moments, reactions
  accent-sky: "#38B6FF"         # Info, links in dark bubbles

  # Light surfaces
  canvas: "#FFFBF5"             # Warm cream page floor
  surface: "#FFFFFF"            # Cards, chat panel, inputs
  surface-soft: "#FBF5EC"       # Sidebar, secondary panels
  surface-sunken: "#F4ECE0"     # Composer well, code blocks, wells
  hairline: "#EDE3D6"
  hairline-strong: "#DCCFBF"

  # Light text
  ink: "#1C1633"                # Deep plum — headlines, primary text
  body: "#3A3352"
  muted: "#6E6787"
  muted-soft: "#9A93AE"

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
  dark-canvas: "#13101F"
  dark-surface: "#1C1830"
  dark-surface-soft: "#17142A"
  dark-surface-elevated: "#262040"
  dark-surface-sunken: "#0F0C1A"
  dark-hairline: "#2E2848"
  dark-hairline-strong: "#3D3560"
  dark-ink: "#F6F3FF"
  dark-body: "#D6D0EA"
  dark-muted: "#A49CC2"
  dark-muted-soft: "#7A7298"
  dark-primary: "#8E78FF"
  dark-primary-soft: "#2C2457"

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
  sticker: "0 2px 0 rgba(28,22,51,0.08)"                                      # resting cards, chips
  sticker-strong: "0 3px 0 rgba(28,22,51,0.12)"                               # buttons, raised cards
  pop: "0 2px 0 rgba(28,22,51,0.08), 0 12px 32px -8px rgba(28,22,51,0.18)"    # menus, popovers, dialogs
  glow-primary: "0 0 0 4px rgba(107,78,255,0.22)"                             # focus ring
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

The personality is **playful, warm and confident**. Playful does not mean childish: the interface is clean and calm by default, and the fun lives in specific places — the bots' candy-coloured avatars, chunky rounded shapes, little "sticker" shadows, bouncy micro-moments and cheerful microcopy. When a bot is doing something serious (sending an email, spending money, touching sensitive data), the playfulness steps back and clarity takes over.

**Key characteristics**
- **Warm cream canvas** (`{colors.canvas}` #FFFBF5) instead of cold white — the app feels like paper, not a dashboard.
- **Grape** (`{colors.primary}` #6B4EFF) is the single brand action colour: primary buttons, the user's own chat bubbles, links, focus rings and selected states.
- **Bots bring the colour.** Each bot picks one of 12 bright bot colours plus an emoji. Bot colours carry the most saturation on screen, so users recognise bots instantly.
- **Chunky and round.** Pill buttons, 20px cards, squircle bot avatars, bubbly chat messages.
- **Sticker shadows** — a short, solid, offset shadow under cards and buttons gives a tactile, slightly "cut-out" look. Real blurred shadows only appear on floating things (menus, dialogs, composer).
- **Characterful headlines** in Bricolage Grotesque, bold and tightly tracked; everything else in Plus Jakarta Sans, a rounded, friendly sans that stays very readable at small sizes.
- **Motion with a little bounce** — quick, purposeful, with a small overshoot on "pop" moments (a new message, an approval, a published artifact).

## Colors

### Brand
- **Grape** (`{colors.primary}` #6B4EFF) — primary buttons, user bubbles, links, focus, selection. Hover `{colors.primary-hover}`, pressed `{colors.primary-active}`.
- **Grape Soft** (`{colors.primary-soft}` #EEEAFF) — selected conversation, active tab, skill chips, highlighted rows.
- **Tangerine** (`{colors.accent-tangerine}` #FF7A3D) — "New" badges, celebratory moments, streaks. Never for errors.
- **Sunshine** (`{colors.accent-sunshine}` #FFC83D) — approvals and "needs your attention".
- **Mint** (`{colors.accent-mint}` #1FC98E) — "live", "connected", "done".
- **Bubblegum** (`{colors.accent-bubblegum}` #FF5FAE) and **Sky** (`{colors.accent-sky}` #38B6FF) — reactions, illustrations, onboarding confetti.

Accent colours are **decoration and signals, not actions**. The only colour that means "click me" is Grape.

### Surfaces (light)
| Token | Hex | Use |
|---|---|---|
| `{colors.canvas}` | #FFFBF5 | App background, chat area background |
| `{colors.surface}` | #FFFFFF | Cards, bot bubbles, inputs, side panel, dialogs |
| `{colors.surface-soft}` | #FBF5EC | Left sidebar, settings navigation |
| `{colors.surface-sunken}` | #F4ECE0 | Activity steps, code blocks, empty wells |
| `{colors.hairline}` | #EDE3D6 | Default borders and dividers |
| `{colors.hairline-strong}` | #DCCFBF | Input and secondary-button borders |

### Text (light)
| Token | Hex | Use |
|---|---|---|
| `{colors.ink}` | #1C1633 | Headlines, message text, primary labels |
| `{colors.body}` | #3A3352 | Long-form text, descriptions |
| `{colors.muted}` | #6E6787 | Secondary text, timestamps, helper text |
| `{colors.muted-soft}` | #9A93AE | Placeholders, disabled text |

Text is a **deep plum**, never pure black — it keeps the palette warm and friendly.

### Semantic
| Meaning | Strong | Soft background | Use |
|---|---|---|---|
| Success | #12A574 | #DDF7EC | Task done, connection active, published |
| Warning | #D98A00 | #FFF3D1 | Approval needed, connection expiring, near usage limit |
| Error | #E5484D | #FFE4E4 | Failed task, broken connection, validation |
| Info | #1E90E0 | #DFF1FF | Tips, neutral notices |

Status is **never shown by colour alone** — always pair it with an icon and a word.

### Dark mode
Dark mode is a deep, slightly purple night — cosy, not pitch black.

| Light token | Dark equivalent |
|---|---|
| canvas | `{colors.dark-canvas}` #13101F |
| surface | `{colors.dark-surface}` #1C1830 |
| surface-soft | `{colors.dark-surface-soft}` #17142A |
| surface-sunken | `{colors.dark-surface-sunken}` #0F0C1A |
| (menus, dialogs) | `{colors.dark-surface-elevated}` #262040 |
| hairline / hairline-strong | #2E2848 / #3D3560 |
| ink / body / muted / muted-soft | #F6F3FF / #D6D0EA / #A49CC2 / #7A7298 |
| primary / primary-soft | #8E78FF / #2C2457 |

Bot colour fills stay the same in dark mode; their soft tints switch to the `dark-soft` values.

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
- Sunshine and Lime are light fills: their avatars get a 1px `rgba(28,22,51,0.12)` inner border to stay crisp on cream.

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
- **Sidebar** on `{colors.surface-soft}`; conversations grouped under overline labels; each row shows avatar(s), name, last message, unread dot (Grape) and attention dot (Sunshine for approvals).
- **Conversation** on `{colors.canvas}`; messages in a centred column, max 760px wide.
- **Composer** floats 16px above the bottom with `{shadows.pop}`, so the chat scrolls underneath it.
- **Side panel** slides in from the right on `{colors.surface}`; resizable between 360px and 60% of the window; can expand to full screen.

### Spacing
- Base unit **4px**. Tokens: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72.
- Between messages from the same sender: 4px. Between different senders: 16px.
- Card padding: 16px (tiles), 20px (cards in chat), 24–28px (dialogs, settings cards).
- Page padding: 32px desktop, 16px mobile.

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

**The sticker shadow is the signature detail**: a short, solid, un-blurred drop of 2–3px that makes elements feel like friendly cut-outs. On press, buttons move down 2px and lose their sticker shadow — they feel physically pushed.

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
- **User messages:** right-aligned, Grape bubble, white text, bottom-right corner 6px.
- **Bot messages:** left-aligned, avatar + bold name + time above, white bubble with hairline border, bottom-left corner 6px. Long answers drop the bubble and render as clean page-like text so tables, code and lists have room.
- **Other people in groups:** left-aligned, `{colors.surface-sunken}` bubble, circle avatar.
- **Message actions** (copy, retry, retry with another model, branch, react, pin) appear on hover as a small pill toolbar with `{shadows.pop}`; on mobile, on long-press.
- **Reactions:** emoji chips (pill, `{colors.surface}`, hairline) below the bubble; tapping adds yours with a tiny bounce.

### Composer
Large rounded (`{rounded.xl}`) floating box with `{shadows.pop}`. Contains: attach button, the text area (grows to 8 lines), an `@` bot picker, a `/` skill picker, voice button and a Grape circular send button. When focused, the border turns Grape with `{shadows.glow-primary}`. When a bot is working, the send button becomes a "Stop" button (square icon).

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
Side-panel view with a dark frame (`{colors.dark-surface}`) around the live screen, `{rounded.lg}`. Top bar: Mint "LIVE" pill, bot avatar, the website or file being used, and buttons **Take control** (primary) / **Hand back** and **Full screen**. While the user has control, the frame border turns Grape and shows "You're in control".

### Buttons
| Variant | Look | Use |
|---|---|---|
| Primary | Grape pill, white text, sticker-strong shadow | One main action per view |
| Secondary | White pill, 1.5px hairline-strong border, sticker shadow | Other actions |
| Ghost | No background; soft tint on hover | Toolbars, low-priority actions |
| Danger | Error-red pill | Delete, disconnect, remove — always confirmed |
| Icon | 36px circle | Toolbars, message actions |

Heights: 32px (small), 40px (default), 48px (large / mobile primary).

### Inputs and forms
42px tall, `{rounded.md}`, 1.5px hairline-strong border, white background. Focus: Grape border + glow ring. Error: error border + message below with an icon. Toggles are chunky pills (44×26) that turn Grape when on with a little knob bounce. Segmented controls (e.g. "Short / Balanced / Detailed") are pills inside a sunken pill track.

### Badges, toasts and dialogs
- **Badges:** pill, caption type. "New" badges are Tangerine with overline type.
- **Toasts:** dark plum (`{colors.ink}`) pill-ish cards bottom-centre, with an icon and an optional action ("Undo", "View"), auto-hide after 5s.
- **Dialogs:** `{rounded.xl}`, 28px padding, `{shadows.pop}`, Bricolage `display-sm` title. Backdrop: `rgba(28,22,51,0.4)` with a slight blur.

### Empty states
Every empty page gets a friendly illustration-style composition of bot avatars (big emoji squircles in bot colours, slightly rotated like stickers), a Bricolage headline and one clear primary button:
- Bots: "Your team is a little quiet 🦗" → **Create a bot**
- Skills: "Teach your bots a trick 🎩" → **Create a skill**
- Artifacts: "Nothing built yet — ask a bot to make something ✨"
- Tasks: "All caught up 🎉"

## Icons and illustration
- **Icons:** Lucide, 1.75px stroke, rounded caps and joins, 18px default (16px in dense UI, 20px in navigation).
- **Emoji** are a first-class visual element (bot avatars, skills, empty states, activity steps). Use the system emoji font; never replace emoji with icons where a bot or skill is being identified.
- **Illustrations** are built from the product's own pieces — squircle bot avatars, chat bubbles, chips — arranged playfully, tilted ±6°, with sticker shadows. No stock photography, no 3D robots, no glowing brains.

## Writing in the interface
Friendly and short, with personality in the small places:
- Buttons are plain and exact: "Create bot", "Give to bots", "Publish", "Take control".
- Personality lives in empty states, success messages and loading lines: "Sharpening pencils…", "Done! Sent 12 emails ✉️".
- **No jokes in errors, approvals, security or billing.** Say what happened and what to do next.
- Use the product's words consistently: bot, conversation, group, connection, skill, artifact, cloud computer, task, automation, approval.

## Do's and Don'ts

### Do
- Keep Grape as the **only** action colour.
- Let bots be the most colourful thing on screen.
- Use squircles for bots and circles for people — everywhere.
- Use the sticker shadow on resting cards and buttons; save blurred shadows for floating layers.
- Keep long reading areas calm: no bubbles, no decoration, generous line height.
- Celebrate real achievements (first bot, first task, published artifact) — briefly.
- Design every screen in light **and** dark mode.

### Don't
- Don't use bot colours or accents for buttons, links or status.
- Don't use Bricolage Grotesque for body text, buttons or form labels.
- Don't use pure white backgrounds for the page or pure black for text.
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
- All text meets **WCAG AA contrast** (4.5:1 body, 3:1 large text and UI). Grape on white is 5:1; white on Grape passes for button text.
- Light bot colours (Sunshine, Lime) are never used behind text.
- Visible focus on everything: Grape 2px outline + glow ring, in both themes.
- Full keyboard navigation: `Ctrl/Cmd+K` search, `Ctrl/Cmd+N` new chat, `↑` to edit last message, `Esc` to stop a bot or close a panel.
- Screen readers: bots announced as "[name], bot"; activity steps and streaming replies use polite live regions; interactive replies always offer a text version.
- Respect reduced motion and the user's text-size setting.

## Implementation mapping (shadcn/ui)
The app uses shadcn/ui; its theme variables map to these tokens:

| shadcn variable | Light | Dark |
|---|---|---|
| `--background` | canvas #FFFBF5 | #13101F |
| `--foreground` | ink #1C1633 | #F6F3FF |
| `--card` / `--popover` | surface #FFFFFF | #1C1830 / #262040 |
| `--primary` / `--primary-foreground` | #6B4EFF / #FFFFFF | #8E78FF / #13101F |
| `--secondary` | surface-sunken #F4ECE0 | #0F0C1A |
| `--muted` / `--muted-foreground` | #FBF5EC / #6E6787 | #17142A / #A49CC2 |
| `--accent` / `--accent-foreground` | primary-soft #EEEAFF / #4A2FD6 | #2C2457 / #F6F3FF |
| `--destructive` | #E5484D | #FF6B6F |
| `--border` / `--input` | #EDE3D6 / #DCCFBF | #2E2848 / #3D3560 |
| `--ring` | #6B4EFF | #8E78FF |
| `--radius` | 14px | 14px |

Bot colours are exposed as `--bot-<name>` and `--bot-<name>-soft` variables. Artifacts and interactive replies load the same theme so everything bots build looks native, unless the organisation chooses its own brand colour, which then replaces Grape inside artifacts only.

## Iteration guide
1. Work on one component at a time and reference its token key (e.g. `{components.approval-card}`).
2. Always use tokens — never hard-code colours, radii or shadows.
3. New variants go in `components:` as `<name>-<variant>` (e.g. `button-primary-small`).
4. Before adding a new colour, check whether a bot colour, accent or semantic colour already covers it. The palette is complete on purpose.
5. When something feels dull, add personality through **shape, emoji, copy or a micro-interaction** — not more colours.
6. When something feels risky for the user, remove the playfulness and make it clearer.
