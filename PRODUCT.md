# Agent Space — Product

> The short version of what Agent Space is, who it's for and how it should feel. Read this before designing or building any part of the product.
>
> - Full requirements: [docs/Product_Specification.md](docs/Product_Specification.md)
> - Visual design system: [DESIGN.MD](DESIGN.MD)

---

## What it is

Agent Space is an AI co-worker platform for companies. People create their own AI **bots**, give them access to the tools they already use, and chat with them — alone or in groups with colleagues and other bots. Bots don't just answer; they **do the work**: send the email, update the CRM, research the web on their own cloud computer, build a dashboard, publish a page.

**One-line pitch:** Your team's AI co-workers — connected to your tools, working on their own computers, right inside your chats.

Available on web, desktop (Windows, Mac) and mobile (iPhone, Android).

---

## Who it's for

| Who | What they want from Agent Space |
|---|---|
| Founders and business owners | One assistant across inbox, calendar, research and reporting |
| Sales teams | Lead research, outreach drafts, CRM updates, meeting prep |
| Marketing teams | Content, competitor research, landing pages, campaign reports |
| Operations and admin | Repetitive work automated across tools |
| Team leads | Shared bots, shared accounts and repeatable ways of working |
| Organisation owners | Control over members, access, safety and usage |

The typical user is a **busy professional, not a developer**. They should never need to understand how the product works underneath.

---

## The problem we solve

- Work is spread across dozens of tools, and moving information between them is manual.
- Chat-only AI assistants give advice but can't act in your real tools.
- Every team member re-explains the same context and procedures to AI again and again.
- Companies worry about AI acting without oversight or seeing data it shouldn't.

## Our answer

1. **Bots that act** — connected to real accounts, with their own cloud computer.
2. **Bots that know you** — memory, company knowledge and reusable skills.
3. **Bots that work as a team** — group chats, bots consulting each other.
4. **People stay in control** — approvals, live view, take-over, full activity history.

---

## Core building blocks

| Concept | In one sentence |
|---|---|
| **Organisation** | A company workspace; people can belong to several. Roles: Owner, Admin, Member. |
| **Bot** | An AI assistant with a name, emoji, colour, instructions, AI model, tools, skills and memory. |
| **Conversation** | A direct chat, a shared bot chat, or a group with several bots and people. |
| **Connection** | A linked account (e.g. "Gmail – Sales"); several per service; private or shared. |
| **Skill** | A reusable step-by-step way of doing a job, given to any bot, mentioned with `/`. |
| **Cloud computer** | A bot's own private computer that users can watch live and take over. |
| **Interactive reply** | A form, chart or mini-app the bot builds right inside the chat. |
| **Artifact** | A complete app, page, dashboard or document with its own link, sharing and versions. |
| **Task / Automation** | Long-running work, or work that runs on a schedule or trigger. |

---

## Product principles

These guide every product and design decision.

1. **Do, don't just talk.** Every feature should help a bot finish real work. A reply that ends with "you could…" is a missed opportunity to act.
2. **Ask a bot for anything.** Anything a user can do in settings, they can also do by asking a bot — create bots, assign skills, change settings, share artifacts. The only exceptions are security, billing and destructive organisation actions.
3. **Always visible, always interruptible.** Users can see what a bot is doing, why, and with which account — and can stop, approve, correct or take over at any moment.
4. **Confirm before consequences.** Anything hard to undo, external or sensitive needs a clear, previewed approval. Everything else should just happen.
5. **Private by default, easy to share.** New bots, skills and artifacts are private. Sharing is one clear step, with obvious roles.
6. **Nothing is lost.** Skills and artifacts are versioned; deletions can be restored for 30 days; restoring never overwrites history.
7. **Simple surface, deep options.** Sensible defaults out of the box; detailed settings exist but never block the first experience. Time from sign-up to first completed task: under 5 minutes.
8. **Same product everywhere.** Web, desktop and mobile share the same features, words and behaviour; layouts adapt.

---

## Personality and voice

**Brand personality:** playful, warm, capable and trustworthy. A fun, brilliant colleague you love working with — not a gadget, not a hype machine. Playfulness lives in the bots, the shapes, small celebrations and friendly copy; it always steps back for approvals, errors, security and money.

| We are | We are not |
|---|---|
| Warm and human | Cold, robotic or corporate |
| Confident and clear | Vague, hedging or over-excited |
| Calm, even when things fail | Alarming or blaming |
| Concise | Wordy or full of jargon |
| Transparent about what's happening | Mysterious about what the AI is doing |

**Writing in the product**
- Plain language. Say "connect your Gmail", not "authorise an OAuth integration".
- Use the product's own words consistently: *bot, conversation, group, connection, skill, artifact, cloud computer, task, automation, approval*.
- Buttons say exactly what happens ("Send email", "Publish", "Give to bots"), and the follow-up message uses the same word ("Published").
- Bots speak in first person and report what they did, not what they "will try" to do: "Sent the follow-up to Anna (Gmail – Sales)."
- Errors explain what happened and what to do next, without blame: "Your HubSpot connection needs signing in again. Reconnect."
- Interface languages: English and Greek.

---

## How it should feel

- **A modern messaging app first.** Conversation list on the left, chat in the centre, a side panel on the right for the cloud computer, artifacts, files and task details.
- **Bots are recognisable at a glance** by their emoji and colour — everywhere they appear.
- **Work feels alive.** Replies, activity steps, interactive replies and artifacts appear progressively as the bot works; long tasks show clear progress.
- **Playful but uncluttered.** Bright bot colours, chunky rounded shapes and bouncy micro-moments on a calm cream canvas with clear hierarchy. The user's content and the bots' work stay the focus.
- **Light and dark mode**, accessible (keyboard navigation, screen readers, good contrast), comfortable on a phone.
- Visual details — colours, type, spacing, components — follow [DESIGN.MD](DESIGN.MD).

---

## What we are not building (first release)

- Custom roles or a permissions editor in the interface (three fixed roles only).
- Our own sign-in connections to Google, Microsoft, etc. — all account connections go through our connection partner.
- Guests from outside the organisation in conversations.
- A public marketplace for selling bots or skills.
- Languages other than English and Greek.

---

## How we measure success

- Time from sign-up to first completed task (target: under 5 minutes)
- Tasks completed by bots each week, and the share completed without help
- Weekly active users and active bots per organisation
- Approval acceptance rate (bots proposing the right actions)
- Skills created and reused; artifacts published and shared
- Team growth (members per organisation)
- Satisfaction with completed tasks
