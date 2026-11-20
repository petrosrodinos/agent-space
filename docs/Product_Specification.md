# Agent Space — Product Specification

**Version:** 1.3
**Date:** 18 November 2026
**Status:** Mostly implemented. See §19 for what is built, what is left and what was skipped on purpose.

---

## 1. Summary

Agent Space is a personal and team AI assistant platform for companies. Users create their own AI "bots" — each with a name, look and personality — and give them access to the tools they already use (email, calendar, documents, CRM, chat and more). Bots don't just answer questions: they take action. Each bot can use its own private computer in the cloud to browse websites, work with files, run tasks and complete multi-step jobs, and the user can watch it work live or take over at any time.

Bots live in conversations, much like a messaging app. A user can talk to one bot directly, or set up a group where several bots (for example a Sales bot and a Marketing bot) and several colleagues work together. Bots can see what other bots know and ask each other for help.

Agent Space is available on the web, as a desktop app (Windows and Mac) and as a mobile app (Android), with the same experience everywhere.

---

## 2. Vision and Goals

**Vision:** Give every person and team in a company a capable AI co-worker that can do real work in their real tools, safely and transparently.

**Goals**

1. **Do, not just chat.** Bots complete tasks end to end — send the email, update the spreadsheet, research the website, produce the report.
2. **Connect everything.** Users connect their accounts in a few clicks, including several accounts from the same service (for example two Gmail inboxes).
3. **Built for teams.** Organisations, roles, shared connections and shared bots work naturally.
4. **Transparent and in control.** Users can see what a bot is doing, watch its computer screen, approve sensitive actions and step in by hand.
5. **Conversational setup.** Anything a user can change in settings, they can also change just by asking a bot.

**Non-goals for the first release**

- Custom roles or a permission editor in the app (roles are fixed; see §5).
- Building our own sign-in connections to Google, Microsoft etc. All third-party account connections go through our connection partner.
- A public marketplace for selling bots.
- Guests from outside the organisation in conversations. Only organisation members can take part.
- Languages other than English and Greek.

---

## 3. Who It's For

| Persona | Needs |
|---|---|
| **Founder / Business owner** | One assistant that handles inbox, calendar, research and reporting across the business. |
| **Sales rep** | A bot that researches leads, drafts outreach, updates the CRM and prepares for meetings. |
| **Marketing manager** | A bot that drafts content, checks competitors' websites, schedules posts and reports results. |
| **Operations / Admin** | Automates repetitive work: copying data between tools, filling forms, generating documents. |
| **Team lead** | Shared bots and shared accounts for the team, with control over who can do what. |
| **Organisation owner / IT** | Manages members, roles, shared connections and audit history. |

---

## 4. Key Concepts

| Term | Meaning |
|---|---|
| **Organisation** | A company or team workspace. Holds members, bots, conversations and connections. |
| **Member** | A person who belongs to an organisation, with a role: Owner, Admin or Member. |
| **Bot** | An AI assistant with its own name, emoji, colour, instructions (personality and job), tools and memory. |
| **Conversation** | A chat. Can be one person with one bot, several people with one bot, or a group with several bots and people. |
| **Secret** | An access key or token a user has given Agent Space so bots can use a service. Stored encrypted, never shown again and never seen by bots; managed on the Secrets page (§8.9). |
| **Connection** | A linked account in another service (e.g. "Gmail – sales@company.com"), connected by signing in or by pasting an access key. Can be **private** or **shared** with the organisation. Bots use connections without ever seeing the passwords, tokens or keys behind them (§8.7). |
| **Custom tool server** | An additional tool source a user adds themselves (for example their company's internal system), with its own sign-in. |
| **Built-in tools** | Abilities Agent Space provides itself, such as web search, file creation, reminders, memory and managing the app's own settings. |
| **Cloud computer** | A private virtual computer given to a bot to browse, run tasks and work with files. Users can watch and control it. |
| **Skill** | A reusable, step-by-step way of doing a specific job that can be given to any bot. See §6.7. |
| **Artifact** | A complete app, page, dashboard, document or presentation built by a bot, with its own link, sharing permissions and version history. See §7.5. |
| **Voice mode** | Chatting with a bot by speaking instead of typing, with the bot answering out loud in real time. The bot can use all the same tools as in text chat. See §7.6. |
| **File storage** | Where all files in Agent Space are kept (Google Cloud Storage), each one openable only by people who can see where it lives. See §7.7. |
| **Task** | A piece of work a bot carries out, possibly over several steps and several minutes or hours. |
| **Automation** | A job a bot does again and again by itself, on a schedule or when something happens (e.g. "every Monday at 9am" or "when a new lead arrives"), with its own pre-approved actions and memory between runs. See §10. |

---

## 5. Organisations, Members and Roles

### 5.1 Organisations
- Anyone can sign up and create an organisation. A personal organisation is created automatically on first sign-up.
- A person can create several organisations and belong to many organisations at once.
- A switcher (top-left) lets users move between organisations quickly. Everything — bots, chats, connections — belongs to the currently selected organisation.
- Each organisation has a name, logo and default settings (e.g. default language, time zone, default bot behaviour).

### 5.2 Inviting people
- Owners and Admins invite people by email or with a shareable invite link.
- Invitations show who invited them, the organisation and the role offered. They expire after 7 days and can be cancelled or re-sent.
- Invited people who don't yet have an account create one as part of accepting.

### 5.3 Roles
Three fixed roles. The app shows the role name next to each member but does **not** show a permissions grid or allow editing what each role can do. (The underlying system is built so that more detailed permissions can be added later.)

| Ability | Owner | Admin | Member |
|---|:-:|:-:|:-:|
| Use bots and conversations they have access to | ✅ | ✅ | ✅ |
| Create their own private bots and conversations | ✅ | ✅ | ✅ |
| Make a bot available to the whole organisation | ✅ | ✅ | ❌ |
| Mark a bot as "Sensitive" | ✅ | ✅ | ❌ |
| Create skills and share them with specific members | ✅ | ✅ | ✅ |
| Share a skill with the whole organisation | ✅ | ✅ | ❌ |
| Add private connections | ✅ | ✅ | ✅ |
| Add / remove shared organisation connections | ✅ | ✅ | ❌ |
| Add organisation-wide custom tool servers | ✅ | ✅ | ❌ |
| Invite and remove members | ✅ | ✅ (not Owners) | ❌ |
| Change members' roles | ✅ | ✅ (up to Admin) | ❌ |
| Organisation settings and branding | ✅ | ✅ | ❌ |
| Create artifacts and share them with members or publicly | ✅ | ✅ | ✅ (public links if allowed by the organisation) |
| See all organisation and public artifacts; switch off any public link | ✅ | ✅ | ❌ |
| View organisation activity history | ✅ | ✅ | ❌ |
| Transfer ownership / delete organisation | ✅ | ❌ | ❌ |

- An organisation always has at least one Owner. The last Owner can't leave without handing over ownership.
- Members can leave an organisation at any time.

---

## 6. Bots

### 6.1 Creating a bot
A user creates a bot by either:
- **Filling in a short form**, or
- **Describing it in plain words** ("Make me a sales assistant that preps me for calls and keeps HubSpot updated") — the app drafts the bot for them to review.
- **Starting from a template.** Six templates are available at launch: Personal Assistant, Sales, Marketing, Support, Researcher and Executive Assistant. Each comes with ready-made instructions, suggested connections, a suitable AI model and sensible approval rules, all of which the user can change.

### 6.2 Bot details
| Field | Description |
|---|---|
| Name | e.g. "Sales Sam" |
| Emoji | Chat avatar icon |
| Colour | Avatar background and accent colour |
| Instructions | The bot's role, tone, rules and goals in plain language |
| AI model | The AI "brain" the bot uses (e.g. Claude, GPT, Gemini, Grok, Llama). See §6.4 |
| Description | One line shown in lists |
| Tools & connections | Which connected accounts and tools it may use (e.g. only the "Sales Gmail", not the personal one) |
| Knowledge | Files, documents and links the bot should know about |
| Skills | Reusable procedures the bot can follow (see §6.7) |
| Approval rules | Which actions need the user's OK first (see §11) |
| Visibility | Private to its creator (default), or available to the whole organisation. Only Owners and Admins can make a bot available to the whole organisation |
| Sensitive | Off by default. When on (Owners and Admins only), other bots must get the user's approval before asking this bot for information. See §6.5 |
| Cloud computer | On/off. When on, the computer pauses while idle and keeps its files, so the bot resumes where it left off. See §9 |

The full list of bot settings, with options and defaults, is in §13.3.

### 6.3 Memory
- Each bot remembers useful facts and preferences over time (e.g. "Petros prefers short emails", "our fiscal year starts in April").
- Users can view, edit and delete anything a bot remembers, in a "Memory" panel.
- Organisation-level memory holds company facts all bots can use (products, tone of voice, key contacts).

### 6.4 Choosing the AI model
- Agent Space gets its AI models through our AI partner (OpenRouter). This gives access to the leading models from many companies (Anthropic, OpenAI, Google, xAI, Meta, Mistral and others) through one place, so we're never tied to one AI company.
- **Each bot has its own model.** For example, the Research bot can use a powerful model for deep work, while a quick Assistant bot uses a faster, cheaper one.
- When picking a model, users see a simple list with its name, maker and plain-language labels such as **Fast**, **Smart**, **Best for writing**, **Best for coding**, **Can see images**, and a cost indicator ($ / $$ / $$$).
- A **"Recommended"** option is selected by default for every new bot. It is a balanced all-round model (Claude Sonnet at launch), so users who don't care don't have to choose. We can change which model is "Recommended" over time without users having to do anything.
- Owners and Admins can set a different **organisation default model** for new bots.
- By default, members can pick any available model. Owners and Admins can switch to an **approved list** so members can only choose from models they've allowed (e.g. to control costs). Bots using a model that is removed from the list switch to the organisation default and their owners are notified.
- Users can switch a bot's model at any time, in the bot's settings or by asking ("Switch the Sales bot to a faster model").
- In a conversation, users can try a reply again with a different model to compare answers.
- If a chosen model is temporarily unavailable, the bot automatically falls back to a similar model and says so.
- Usage and cost are shown per bot and per model in the usage overview.

### 6.5 Bots working together
- Every bot can, when needed, look at other bots' conversations **that the requesting user is allowed to see**, and can ask another bot to do something.
- Example: in a chat with the Marketing bot, the user asks "What did Sales promise Acme last week?" — the Marketing bot checks with the Sales bot and answers.
- When a bot consults another bot, it says so in the chat ("Asked Sales Sam…") so it's always clear where information came from.
- Bots never pass information to people who wouldn't otherwise have access to it.
- **Sensitive bots** (e.g. a Finance or HR bot): before another bot can ask a Sensitive bot for information, the user sees an approval card ("Marketing bot wants to ask Finance bot about Q3 revenue — Allow / Deny"). Bots not marked Sensitive can be consulted freely.

### 6.6 Changing things by asking
Users can change almost anything just by asking any bot, for example:
- "Rename the marketing bot to Mia and make it purple."
- "Make the sales bot more formal and tell it to always CC me."
- "Use a smarter model for the research bot."
- "Give the Sales bot the client onboarding skill." / "Create a skill for our weekly report." (see §6.7)
- "Add Anna to the Q4 Launch group."
- "Turn off notifications after 7pm."
- "Disconnect my old Outlook account from the Finance bot."

The bot shows a short summary of the change and asks for confirmation before applying it.

**Not changeable through chat** (for safety, these require the settings screens): password, email address, phone number, personal identity details, payment details, organisation security settings, transferring ownership, deleting the account or organisation. See §13.5.

### 6.7 Skills
A **skill** is a reusable, step-by-step way of doing a specific job, which any bot it's given to can follow. Skills capture "how we do things here" so bots do them the same way every time.

**Examples**
- *Client onboarding:* create the client in the CRM, set up a shared folder, send the welcome email from the template, book the kick-off call.
- *Weekly sales report:* pull this week's deals, compare with last week, build a dashboard artifact, post a summary in the Sales group.
- *Blog post:* research the topic, write in our tone of voice, follow the brand guide, create a header image, send for approval.
- *Invoice check:* read the invoice, match it with the purchase order, flag differences.

**What a skill contains**
| Part | Description |
|---|---|
| Name and emoji | e.g. "🤝 Client onboarding" |
| Short name | Used to mention it in chat, e.g. `/client-onboarding` |
| Description | When the skill should be used; bots read this to decide when it applies |
| Instructions | The steps, rules and quality checks, in plain language |
| Questions to ask first | Information the bot must collect before starting (e.g. client name, start date) |
| Files | Templates, examples, brand guides or checklists the skill uses |
| Tools and connections needed | e.g. HubSpot, Gmail, Google Drive. The bot uses the user's own access; if something is missing, it asks the user to connect it |
| Result | What it produces: a message, document, artifact, email, CRM update, etc. |

**Creating skills**
- **In the app:** a "New skill" form on the Skills page.
- **By asking any bot:** "Create a skill for how we onboard new clients: …" — the bot drafts the skill, shows it for review and saves it once confirmed.
- **From a conversation:** "Turn what we just did into a skill." The bot writes the skill based on the steps it just took.
- **Bots suggest skills:** when a user asks for the same kind of task several times, the bot offers to save it as a skill.
- **Starter skills:** Agent Space includes a library of ready-made skills (e.g. meeting prep, email follow-up, competitor research, weekly report) that users can add and adjust.
- **Import and export:** skills can be downloaded as a file and imported into another organisation.

**Editing and deleting**
- In the app, from the skill's page.
- **By asking any bot:** "Add a step to the client onboarding skill to create a Slack channel", "Rename the blog post skill to Article writer", "Delete the old invoice skill."
- The bot shows what will change and asks for confirmation before saving or deleting.
- Every change creates a new **version** (who, when, what changed). Earlier versions can be viewed and restored.
- Deleted skills are removed from all bots and can be restored for 30 days.

**Assigning skills to bots**
- A bot can have any number of skills, and a skill can be given to any number of bots.
- Skills can be assigned or removed at any time:
  - **In the app:** in the bot's settings (Skills tab), or from the skill's page ("Give to bots…").
  - **By asking any bot:** "Give the Sales bot the client onboarding skill", "Remove the blog post skill from the Support bot", "Which skills does the Marketing bot have?"
- Bot templates come with suitable starter skills already assigned.

**Using skills in conversations**
- **Automatically:** a bot uses one of its skills whenever the request matches the skill's description, and shows which skill it's following ("Using 🤝 Client onboarding").
- **By mentioning it:** typing `/` in the message box shows the available skills. Mentioning a skill (e.g. "/client-onboarding for Acme Ltd") makes the bot follow it.
- **Skills the bot doesn't have:** a user can mention any skill they can access, even if it isn't assigned to that bot; the bot uses it for that request only. The bot then offers to add it permanently.
- **In groups:** mentioning a bot and a skill together (e.g. "@Sales /weekly-sales-report") tells that bot to run that skill.
- **In automations:** skills can be run on a schedule or trigger (e.g. "Run /weekly-sales-report every Friday at 4pm").

**Sharing and permissions**
| Sharing level | Who can see and use it |
|---|---|
| **Private** (default) | Only the creator |
| **Specific members** | Chosen members of the organisation |
| **Organisation** | All members (only Owners and Admins can share a skill organisation-wide) |

| Role on a skill | Can do |
|---|---|
| **Owner** | Everything, including sharing and deleting |
| **Editor** | Use, edit, restore versions |
| **User** | Use and assign to their own bots |

- A **Skills** page lists all skills the user can access (*Mine*, *Shared with me*, *Organisation*, *Starter library*), with search and which bots use each skill.
- If a skill's owner leaves the organisation, ownership passes to an organisation Owner.

---

## 7. Conversations

### 7.1 Types
| Type | Who's in it |
|---|---|
| **Direct** | One user + one bot |
| **Shared bot chat** | Several users + one bot |
| **Group** | Any mix of several bots and several users, e.g. "Q4 Launch" with Sales bot, Marketing bot, Anna and Petros |

### 7.2 Conversation features
- Each conversation has a name, emoji and colour (by default borrowed from the bot in direct chats).
- Users can add or remove people and bots at any time (based on their role). Only members of the same organisation can be added; there are no outside guests.
- In groups, users talk to a specific bot with **@mention** (e.g. "@Marketing draft the launch email"). Without a mention, the most relevant bot answers, or a chosen "lead" bot coordinates.
- Messages support text, voice notes, images, files, links and pasted screenshots.
- Users can also switch to **voice mode** to talk with the bot out loud in real time instead of typing (§7.6).
- Bots reply with text, tables, charts, documents, images, download links and interactive screens (§7.4).
- Threads/replies, reactions, pin messages, search within a conversation.
- Users can edit or re-run a request, stop a bot mid-task and branch ("try a different approach").
- Conversations can be organised with folders, favourites, archive and unread markers.
- **Temporary chats** are not saved and don't create memories (can be disabled by the organisation).
- Global search across all conversations, files and tasks the user can access.

### 7.3 Live activity
While a bot works, the chat shows a clear, friendly activity feed:
- "Searching your Gmail (sales@)…", "Opening hubspot.com…", "Writing report.docx…"
- Each step can be expanded to see details.
- A **"Watch"** button opens the bot's cloud computer screen live.

**How it's built (for the development team):** the bot run executes in a queue worker and publishes each step to the conversation's Redis Stream; the API instance holding the user's connection forwards it, and a reconnecting client resumes from the last step it received (§14.4).

### 7.4 Interactive replies
Bots don't only reply with text. When it helps, a bot builds a small interactive screen right inside the chat: a form, a chart, a dashboard, a comparison table, a calculator or a mini-app. These appear as the bot writes, piece by piece, just like text.

**Two kinds of interactive replies** — the bot automatically chooses the right one:

| | Ready-made building blocks | Custom mini-apps |
|---|---|---|
| What it is | The bot assembles the reply from a library of standard, polished components (cards, tables, charts, forms, buttons, tabs, lists, progress bars, image galleries, maps, calendars) | The bot creates a one-off interactive screen from scratch for needs the building blocks can't cover (e.g. a pricing calculator, a planning board, a quiz, a custom dashboard) |
| Used for | Most everyday replies | Unusual or highly specific requests |
| Look and feel | Always matches the app's design, colours and light/dark mode | Uses the same design components and theme, so it still looks native |
| Safety | Fully safe by design — only approved components can be shown | Runs inside a sealed, isolated box: it can't see the rest of the app, the user's accounts or other data, and can't open other pages without permission |
| Speed | Instant | Takes a few extra seconds to build |

A bot can mix both in a single reply (e.g. a building-block summary card plus a custom mini-app below it).

**Examples**
- "Show me this month's sales" → a chart with filters and a table.
- "Book a meeting with Anna" → a card with suggested time slots to click.
- "Help me plan the launch" → an editable checklist with owners and dates.
- "Collect the team's lunch orders" → a form in the group chat that each member fills in, with live totals.
- Approval requests (§11) appear as interactive cards with Approve / Edit / Reject.
- "Here's my Mailchimp API key" → a secure secret box to paste it into, so the key never goes into the chat (§8.8).

**Using interactive replies**
- Users can click, type, select and submit inside them. Their actions go back to the bot, which continues the work (e.g. submitting a form makes the bot send the emails).
- In group conversations, everyone sees the same interactive reply and their input is combined (e.g. votes, form responses).
- Any interactive reply can be opened full screen or in the side panel.
- Users can **pin** an interactive reply to the conversation or **save it as a widget** to reuse later, with fresh data each time it's opened.
- Users can ask the bot to change it ("add a column for region", "make it a bar chart").
- Users can always switch to a plain text version, and screen readers are supported.
- If an interactive reply can't be shown (e.g. an error or an old app version), the bot's reply falls back to plain text automatically.
- Works the same on web, desktop and mobile; layouts adapt to screen size.

**How it's built (for the development team):** the app streams interactive replies using the Vercel AI SDK. Ready-made building blocks are described by the bot as structured data and drawn with json-render using the shadcn/ui component set. Custom mini-apps are run with a live React runner (react-runner) inside a sandboxed frame, with shadcn/ui and the app's theme already loaded.

### 7.5 Artifacts (shareable apps and pages)
Artifacts are complete, standalone creations a bot builds for the user — full apps, websites, dashboards, reports, slide decks, documents, diagrams, forms, tools and games — each with its own design and its own web address (link). Unlike interactive replies, which live inside a chat message, an artifact is a finished product that can be opened, shared and used on its own, outside Agent Space.

**What users can create**
| Type | Examples |
|---|---|
| Web apps and tools | Pricing calculator, project tracker, booking form, quiz, internal tool |
| Dashboards | Sales dashboard with live numbers from the CRM |
| Pages and websites | Landing page, event page, product one-pager |
| Documents and reports | Market research report, proposal, meeting summary |
| Presentations | Slide deck for a pitch or a team update |
| Diagrams and visuals | Process flow, org chart, timeline |

**Creating and editing**
- Users ask any bot ("Build a landing page for our Q4 webinar with a sign-up form"). The bot builds the artifact and shows it in the side panel with a live preview as it's being made.
- Artifacts are fully designed: layout, colours, fonts, images and icons, working in light and dark mode and on phones, tablets and desktops. By default they use the organisation's brand colour and logo.
- Users change an artifact by asking ("make the header blue", "add a pricing section").
- Any member with access can **duplicate** an artifact to make their own copy and change it freely.
- An artifact can be created from an interactive reply ("turn this chart into a shareable dashboard").

**What artifacts can do**
- **Save information:** artifacts can store what visitors enter (form responses, votes, tracker items, sign-ups). This information is shared by everyone using the artifact and is visible to the artifact's owner and editors, who can also ask a bot to review or summarise it.
- **Show live data:** for organisation members, an artifact can show live information from connected accounts (e.g. this week's deals). Each viewer sees only what their own access allows, and is asked for permission the first time. Public artifacts never use anyone's connected accounts live; they only show information saved into the artifact.
- **Use AI:** artifacts can include AI features (e.g. a "summarise" button or a chat box). For organisation members, this counts toward their own usage. For public visitors, it counts toward the artifact owner's usage and can be switched off.
- **Accept file uploads** from visitors (e.g. CV uploads on a job form), stored with the artifact (§7.7).
- **Download and export:** as PDF, image or a self-contained web page; slide decks as presentation files; documents as Word files.

**Sharing and permissions**
Each artifact has a sharing level, set by its owner:

| Sharing level | Who can open it |
|---|---|
| **Private** (default) | Only the creator |
| **Specific members** | Chosen members of the organisation |
| **Organisation** | All members of the organisation |
| **Public link** | Anyone with the link, no sign-in needed |

Within the organisation, each person or the whole organisation is given a role on the artifact:

| Role | Can do |
|---|---|
| **Owner** | Everything, including sharing, deleting and transferring ownership. One per artifact. |
| **Editor** | View, use, comment, edit (by asking a bot), publish new versions, restore old versions |
| **Commenter** | View, use and comment |
| **Viewer** | View and use |

- Public visitors can only view and use the artifact (e.g. fill in its form); they can never edit it or see version history or stored responses.
- Public links can have an optional **password** and an optional **expiry date**, and can be switched off at any time. Switching off immediately stops the link working.
- Public artifacts are hidden from search engines unless the owner turns on "Allow search engines".
- Public artifacts can be **embedded** in other websites (e.g. a booking form on the company website).
- Each artifact gets a readable link (e.g. `.../a/q4-webinar`) that the owner can customise; the link stays the same across all versions.

**Versions**
- Every published change creates a new **version**, recording who made it, when, and a short summary of what changed (written by the bot).
- The link always shows the latest published version.
- **Version history** lets editors preview any earlier version, compare two versions side by side, give a version a name (e.g. "Sent to client") and **restore** an earlier version. Restoring creates a new version, so nothing is ever lost.
- By default, changes go live as soon as they're published. Owners can turn on **"Review before publishing"**, so edits are saved as a draft and only go live when an editor clicks Publish.
- If two people change an artifact at the same time, each change is saved as its own version, so nothing is lost.
- Stored information (form responses, etc.) is kept across versions.

**Comments and activity**
- Owners, Editors and Commenters can leave comments on any part of an artifact and reply in threads, and can @mention people or a bot (e.g. "@Marketing make this section shorter"), which makes the bot edit the artifact.
- Owners and Editors see how many times the artifact was viewed and used.

**Finding artifacts**
- An **Artifacts** page lists all artifacts the user can access, with tabs for *Mine*, *Shared with me* and *Organisation*, plus search, filters by type and pinning.
- Artifacts also appear in the conversation where they were created.

**Ownership and safety**
- If an artifact's owner leaves the organisation, ownership passes to an organisation Owner; public links keep working.
- Owners and Admins can see every artifact shared with the organisation or publicly, and can switch off any public link.
- Each artifact runs in its own isolated space on a separate web address. It can't access the Agent Space app, the viewer's account or other artifacts.
- Public artifacts can be reported for abuse; reported artifacts are reviewed and can be taken down.
- Deleting an artifact stops its link working straight away. By default its versions and stored information are kept, and the owner can restore it at any time. If the owner turns on **Permanently delete my deleted artifacts after 30 days** (personal setting, §13.2, **Off** by default), they are removed for good 30 days after deletion and can be restored until then.

**How it's built (for the development team):** artifacts are React apps using shadcn/ui and the organisation's theme, built and versioned by the platform and served from a separate, isolated domain, each at its own permanent URL.

### 7.6 Voice mode (talking to a bot in real time)
Voice mode is another way to chat with a bot: the user **speaks instead of typing**, and the bot **answers out loud** in real time, as in a natural back-and-forth conversation. It happens inside the normal conversation. It is not a phone or internet call, and it doesn't involve other people. The bot replies within a moment and can be interrupted mid-sentence.

Voice mode is not a separate, simpler assistant. It is the **same bot in the same conversation**, with the same instructions, memory, connections, skills, approval rules and abilities as when typing. While talking, the bot can search the user's email, update the CRM, book meetings, ask other bots, run skills, use its cloud computer and create artifacts, exactly as it does in text chat. Users can switch between speaking and typing at any moment.

**Turning voice mode on and off**
- A **voice mode button** (waveform icon) sits next to the message box in every conversation the user can post in. It is separate from the microphone button used for one-off voice notes (§7.2).
- The first time, the app asks for microphone permission. If permission is refused, the app explains how to enable it and the user keeps chatting by text.
- While voice mode is on, the conversation stays on screen. The message box is replaced by a voice bar showing the bot's emoji and colour with an animated waveform that reacts to who is speaking, and the controls **Mute mic**, **Stop bot**, **Keyboard** (type a message without leaving voice mode) and **Exit voice mode**. On mobile, users can also expand to a full-screen voice view.
- Voice mode turns off when the user taps Exit, says "that's all"/"exit voice mode", after **2 minutes of silence**, or when the organisation's maximum session length is reached (the bot warns 1 minute before).

**Talking naturally**
- **Hands-free by default:** the bot detects when the user has finished speaking and replies. Users can switch to **push-to-talk** (hold the button to speak) in the voice bar or in personal settings.
- **Interrupting:** if the user starts speaking while the bot is talking, the bot stops immediately and listens. Saying "stop" or tapping **Stop bot** also cancels whatever the bot is doing at that moment, including a tool action that hasn't finished yet.
- The bot speaks in the user's language (English or Greek) and can switch if the user does.
- The bot keeps spoken answers short and conversational. Long content (tables, lists, drafts, links) is shown in the chat instead of read out, and the bot says so ("I've put the full list in the chat").

**Using tools in voice mode: same as typing**
- The bot has exactly the tools it has in text chat: connected accounts (§8), custom tool servers, built-in tools, skills (§6.7), talking to other bots (§6.5), the cloud computer (§9) and artifacts (§7.5).
- While a tool runs, the bot says a short line ("Checking your calendar…") and the **live activity feed** (§7.3) appears in the chat as usual. A soft working sound plays if a step takes more than about 2 seconds, so the user knows the bot hasn't frozen.
- **Interactive replies** (§7.4) and artifacts appear in the chat as they are built, and the user can tap them while still talking.
- **Skills** can be triggered by voice ("Run the client onboarding skill for Acme") or automatically, just as in chat. The bot asks the skill's "Questions to ask first" out loud.
- **Secrets are never spoken:** if a key or token is needed, the secure secret box (§8.8) appears on screen and the bot asks the user to paste it there. If the user starts reading a secret out loud, the bot stops them and points to the box.
- **Changing things by asking** (§6.6) works by voice. The change summary is shown in the chat and read out briefly; the user confirms by saying "yes"/"confirm" or by tapping. Anything that can't be changed by chat (§13.5) can't be changed by voice either.
- **Long jobs:** if a request will take more than about 30 seconds (deep research, a long cloud-computer job, building a large artifact), the bot says it's starting it as a task ("I'll research that and let you know") and keeps talking with the user. The task runs exactly like a task started by text (§10). If it finishes while voice mode is on, the bot tells the user; otherwise the user is notified as usual.

**Approvals by voice**
- Approval rules (§11) apply unchanged. When an action needs approval, the approval card with the full preview appears in the chat and the bot reads a short summary ("I'll email Anna at Acme saying the contract is ready. Shall I send it?").
- The user can approve by saying "yes"/"send it"/"go ahead", reject by saying "no"/"cancel", ask for changes by voice ("make it shorter"), or tap Approve / Edit / Reject.
- **Payments/purchases and entering passwords on websites always need a tap** on the approval card, never voice alone, because speech can be overheard or misheard.
- If the user's screen is off (e.g. phone in pocket) and an action needs a tap, the bot says so and the approval waits in the chat and notifications as usual.

**Showing the bot what you see (camera and screen sharing)**
- In voice mode the voice bar has two more buttons, **Camera** and **Share screen**, so the user can show the bot what they're looking at while talking ("what's wrong with this wiring?", "walk me through this spreadsheet").
- **Camera:** web, desktop app and mobile app. On mobile the user can switch between the front and back camera.
- **Share screen:** web (desktop browsers) and the desktop app. The user picks a whole screen or one window. Not available on mobile.
- Only one can be on at a time; turning one on turns the other off.
- **The user always turns them on.** The bot can suggest it ("Can you show me the error? Tap Share screen"), but it can never start the camera or screen sharing itself.
- While sharing, the voice bar shows a small live preview with a red "Live" dot. Sharing stops when the user taps the button again, when voice mode turns off for any reason, or (camera only) when the mobile app goes to the background; the voice conversation carries on.
- **What the bot sees:** still pictures, not continuous video. The app sends the bot one picture each time the user starts speaking (so it arrives together with what they say), and one when the user taps **Show this** on the preview.
- **Snapshot:** a **Snapshot** button on the preview posts the current picture into the chat as an image, so it's kept like any other attachment (§7.7).
- **Nothing else is kept:** like audio, the pictures the bot sees are not stored. Spoken messages that came with a picture show a small camera or screen icon.
- **Secrets on screen:** the bot never reads out or repeats passwords, keys or card numbers it sees. If it needs one, it asks the user to use the secure secret box (§8.8).
- A picture never counts as approving anything; approvals work as described above.
- Pictures count toward voice usage (§11) in the same "Voice" line. Organisations can turn camera and screen sharing off (§13.4).

**How it appears in the conversation**
- What the user says and what the bot says are saved as **normal chat messages**, written out as text, with a small 🎙 icon showing they were spoken. Tool steps, interactive replies, artifacts and approvals appear in place, exactly as in a typed chat.
- Text and voice mix freely in one conversation: the bot always has the full history, whether it was typed or spoken.
- Memory works the same as in chat, subject to the user's memory settings.
- **Audio is not stored**, only the text. Temporary chats (§7.2) stay temporary: nothing is kept and no memories are created.
- Spoken messages follow the organisation's data retention settings like any other message.

**Shared bot chats and groups**
- Voice mode is between one user and one bot. In a group, the user picks which bot to talk to (the lead bot is pre-selected).
- Other members of the conversation simply see the spoken messages appear as text in real time, as if the user were typing. They can keep typing as normal.
- A user can have voice mode on in one conversation at a time. Several users can each use voice mode with the same bot at the same time.
- The bot can still consult other bots (§6.5) as normal.

**Where it works**
- Web (Chrome, Edge, Safari, Firefox), desktop app and mobile apps.
- On mobile, voice mode keeps working with the screen locked or while using other apps, shown by a standard "in use" notification, and it works with headphones, Bluetooth and car audio.
- On desktop, the quick-ask shortcut can open straight into voice mode with the default bot.
- If the connection drops, the app reconnects automatically for up to 15 seconds and the bot carries on. After that, voice mode turns off and everything said so far stays in the chat.

**Voices**
- Each bot has its own **voice**, chosen from the available voices with a short preview ("Hear sample"). Templates come with a suitable voice; new bots get the default voice.
- In personal settings, users can choose one voice for all bots instead, and set the speaking speed.

**Who can use it and cost**
- Voice mode is available to all roles. Organisations can turn it off or limit it (§13.4).
- Voice mode counts toward usage like any other bot activity and shows in the usage overview as a separate "Voice" line per member and bot, in minutes and cost. Usage limits (§11) apply; when a limit is reached, the bot says so and voice mode turns off.
- Voice mode always uses the voice model described below, whatever AI model the bot uses for text. Long jobs handed off as tasks run on the bot's own chosen model (§6.4).

**How it's built (for the development team):**
- Voice uses the **OpenAI Realtime API** directly (speech-to-speech model `gpt-realtime` at launch), not OpenRouter, because OpenRouter does not provide real-time audio. The platform configures the voice model; it is not chosen per bot.
- **Audio path:** the client connects to OpenAI over **WebRTC** using a short-lived session key that our API creates for each voice session (the real OpenAI key never reaches the client). The browser or app handles microphone capture, echo cancellation and playback.
- **Control path:** our API attaches to the same Realtime session with a server-side ("sideband") WebSocket connection. It sets the session's instructions, voice and tools, receives every tool call and executes it through the **same tool layer used by text chat** (Composio connections, custom tool servers, built-in tools, skills, bot-to-bot, cloud computer, artifacts), with the same permission checks, approval engine and activity logging. Tool definitions and results never go through the client.
- **Instructions:** built the same way as for text chat (organisation instructions, bot instructions, user preferences, memory, assigned skills, recent conversation history), plus voice-specific rules: keep replies short and spoken, don't read out URLs, tables or code, put long content in the chat, and confirm before acting.
- **Same tool selection as chat:** the voice session gets the same tool set the bot would get for the same message in text chat, using the same mechanism for narrowing large tool lists.
- **Messages:** the Realtime API's input transcription turns user speech into text, and bot speech is saved from the model's output transcript. Both are saved as normal conversation messages with `source: voice` and streamed to other participants through the existing real-time message channel. Tool calls, interactive replies and approvals use the same message parts as text chat. A message typed while voice mode is on is sent into the Realtime session as a text input.
- **Approvals:** when a tool needs approval, the server holds the tool call open, creates the normal approval card and tells the model to ask the user. The model calls a dedicated `resolve_approval` tool to record a spoken yes or no. This is accepted only for approvals that allow voice (not payments or passwords). A tapped approval resolves the same pending call.
- **Long tasks:** a built-in `start_task` tool hands the request to the normal task runner (an `agent-runs` job, §14.4) with the bot's chosen model. When a task finishes during a voice session, the server sends it into the session as a system event so the bot can announce it.
- Turn detection uses the Realtime API's semantic voice activity detection. Push-to-talk turns off automatic turn detection and commits the audio when the button is released.
- Session limits (silence timeout, maximum length, reconnect window) and usage metering (audio minutes and tokens per session) are enforced server-side.
- **Camera and screen sharing:**
  - Captured on the client through `platform.media`: `getUserMedia` for the camera, `getDisplayMedia` for screen sharing on web, and Electron `desktopCapturer` through the preload bridge on desktop.
  - The client grabs a still frame, scales it to at most 1024 px on the longest side and encodes it as JPEG (quality 0.7). It sends the frame into the Realtime session as an `input_image` conversation item over the WebRTC data channel when the user starts speaking (`input_audio_buffer.speech_started`, or the push-to-talk press) and when the user taps **Show this** (followed by `response.create`). In the desktop app the shared screen comes from the device bridge's picker and stills (`screenSources` / `captureSource`) instead of `getDisplayMedia`. Frames never pass through our API and are not stored.
  - **Snapshot** uploads the current frame as a normal chat attachment (§7.7) on the user's spoken message.
  - The voice-session endpoint returns `visualInputAllowed` from the organisation setting; the client hides both buttons when it is false. As a second check, the sideband connection deletes any image item (`conversation.item.delete`) in a session where it isn't allowed.
  - Image tokens reported by the Realtime API are metered with the session's audio usage.
  - The voice instructions add: don't read out or repeat secrets visible in pictures, and never treat a picture as approval.


### 7.7 Files and storage
Every file in Agent Space is kept in **Google Cloud Storage**: files users upload, files bots create, knowledge, skill files, artifacts, replays and exports.

**What's stored**
| Files | Examples | Who can open them |
|---|---|---|
| Chat attachments | Images, documents, screenshots and voice notes sent in conversations | Members of that conversation |
| Files bots create | Reports, spreadsheets, presentations, PDFs, generated images | Members of the conversation they were created in |
| Bot knowledge | Files given to a bot as knowledge (§6.2) | Whoever can use or edit that bot |
| Organisation knowledge library | Company documents all permitted bots can use | Organisation members, as the library's settings allow |
| Skill files | Templates, examples and guides attached to a skill (§6.7) | Whoever the skill is shared with |
| Artifacts | Published artifact versions, and files visitors upload to an artifact (§7.5) | As the artifact's sharing settings allow; visitors' uploads only by the artifact's Owner and Editors |
| Cloud computer replays | Recordings of what a bot did (§9.2) | Whoever can see that bot's cloud computer |
| Files taken off the cloud computer | Files a user downloads or a bot shares into the chat from its computer | Members of that conversation |
| Data exports | "Export my data" (§13.2) and activity history exports (§13.4) | Only the person who requested them |
| Profile pictures, bot images, organisation logos | Avatars and branding | Anyone who can see them in the app |

**Rules for users**
- Files are never public unless they're part of an artifact with a public link (§7.5).
- Each file can be opened only by people who can see where it lives (the conversation, bot, skill or artifact). Removing someone from a conversation also removes their access to its files.
- Download links work only for the signed-in user and expire after a short time. A copied link doesn't give anyone else access.
- **Maximum file size:** 100 MB per file by default; organisations can lower it (§13.4). Files uploaded to public artifacts are limited to 25 MB.
- Deleting a message, conversation, knowledge file, skill or artifact deletes its files. They can be restored for 30 days and are then permanently removed.
- Files follow the organisation's data retention settings (§13.4). Exports are kept for 7 days.
- Files on a bot's cloud computer stay on that computer while the bot works (§9). They're copied to storage only when downloaded or shared into a chat.
- Storage used is shown per member and per bot in the usage overview.

**How it's built (for the development team):**
- **Buckets:** one set of Google Cloud Storage buckets per environment (staging, production), all in an EU region:
  - `agentspace-<env>-files`: chat attachments, bot-created files, knowledge, skill files, files taken off the cloud computer
  - `agentspace-<env>-artifacts`: published artifact versions and visitor uploads
  - `agentspace-<env>-replays`: cloud computer replays
  - `agentspace-<env>-exports`: data exports, with a lifecycle rule that deletes objects after 7 days
  - `agentspace-<env>-public`: avatars, bot images and logos, served through Cloud CDN
- Bucket names and the service-account credentials go in each environment's `.env` file, like the other platform keys. Local development uses the staging buckets.
- **Access:**
  - All buckets except `-public` use uniform bucket-level access with public access prevention enforced.
  - Objects are encrypted at rest with Google-managed keys.
  - Only the API's service account can read and write. Clients never get bucket permissions.
- **Object paths:** `orgs/<orgId>/<area>/<fileId>`, where `area` is one of `chat`, `generated`, `knowledge`, `skills`, `computer` (and `artifacts/<artifactId>/<versionId>/…` in the artifacts bucket). IDs are random. The original file name, type, size, owner, the record it belongs to (conversation, bot, skill, artifact) and deletion state live in the database, never in the path.
- **Uploads:**
  - The client asks the API for an upload. The API checks permission, size and type, creates the file record, and returns a **V4 signed resumable upload URL** valid for 15 minutes.
  - The client uploads directly to Cloud Storage. The API then confirms the object exists and matches the declared size and type before marking the file ready.
  - Executable file types are blocked in public artifact uploads.
- **Downloads and previews:** the API checks the user's access to the parent record on every request and returns a **V4 signed URL valid for 5 minutes** (with `Content-Disposition` set for downloads). Signed URLs are never stored in messages; messages store only the file ID.
- **Bots and tools:** bots refer to files by ID. The tool layer reads and writes them through the API's storage service, with the same permission checks as users. When a bot works on a file on its cloud computer, the file is copied in, and results are copied back out to storage when shared.
- **Artifacts:** published versions are stored as immutable objects per version. The isolated artifact domain (§7.5) serves them through a server that checks the artifact's sharing settings, never from a public bucket.
- **Deletion and retention:**
  - Deleting a record soft-deletes its files.
  - A daily job (`storage.purge-deleted` and `storage.apply-retention`, §14.4) permanently deletes objects 30 days after soft deletion (for a deleted artifact, only when its owner has turned on the 30-day setting, §7.5), and deletes objects past the organisation's retention period (conversations, cloud computer files and replays).
  - Deleting an organisation deletes its whole `orgs/<orgId>/` prefix in every bucket after the 30-day window, through a delayed job in the `storage` queue.
- **Limits and usage:** the per-file size limit is checked when the upload URL is created and again on confirmation. A nightly job (`storage.aggregate-usage`, §14.4) adds up storage per member, bot and organisation from the database for the usage overview.

---

## 8. Connections (Linking Your Tools)

### 8.1 Connecting accounts
- A **Connections** page lists hundreds of supported services (Gmail, Google Calendar, Drive, Outlook, Slack, Notion, HubSpot, Salesforce, Jira, GitHub, LinkedIn, Shopify, Stripe and more), with search and categories.
- Connecting takes a few clicks and uses the service's normal sign-in screen.
- All third-party connections are handled through our trusted connection partner (Composio). We don't build our own Google/Microsoft sign-in connections.

### 8.2 Several accounts per service
- Users can connect the same service more than once (e.g. three Gmail accounts).
- Each connection gets a friendly label ("Gmail – Sales", "Gmail – Personal") and shows the account email.
- When a bot could use more than one account, it uses the bot's default, or asks the user which one.

### 8.3 Private vs shared
| | Private connection | Shared connection |
|---|---|---|
| Who adds it | Any member | Owners and Admins |
| Who can use it | Only the person who connected it (through their bots) | All organisation members' bots |
| Example | Your own inbox | The company's support inbox, team Slack, company CRM |

- Shared connections can be limited to specific bots.
- Connections show a status: Active, Needs re-connecting, Error. Users get notified when one needs attention.

### 8.4 Custom tool servers
- Users can add their own additional tool sources (for example an internal company system or a specialist service) by entering its address and signing in to it.
- Sign-in uses the tool server's own sign-in screen when it supports one (standard MCP sign-in). Otherwise the user pastes an access key or token. Either way, it is stored as described in §8.7.
- Several can be added; each can be private or shared (shared requires Owner/Admin).
- Once added, its tools appear alongside all other tools and can be given to bots in the same way.

### 8.5 Services added by access key
- For services our connection partner doesn't support, users can add a connection by pasting an **access key** (API key) with a label, e.g. "Mailchimp – Marketing".
- Keys can be added on the Connections page or **in any chat** using the secure secret box (§8.8).
- These connections work like any other: private or shared, limited to chosen bots, shown with a status.
- Once saved, the key is never shown again in full, only masked (e.g. `sk-…a9f2`). Users can replace it or delete it on the Secrets page (§8.9), but not reveal it.

### 8.6 Built-in tools
Agent Space includes its own tools that work seamlessly next to connected ones:
- Web search and reading web pages
- Creating documents, spreadsheets, presentations and PDFs
- Creating, editing and publishing artifacts (§7.5)
- Creating, editing, deleting and assigning skills (§6.7)
- Image understanding and generation
- Reminders, scheduled tasks and automations
- Memory (remember / recall / forget)
- Managing the app itself (bots, conversations, members, settings — see §6.6)
- Talking to other bots
- Using the cloud computer (browser, files, running scripts)

Users don't need to know which tools are built-in and which are connected — bots simply pick the right one.

### 8.7 How sign-ins and keys are kept safe
**The rule: bots never see secrets.** Passwords, sign-in tokens and access keys are never shown to the AI model, written into conversations, memory, skills, artifacts, tool results or logs, or placed on the cloud computer. The platform uses a secret on the bot's behalf at the moment a tool runs, and the bot only gets the result (e.g. the list of emails, not the Gmail token).

| What | Where it's kept | Who holds the actual secret |
|---|---|---|
| Accounts connected through our connection partner (Gmail, HubSpot, Slack…) | Our connection partner (Composio), encrypted | Composio. Agent Space keeps only a reference to the connection, never the tokens. |
| Custom tool server sign-ins (§8.4) | Google Cloud Secret Manager | Agent Space, encrypted |
| Access keys pasted by users (§8.5) | Google Cloud Secret Manager | Agent Space, encrypted |
| Website passwords used on the cloud computer | **Not stored at all** (see §9.4) | Nobody. Only the signed-in session is kept. |
| Agent Space's own keys (AI providers, Composio, Daytona, email, sign-in providers) | Each environment's `.env` file on the server | Agent Space |

**What users see and control**
- Secrets are never shown again after being entered: access keys appear masked, sign-ins appear as "Signed in as …".
- Users can see, rename, replace or delete all the keys and tokens they've added on the **Secrets** page (§8.9), and re-connect or remove sign-ins on the Connections page. Deleting a secret or connection deletes the stored value immediately.
- Sign-ins refresh automatically in the background. When one can't be refreshed (e.g. the password was changed or access was revoked), the connection shows **Needs re-connecting** and the user is notified (§8.3).
- When a member leaves an organisation, all their private connections and keys in that organisation are deleted. Shared connections stay with the organisation.
- Every use of a secret is recorded in the activity history (§11): which connection, which bot, on whose behalf, which action and when. The secret itself never appears.
- Data exports (§13.2) and skill exports (§6.7) never include secrets.

**How it's built (for the development team):**
- **Composio connections:** the database stores only the Composio connected-account ID, its label, owner and status. Tool calls go through Composio's tool execution, so tokens never pass through our services. Connection status is synced from Composio (an `EXPIRED` connection becomes "Needs re-connecting").
- **Google Cloud Secret Manager** stores every secret users give Agent Space:
  - **User secrets** (custom tool server tokens, access keys) live in a dedicated GCP project used only for user secrets. Each credential is **one secret** named `cred-<credentialId>`, using a random ID only, never names or emails. It is labelled with `org_id`, `owner_type` (`user`/`org`) and `kind` (`mcp_oauth`, `mcp_token`, `api_key`). The payload is JSON: `{access_token, refresh_token, expires_at, token_type, scope}` for sign-ins, or `{api_key}` for keys. Secrets use customer-managed encryption (CMEK) with a Cloud KMS key in the same project.
- **Platform keys** (OpenAI, OpenRouter, Composio, Daytona, Resend, OAuth client secrets) stay in each environment's `.env` file, as today (see AGENTS.md); they are not moved to Secret Manager. They are loaded into the API at start-up and never sent to clients, the model, the cloud computer or logs.
- **The database holds only credential metadata:** ID, label, owner (user or organisation), organisation, kind, status, masked hint (last 4 characters for keys), expiry time, and the Secret Manager resource name and current version. It never holds secret values.
- **Least-privilege access:**
  - Only the **tool-execution service's** service account has `secretmanager.secretAccessor` on user secrets.
  - The main API's service account can create secrets and add versions but **cannot read them**, so a request handler can save a key but never read one back.
  - Access is granted with IAM conditions on the `cred-` name prefix.
- **Using a secret:** the tool-execution service loads the credential record, checks that the requesting user and bot may use it (same checks as §8.3), reads the secret, makes the call and returns only the result. Decrypted values are cached only in that service's memory, for at most 5 minutes or until the token expires, whichever is sooner. They are never cached in Redis or the database, and never sent to the client, the model or the cloud computer.
- **Refreshing sign-ins:** the tool-execution service refreshes a token when it expires within 2 minutes, holding a per-credential lock so only one refresh runs at a time. It saves the new token as a new secret version and destroys the old version. If the refresh fails as unauthorised, the credential is marked "Needs re-connecting".
- **Custom tool server sign-in** follows the MCP authorization spec (OAuth 2.1 with PKCE and dynamic client registration where the server supports it). Static tokens fall back to the access-key flow.
- **Saving a pasted key:** the key goes straight from the client to the API over HTTPS. The API writes it to Secret Manager and stores only the masked hint. Request logging excludes these endpoints' bodies.
- **Redaction:** before any tool result reaches the model, logs or traces, it is scanned for the values of the secrets used in that call, and any matches are replaced with `[secret]`. Error messages from tool servers get the same treatment.
- **Deletion:** deleting a credential deletes its Secret Manager secret immediately. When a member is removed, a `connections.revoke-and-delete-credentials` job (§14.4) deletes their private credentials (and revokes them at the provider when the provider supports revocation), retrying until it succeeds.
- **Refreshing:** custom tool server sign-ins are refreshed by a delayed `connections.refresh-token` job 5 minutes before they expire, and Composio connection status is synced every 15 minutes (§14.4). Refreshed tokens are written straight to Secret Manager as a new version; the job payload holds only the credential ID.
- **Never fall back to plain text:** if Secret Manager is unavailable, saving fails with a clear error and tool calls needing that secret fail and are retried. Nothing is written elsewhere instead.
- **Keys on the cloud computer:** scripts on the cloud computer never receive keys as environment variables or files. They call connected services through an Agent Space proxy reachable only from that computer. The proxy checks that the target service is allowed for that bot, adds the credential to the outgoing request and returns the response.


### 8.8 Giving a bot a secret in chat
Users often want to hand a bot a key in the middle of a conversation ("Here's our Mailchimp API key", "Connect to our internal tool, here's the token"). Instead of the user typing the secret into a message, the bot shows a **secure secret box** in the chat.

**When the box appears**
- **When the user asks**, e.g. "I want to give you my Stripe key", "Store my OpenWeather API key", "Update the Mailchimp key".
- **When the bot works out that it needs one**, e.g. while setting up a custom tool server that asks for a token, or when a task needs a service that has no connection yet and only works with a key. The bot explains why it needs the key and shows the box.
- **When the user pastes a secret into the message box:** before sending, the app spots text that looks like a key, token or password (known key formats such as `sk-…`, `ghp_…`, `xoxb-…`, private key blocks, and long random strings next to words like "key", "token" or "password"). It shows "This looks like a secret. Store it securely instead?" with **Store securely** (the default) and **Send anyway**. Store securely removes the secret from the message, puts it into a secure secret box and sends the rest of the message as normal.

**The secure secret box**
- It is a card in the chat showing the bot's explanation and these fields:
  - **Name**, pre-filled by the bot (e.g. "Mailchimp – Marketing")
  - **Service**, pre-filled when known
  - **Secret**: a masked input with paste support and a show/hide eye that works only on the user's own screen
  - **Which bots may use it**: this bot by default
  - **Private / Shared with the organisation**: Shared is offered only to Owners and Admins
- The buttons are **Save** and **Cancel**.
- After saving, the card changes to "🔒 Saved: Mailchimp – Marketing (`…a9f2`)". The secret is never shown again in the chat, on any device or to anyone in the conversation.
- **The bot never sees the secret.** It only learns that a secret was saved, with its name and the last 4 characters. It can then use it through tools straight away (e.g. "Done. I can now pull your Mailchimp lists").
- **Updating a secret:** "Update the Mailchimp key" shows the box in **Replace** mode for that saved secret. The old key keeps working until the new one is saved.
- **In groups**, the box is shown only to the user it's for. Other members see "🔒 Petros is adding a secret" and then "🔒 Petros saved a secret", without the value or hint.
- **In voice mode** (§7.6), the box appears on screen and secrets are pasted, never spoken.
- Everything saved through the box appears on the **Secrets** page (§8.9), where it can be renamed, replaced or deleted.
- This box is for secrets Agent Space stores. **Website passwords** are different: they use the secure sign-in box on the cloud computer and are never stored (§9.4).

**How it's built (for the development team):**
- **The tool:** a built-in tool `request_secret` with input `{purpose, suggested_label, service?, kind: "api_key" | "mcp_token" | "other", replace_credential_id?}`. The model calls it when the user asks or when a task needs a key. The tool renders a dedicated `secret-input` component, a fixed building block that is never a custom mini-app (§7.4), in the message for the requesting user only. The tool call stays open until the user saves or cancels.
- **The secret's path:** the card submits the value with a direct authenticated `POST` from the client to the API's credentials endpoint, which writes it to Secret Manager (§8.7). The value never goes through the chat stream, the message store, the agent loop or the model provider. Request-body logging is disabled for this endpoint.
- **What the model gets back:** only `{credential_id, label, service, masked_hint, status: "saved" | "cancelled"}`. Later tool calls refer to the secret by `credential_id`, and the tool-execution service resolves it at call time.
- **Detecting pasted secrets:** client-side, before sending, using a shared pattern list (the same kind of rules secret-scanning tools use: known key prefixes plus entropy checks). As a second line of defence, the API runs the same check on every incoming message. If a message sent with "Send anyway" contains a likely secret, the stored copy and the copy sent to the model show it masked (`sk-…a9f2`), and the user is told it wasn't shared with the bot. "Send anyway" exists only for false positives such as hashes or IDs.
- **No secrets anywhere else:** secret values are never put into message parts, interactive reply state, artifacts, memory, conversation search or exports.


### 8.9 Managing secrets (the Secrets page)
Every user has a **Secrets** page where they can see and manage all the secrets they've added. It's in the main menu under **Connections → Secrets**, and also under **Settings → Secrets**. The 🔒 Saved card in a chat links straight to it.

**What's listed**
- **My secrets:** every access key and tool server token the user has added, whether through the Connections page, a custom tool server or the secure secret box in chat (§8.8).
- **Organisation secrets:** shared secrets added by Owners and Admins. Members see this list (name, service, which bots may use it) but can't change it. Owners and Admins can manage it.
- Each row shows:
  - Name and service, e.g. "Mailchimp – Marketing"
  - Type: access key or tool server token
  - Masked hint: `…a9f2`
  - Private or Shared
  - Which bots may use it
  - Who added it and when
  - When it was last used, and by which bot
  - Status: **Active**, **Not working** (the service rejected it), or **Expired** (for tokens with an expiry date)
- Search, plus filters by service, bot and status.
- **The value is never shown.** There is no "reveal" button, for anyone, including Owners. To check or change a key, the user replaces it.

**What users can do**
| Action | What happens |
|---|---|
| **Rename** | Change the name and service label |
| **Replace value** | Opens the secure secret box (§8.8) in Replace mode. The old value keeps working until the new one is saved, then it's destroyed. |
| **Choose bots** | Pick which of the user's bots may use it. For shared secrets, Owners and Admins pick from all organisation bots. |
| **Share / Make private** | Owners and Admins only. Making a shared secret private warns which bots and members will lose access. |
| **Test** | For services that support it, checks the key still works and updates its status. |
| **Delete** | Shows which bots and tool servers use the secret and asks for confirmation. Deletion is immediate and permanent, and bots that used it will ask for a new one next time they need it. |
| **History** | When it was added, replaced, renamed, shared and deleted, and every time a bot used it (§8.7). Values are never shown. |

**Managing secrets by asking**
- Users can also manage secrets by asking any bot: "Which secrets have I added?", "Rename the Mailchimp key to Mailchimp – Newsletter", "Let the Support bot use the Zendesk key", "Delete my old OpenWeather key".
- The bot shows the list or the change as a card (names and hints only, never values) and asks for confirmation before changing or deleting anything, as with any change by chat (§6.6).
- "Change the value of the Stripe key" opens the secure secret box. The bot never asks for, or accepts, the value in a normal message.

**How it's built (for the development team):** the Secrets page reads only the credential records in the database (§8.7) and never calls Secret Manager to read values.
- **Rename, choose bots, share:** update the record only.
- **Replace:** adds a new Secret Manager version and destroys the previous one.
- **Delete:** deletes the Secret Manager secret and soft-deletes the record, which keeps its history.
- **Test:** runs through the tool-execution service and calls a lightweight endpoint for that service, where one is defined.
- **"Last used":** updated by the tool-execution service on each use.
- **Chat:** built-in tools `list_secrets`, `update_secret` (name, bots, sharing) and `delete_secret` expose the same actions. They return metadata only. Replacing a value always goes through `request_secret` (§8.8).

---

## 9. The Bot's Cloud Computer

Each bot can get its own secure, private computer in the cloud (provided by our partner Daytona). This lets bots do things no chat-only assistant can.

### 9.1 What bots can do on it
- Browse websites like a person: log in, click, fill forms, download, compare prices, collect information.
- Work with files: open uploaded files, convert, combine, analyse, and create new ones.
- Run small programs and scripts to process data or automate repetitive work.
- Keep a workspace of files that stays between tasks.
- Bring in files from connected services (e.g. a GitHub repository, a Google Drive folder) and send results back out, without ever holding the sign-in for those services (§9.5).

### 9.2 Watching and taking control
- **Live view:** Users can watch the bot's screen in real time, in a side panel or full screen.
- **Take over:** Users can click "Take control" to use the computer themselves — for example, to sign in to a website (§9.4), solve a "prove you're human" check, or show the bot how to do something — and then hand control back.
- **Explore manually:** Users can open a bot's computer at any time, even when the bot isn't working, to look around, browse or arrange files.
- **Files panel:** Browse, upload, download and preview the files on the computer. Downloaded files and files shared into a chat are copied to Agent Space's file storage (§7.7).
- **Replay:** Review a recording/timeline of what the bot did during a task.

### 9.3 Safety
- Each computer is isolated; one bot can't reach another user's computer.
- Computers pause automatically when idle to save cost and resume automatically when the bot or user needs them again. Files are kept while paused.
- Bots ask before entering passwords, payment details or submitting anything important (see §11).

### 9.4 Signing in to websites
Bots often need to be signed in to a website that has no connection (e.g. a supplier portal). Agent Space **never stores website passwords**; it keeps the signed-in session instead.

- **Signing in:** when a bot reaches a sign-in page, it pauses and asks the user to sign in. The user can either:
  - click **Take control** and sign in on the bot's computer themselves, or
  - use the **secure sign-in box** the bot shows in the chat. What the user types goes straight into the website's field on the cloud computer. It isn't saved anywhere, and it never appears in the chat or reaches the AI model.
- **Two-step codes** and "prove you're human" checks are handled the same way.
- **Staying signed in:** after signing in, the website keeps the bot signed in as it would for a normal browser. The session is kept on the bot's computer, including while it's paused, so the bot can use the site again in later tasks without asking.
- **Signed-in websites list:** each bot's cloud computer settings list the websites it's currently signed in to, with the date of each sign-in. Users can **Sign out** of any site (which removes that site's session from the computer) or **Sign out of all**.
- **Replays and live view:** recording pauses while the user has control or is typing in the secure sign-in box, and the replay shows "Sign-in hidden" for that part.
- The bot can see the page like a person can, but password fields are masked by the website. It never reads saved passwords from the browser, and the browser's own "save password" feature is turned off.

**How it's built (for the development team):** each bot's browser runs with a persistent profile on the computer's disk, which Daytona encrypts and keeps across pauses. Saving passwords and autofill are disabled in the browser policy. The secure sign-in box sends keystrokes over the live-view control channel directly to the focused field on the computer. They are not passed to the agent loop, saved in messages or logged. The signed-in websites list is read from the profile's cookie store, grouped by site. Sign out deletes that site's cookies and storage. Replay recording is paused whenever the user has control or the secure sign-in box is open.


### 9.5 Bringing files from connected services
Many jobs need data from a connected service on the cloud computer, e.g. a GitHub repository to scan, a folder of invoices from Google Drive, an export from Shopify, or email attachments. The bot can bring these files onto its computer, and send results back, **without the sign-in for that service ever reaching the computer or the bot**.

- **Bringing files in:** the bot asks for something from a connected service, e.g. "repository x from GitHub – Work", "the Invoices/October folder from Google Drive", or "attachments from emails labelled Receipts". Agent Space fetches it using the connection and places it in a folder on the bot's computer. The activity feed shows "Copying repository x from GitHub to the computer…".
- **Sending results out:** files created on the computer can be shared into the chat, saved to file storage (§7.7), or sent to a connected service through its tools, e.g. uploaded to Google Drive, attached to an email, posted to Slack, or committed to a GitHub branch and opened as a pull request.
- The usual rules apply: the bot can only use connections it's allowed to use (§8.3), and sending anything out follows the approval rules (§11), or the automation's pre-approved actions (§10.3).
- Each transfer is limited to **1 GB**, within the computer's storage limit (§13.4).

**How it's built (for the development team):**
- Two built-in tools: `copy_to_computer` and `copy_from_computer`.
- **`copy_to_computer({source, destination_path})`**: `source` is one of:
  1. **A stored file** (file ID in Cloud Storage, §7.7).
  2. **A Composio connection:** either a Composio tool whose result is file content or a download link (e.g. Google Drive download, Gmail attachment), or a raw API request sent through **Composio's proxy execution**, which makes the call with the stored sign-in (e.g. `GET /repos/{owner}/{repo}/tarball/{ref}` for a GitHub repository).
  3. **An access-key connection** (§8.5), fetched through the Agent Space proxy (§8.7).
  4. **A public URL.**
- **How the copy runs:** it runs entirely in our API. The API fetches the data (following any short-lived download links itself), streams it into the Daytona sandbox through the Daytona file API, and unpacks archives when asked. The computer receives only the files, never tokens or signed download links.
- **`copy_from_computer({path, destination})`**: reads the file from the sandbox through the Daytona file API. It then saves it to Cloud Storage and attaches it to the chat, or passes it to a connected service's tool. That tool call goes through the normal approval checks.
- **Limits and logging:** the size limit is enforced while streaming. Every transfer is recorded in the activity history (§11) with the connection, source, destination and size.

---

## 10. Tasks and Automations

### 10.1 Tasks
- **Long tasks:** Users can give a bot a big job ("Research the 30 top competitors and build a comparison spreadsheet") and leave. The bot keeps working and notifies them when done or when it needs input.
- **Task list:** A "Tasks" page shows everything running, waiting for approval, finished or failed, across all bots.

**How it's built (for the development team):** every task is a job in the BullMQ `agent-runs` queue, run by a worker process rather than the API request, so it keeps going when the user closes the app or an API instance restarts. A task waiting for approval or input frees its worker and is resumed by a new job. The Tasks page is updated live through the user's Redis event stream (§14.4).

### 10.2 Automations
An automation is a job a bot does again and again by itself, either on a schedule or when something happens. It can combine everything a bot can do in a chat: connected services, custom tool servers, skills, other bots, the cloud computer and artifacts.

- **Scheduled:** "Every morning at 8, summarise my unread emails and today's meetings."
- **Triggered:** "When a new deal is created in HubSpot, research the company and post a summary in the Sales group."
- **Place-based (mobile app):** "When I arrive at the office, brief me on today's meetings." (§14.3)
- **Multi-step with the cloud computer:** "Every Friday, export last week's orders from Shopify, build a sales report in a spreadsheet and email it to the team." / "Every day, scan the x repository on GitHub for vulnerabilities and post the results in Slack channel y." (See the worked example in §10.6.)

**Creating an automation**
- Users create automations by asking a bot in plain words, or from a skill ("Run /weekly-sales-report every Friday at 4pm").
- Before saving, the bot works out everything the automation needs and sorts it out with the user, so later runs never get stuck:
  - **When:** the schedule or trigger, in the user's time zone.
  - **Connections:** which accounts it will use. If one is missing, the bot asks the user to connect it. If a key is needed, it shows the secure secret box (§8.8).
  - **Cloud computer:** whether it needs one. If the bot's computer is off, the bot asks to turn it on.
  - **Actions to pre-approve:** see §10.3.
  - **What to remember between runs:** see §10.4.
  - **Where results go:** this conversation, another conversation, email, or a connected service (e.g. a Slack channel).
- The bot shows all of this as a summary card. The automation is saved only when the user confirms.

**What an automation contains**
| Part | Example |
|---|---|
| Name | "Daily vulnerability scan – x" |
| Bot | The bot that runs it, with that bot's instructions, model, skills and tools |
| When | Schedule (e.g. every day at 07:00) or trigger (e.g. new HubSpot deal) |
| Instructions | What to do on each run, in plain language (written by the bot from the user's request, and editable) |
| Skill | Optional: a skill to follow on each run |
| Connections | The accounts it uses, e.g. "GitHub – Work", "Slack – Company" |
| Pre-approved actions | e.g. "Post messages to #security in Slack – Company" |
| Memory | What it keeps between runs (§10.4) |
| Results go to | e.g. Slack #security, plus a copy in the bot's conversation |
| Runs as | The user who created it. It can only use what that user can access. |

**Managing automations**
- The **Automations** page lists every automation the user owns: its status (**Active**, **Paused**, **Needs attention**), its next and last run, and its results.
- Automations can be paused, resumed, run now, edited (in the page or by asking a bot), duplicated or deleted.
- Each automation has a **run history**. For every run it shows the status (succeeded, failed, waiting for approval), its duration, the activity steps (as in §7.3), the results, and the cloud computer replay when one was used.

### 10.3 Pre-approved actions
An automation runs while nobody is watching, so actions that would normally need approval (§11) are approved **once, when the automation is created**.
- Each pre-approval covers one kind of action **to one specific place**, e.g. "Post messages to #security in Slack – Company" or "Create issues in GitHub repository x". It doesn't cover similar actions elsewhere: posting to a different channel still needs approval.
- Pre-approvals apply only to that automation, never to the bot's chats or other automations.
- When a run tries an action that wasn't pre-approved and needs approval, the run **waits** and the user gets a normal approval card (§11). It follows the user's approval timeout setting (§13.2); if the approval is cancelled, the run ends as failed and the next run goes ahead as scheduled.
- **Organisation-enforced approvals** (§13.4, e.g. emails to people outside the company, payments) can never be pre-approved. If an automation needs one, the bot says so when creating it, and every run waits for approval at that step.
- Changing an automation's instructions, connections or results destination asks the user to confirm its pre-approvals again. Pre-approvals are listed on the automation's page, and the user can remove any of them at any time.

### 10.4 Automation memory
Automations often need to remember what happened last time, e.g. "only report new findings", "skip leads already contacted" or "compare with last week".
- Each automation has its own **memory** that it reads at the start of every run and updates at the end. It can hold notes (e.g. "last report sent on 3 Nov") and files (e.g. the previous run's results).
- The bot decides what to remember based on the instructions, and tells the user what it plans to keep when the automation is created.
- The automation's page shows its memory. The user can view it, edit notes, or **Reset memory** so the next run starts fresh.
- Automation memory is separate from the bot's memory (§6.3). It's used only by that automation and deleted with it.

### 10.5 When things go wrong
- If a run fails (e.g. a service is down), it's retried once after 10 minutes. If that also fails, the user is notified with the reason.
- After **3 failed runs in a row**, the automation is paused, marked **Needs attention**, and the user is notified.
- If a connection the automation uses needs re-connecting, or the user loses access to something it needs, the automation is paused and the user is told exactly what to fix. It resumes when they fix it and click Resume.
- A run that is still going when the next one is due is never doubled up: the next run is skipped and noted in the run history.
- Runs count toward the usage limits of the user and bot (§11), including cloud computer time. If a limit is reached, the automation is paused.

### 10.6 Worked example: daily vulnerability scan
The user asks: *"Scan the x repository on my GitHub every day for possible vulnerabilities and send the results to Slack channel y."*

**Setting it up**
1. The bot checks that the user has **GitHub** and **Slack** connected (§8) and that its cloud computer is on (§9). It asks for anything missing.
2. It asks the open questions: what time to run (default 07:00 in the user's time zone), and whether to report everything or only new findings (default: new and fixed findings, plus a total).
3. It shows the summary card:
   - Name: "Daily vulnerability scan – x"
   - When: every day at 07:00
   - Uses: GitHub – Work (read repository x), Slack – Company
   - Pre-approved: "Post messages to #y in Slack – Company"
   - Remembers: the previous run's findings, to report only what's new or fixed
   - Results: Slack #y, plus a copy in this conversation
4. The user confirms.

**Each run**
1. **Brings the code to the cloud computer** (§9.5). The platform downloads repository x through the GitHub connection and places it on the bot's computer. The GitHub sign-in never reaches the computer or the bot.
2. **Scans it** on the computer with standard open-source security tools: code pattern checks (e.g. Semgrep), leaked-key checks (e.g. Gitleaks), dependency vulnerability checks (e.g. OSV-Scanner, `npm audit`, `pip-audit`) and configuration checks (e.g. Trivy). The bot installs them the first time; they stay on the computer for later runs.
3. **Adds GitHub's own alerts** (Dependabot, code scanning, secret scanning) through the GitHub connection, if the repository has them turned on.
4. **Reviews the results:** the bot removes duplicates and obvious false positives, ranks findings by severity, and compares them with the automation's memory to mark each one as **new**, **still open** or **fixed**.
5. **Reports:** posts a short summary to Slack #y (pre-approved), with the full report attached as a file or linked as an artifact (§7.5), and saves this run's findings to the automation's memory.

The same building blocks (connections, bringing files to the cloud computer, pre-approved actions, automation memory and delivery to a connected service) work for any similar job, for example:
- "Every Monday, download last week's invoices from Google Drive, check them against our purchase orders and email me the differences."
- "Every night, export new Shopify orders, update the stock spreadsheet and alert #ops in Slack if anything runs low."
- "When a new contract lands in the Legal folder in Dropbox, check it against our standard terms and post a review in the Legal group."

**How it's built (for the development team):**
- **Data model:** automations are stored with:
  - the trigger (cron expression plus time zone, or a Composio trigger subscription)
  - bot ID, owner user ID, instructions, optional skill ID
  - connection IDs
  - pre-approvals as `{action_type, connection_id, target}`, e.g. `{send_message, slack-company, channel:#y}`
  - results destinations and status
- **Runs:** each run is a normal task (§10.1) on the bot's model, executed on behalf of the owner with the owner's permissions.
- **Approvals:** the approval engine checks a run's actions against the automation's pre-approvals before applying the usual approval rules. Organisation-enforced rules are checked first and can't be overridden.
- **Automation memory:**
  - Notes are a JSON document of at most 1 MB per automation, kept in the database.
  - Files are kept in Cloud Storage under `orgs/<orgId>/automations/<automationId>/`.
  - The model reads memory with `automation_memory_read` and writes it with `automation_memory_write`, both available only during that automation's runs.
- **Scheduling (BullMQ and Redis, §14.4):**
  - Each active scheduled automation has one BullMQ job scheduler (`automation:<automationId>`) with its cron expression and time zone. Saving or resuming upserts it; pausing or deleting removes it. Composio triggers and place-based events arrive through the `triggers` queue.
  - Every scheduled or triggered start is a `tick` job in the `automations` queue, which checks status, access and usage limits and refuses a run while another run of the same automation is active (recording it as skipped), then adds the run to `agent-runs`.
  - The retry and auto-pause rules in §10.5 are enforced by the `automations` queue: one `retry` job delayed by 10 minutes, and pausing (with the scheduler removed) after 3 failed runs in a row.
  - The organisation's "Most frequent schedule allowed" (§13.4) is checked when an automation is saved.

---

## 11. Trust, Safety and Control

- **Approvals:** By default, bots ask before actions that are hard to undo or that go outside the company — sending emails, posting publicly, deleting things, making purchases, sharing files. Users can relax or tighten this per bot ("Always ask", "Ask for important actions", "Don't ask"). Automations use actions pre-approved when they're created (§10.3).
- **Approval cards:** Approval requests appear in chat and as notifications with a clear preview (e.g. the exact email to be sent) and Approve / Edit / Reject buttons.
- **Transparency:** Every action a bot takes is logged with what, when, which account and on whose behalf.
- **Activity history:** Owners and Admins can review organisation-wide activity.
- **Privacy:** Bots only use the connections and conversations the user is allowed to access. Private connections are never visible to other members.
- **Secrets:** Bots never see passwords, sign-in tokens or access keys. Sign-ins and keys are stored encrypted and used only on the bot's behalf, and website passwords are never stored (§8.7, §9.4). In chat, secrets are entered only through the secure secret box (§8.8).
- **Data control:** Users can export or delete their conversations and memories. Organisations can set how long data is kept.
- **Usage limits:** Organisations can set spending/usage limits per member or per bot.

---

## 12. Notifications

- In-app, push (desktop and mobile) and email notifications.
- Events: new message/mention, approval needed, task finished/failed, connection needs re-connecting, invitation received, automation results, artifact shared with me, comment or edit on my artifact, skill shared with me or changed.
- Per-user settings: which events, which channels, quiet hours. Can be changed in settings or by asking a bot.

**How it's built (for the development team):** every notification is a `dispatch` job in the BullMQ `notifications` queue. It applies the user's settings, sends the in-app notification through the user's Redis event stream, and adds one `email` or `push` job per channel, delayed until quiet hours end where needed and retried on failure (§14.4).

---

## 13. Settings

There are three levels of settings: **Personal** (each user), **Bot** (each bot, by its creator, or by Owners/Admins for organisation-wide bots) and **Organisation** (Owners and Admins). Defaults are shown in **bold**.

### 13.1 How settings combine
When settings overlap, the more specific one wins, in this order:

1. **Organisation rules** marked as enforced always win (e.g. "external emails always need approval").
2. **What the user asks in the message** ("give me a long answer this time").
3. **Personal preferences** of the user talking to the bot.
4. **Bot settings.**
5. **Organisation defaults.**

If a bot setting has **"Lock style"** turned on (e.g. a Support bot that must always be formal), the bot's reply style is used instead of the user's personal preferences.

### 13.2 Personal settings (every user)

**Profile**
| Setting | Options |
|---|---|
| Name, photo, job title | Free text / image |
| About me | Short text bots use for context (role, responsibilities, how you like to work) |
| Time zone | Auto-detected, changeable |
| Working hours | Days and hours; bots avoid scheduling or sending notifications outside them |

**Appearance**
| Setting | Options |
|---|---|
| Theme | **System**, Light, Dark |
| Text size | Small, **Medium**, Large |
| Layout density | Comfortable (**default**), Compact |

**Language and region**
| Setting | Options |
|---|---|
| App language | **English**, Greek |
| Bot reply language | **Same as my message**, Always English, Always Greek |
| Date and time format | **Based on region**, 24-hour / 12-hour |
| Currency and units | **Based on region**, or chosen manually |

**How bots reply to me**
| Setting | Options |
|---|---|
| Reply length | Short, **Balanced**, Detailed |
| Tone | Casual, **Friendly-professional**, Formal |
| Formatting | **Mixed (bullets and paragraphs as needed)**, Mostly bullet points, Mostly paragraphs |
| Emoji in replies | None, **Occasionally**, Often |
| Show sources | **On** — bots show where information came from (links, emails, files) |
| Suggested follow-ups | **On** — 2–3 suggested next questions under replies |
| Clarifying questions | Ask more often, **Balanced**, Assume and proceed |
| Proactive suggestions | **On** — bots may suggest helpful next actions ("Want me to add this to your calendar?") |
| Suggest saving repeated tasks as skills | **On** |
| Activity steps in chat | **Collapsed summary**, Expanded, Hidden |
| Interactive replies | **On** — bots may reply with interactive screens (§7.4); Off shows text only |

**Artifacts**
| Setting | Options |
|---|---|
| Default sharing for new artifacts | **Private**, Organisation |
| Open artifacts in | **Side panel**, Full screen, New browser tab |
| Notify me about comments and edits on my artifacts | **On** |

**Chat behaviour**
| Setting | Options |
|---|---|
| Default bot | The bot that opens when starting a new chat or using quick-ask |
| Send with | **Enter** (Shift+Enter for new line), Ctrl/Cmd+Enter |
| In groups, bots reply | **To the most relevant bot when not @mentioned**, Only when @mentioned |
| Show typing/working indicators | **On** |

**Voice**
| Setting | Options |
|---|---|
| Read replies aloud | **Off**, On for voice messages only, Always |
| Bot voice | **Use each bot's voice**, or one chosen voice for all bots |
| Speaking speed | Slower, **Normal**, Faster |
| Send voice message automatically when I stop talking | **Off** |
| Voice mode input | **Hands-free**, Push-to-talk (§7.6) |
| Keep spoken messages as text in the chat | **On** (Off keeps only the bot's actions and results, not what was said) |

**Memory and personalisation**
| Setting | Options |
|---|---|
| Let bots remember things about me | **On** |
| Use my past conversations for context | **On** — bots may refer to my other conversations |
| Manage memories | View, edit, delete individual memories, or clear all |
| Temporary chats | Start a chat that isn't saved and doesn't create memories |

**Approvals**
| Setting | Options |
|---|---|
| Default approval level for my new bots | Always ask, **Ask for important actions**, Don't ask (cannot go below the organisation minimum) |
| If I don't respond to an approval | **Keep waiting**, Cancel after 1 hour, Cancel after 24 hours |
| Where approvals reach me | **In app + push**, also email |

**Cloud computer**
| Setting | Options |
|---|---|
| Open live view automatically when a bot starts using its computer | **Off** |
| Notify me when a bot needs me to take control | **On** |
| Keep replays of bot sessions | **On** (subject to organisation retention; sign-ins are never recorded) |

**Connections**
| Setting | Options |
|---|---|
| Default account per service | e.g. "Use Gmail – Work unless I say otherwise" |
| Connection problem alerts | **On** |
| Secrets | Opens the Secrets page (§8.9): view, rename, replace, choose bots for, or delete your keys and tokens |
| Alert me when a secret stops working | **On** |

**Tasks and automations**
| Setting | Options |
|---|---|
| Notify me when a task finishes | **On** |
| Check in with me if a task runs longer than | 15 min, **1 hour**, 4 hours, Never |
| Automation results go to | **The bot's conversation**, Email, Both |
| Daily briefing | **Off**, On at a chosen time |

**Notifications**
| Setting | Options |
|---|---|
| Events | Per event on/off: messages, mentions, approvals, task results, connection issues, invitations, automation results |
| Channels | Per event: in app, push, email |
| Quiet hours | **Off**, or a time range (approvals marked urgent still come through, if allowed) |
| Daily email digest | **Off** |
| Sounds | **On** |

**Privacy and data**
| Setting | Options |
|---|---|
| Export my data | Download my conversations, files and memories |
| Delete my conversation history | All, or older than a chosen date |
| Auto-delete my conversations after | **Never**, 30 days, 90 days, 1 year (cannot be longer than the organisation's limit) |
| Permanently delete my deleted artifacts after 30 days | **Off** (§7.5) |

**Devices** (desktop and mobile apps)
| Setting | Options |
|---|---|
| My devices | List of devices signed in to Agent Space (name, platform, app version, last seen); rename or sign out |
| Device tools | Per device and per tool: **Ask each time**, Always allow, Never (§14.3) |
| Allowed folders (desktop) | Folders bots may use on this computer (**none**) |
| Local tool servers (desktop) | Add, edit or remove tool servers that run on this computer (**none**) |
| Control my computer (desktop) | **Never**, Ask each time (§14.3) |
| Apps bots can't use (desktop) | Agent Space, password managers, system settings and security prompts, and terminal apps (**always**), plus any apps the user adds |
| Launch at start-up (desktop) | **On** |
| Quick-ask shortcut (desktop) | **Ctrl/Cmd+Shift+Space**, or a chosen shortcut |
| Places for place-based automations (mobile) | Saved places, e.g. Office, Home (up to 20) |
| Approve from the lock screen (mobile) | **On** |

**Security** (settings screen only, never by chat)
| Setting | Options |
|---|---|
| Email, password | Change |
| Active sessions and devices | View and sign out |
| Delete account | With confirmation |

### 13.3 Bot settings (per bot)

**Identity**
| Setting | Options |
|---|---|
| Name, emoji, colour, description | Free choice |
| Welcome message | Shown when someone starts a new chat with the bot |
| Conversation starters | Up to 4 example prompts shown in an empty chat |

**Behaviour**
| Setting | Options |
|---|---|
| Instructions | Role, goals, rules and tone in plain language |
| AI model | **Recommended**, or any allowed model (§6.4) |
| Creativity | Precise, **Balanced**, Creative |
| Reply style | **Use each user's preferences**, or set length, tone, formatting and emoji for this bot |
| Lock style | **Off** — when on, the bot's reply style overrides personal preferences |
| Reply language | **Same as the user's message**, or a fixed language |
| Clarifying questions | **Use each user's preference**, Ask more often, Assume and proceed |
| Response in groups | **When relevant or @mentioned**, Only when @mentioned |

**Abilities**
| Setting | Options |
|---|---|
| Connections | Which connected accounts it may use, and the default account per service |
| Custom tool servers | Which ones it may use |
| Web search | **On** |
| Image generation | **On** |
| Create documents and files | **On** |
| Interactive replies | **Building blocks and custom mini-apps**, Building blocks only, Off |
| Create artifacts | **On** |
| Cloud computer | **Off** for new bots (On for the Researcher template) |
| Signed-in websites | List of websites the bot's computer is signed in to; sign out of one or all (§9.4) |
| Knowledge | Files, documents and links it should know |
| Skills | Which skills it has (add or remove at any time) |
| Use skills automatically | **On** — the bot picks a matching skill by itself; Off means skills are only used when mentioned with `/` |
| Organisation knowledge | **On** — uses the company knowledge library |

**Voice**
| Setting | Options |
|---|---|
| Voice mode | **On** |
| Voice | Choice of available voices with a sample (**Default voice**; templates set their own) |
| Spoken reply style | **Short and conversational**, Detailed |

**Memory**
| Setting | Options |
|---|---|
| Memory | **On** |
| Memory scope | **Per user** (remembers each user separately), Shared across everyone using this bot |

**Working with other bots**
| Setting | Options |
|---|---|
| Can ask other bots for help | **On** |
| Other bots can ask this bot | **On** |
| Sensitive | **Off** (Owners/Admins only; see §6.5) |

**Approvals**
| Setting | Options |
|---|---|
| Overall level | Always ask, **Ask for important actions**, Don't ask |
| Per action type | Override for: sending messages/emails, posting publicly, editing records, deleting, purchasing/payments, sharing files, entering passwords on websites |

**Limits**
| Setting | Options |
|---|---|
| Maximum task duration | 15 min, **1 hour**, 4 hours, 24 hours |
| Monthly usage limit | **None** (organisation limits still apply), or a chosen amount |

**Sharing**
| Setting | Options |
|---|---|
| Visibility | **Private**, Organisation-wide (Owners/Admins only) |
| Who can edit | **Creator only**, Creator + Owners/Admins |
| Duplicate | Copy the bot as a starting point for a new one |

### 13.4 Organisation settings (Owners and Admins)

**General**
| Setting | Options |
|---|---|
| Name, logo, brand colour | Free choice |
| Default language, time zone, working hours | Applied to new members and bots |

**Members and invitations**
| Setting | Options |
|---|---|
| Invite links | **On** |
| Default role for new invites | **Member**, Admin |
| Auto-join by email domain | **Off**, or allow anyone with e.g. @company.com to join as Member |
| Invitation expiry | 1 day, 3 days, **7 days**, 30 days |

**Bots**
| Setting | Options |
|---|---|
| Company instructions | Text applied to every bot in the organisation (company description, tone of voice, rules such as "never promise discounts") |
| Who can create bots | **Everyone**, Owners and Admins only |
| Maximum bots per member | **No limit**, or a number |
| Available templates | Choose which templates members see |
| Organisation memory and knowledge library | Manage company facts and documents |

**AI models**
| Setting | Options |
|---|---|
| Default model | **Recommended**, or any model |
| Allowed models | **All models**, Approved list only |
| Automatic fallback to a similar model | **On** |
| Compare replies with another model | **On** |

**Connections and tools**
| Setting | Options |
|---|---|
| Shared connections | Add, label, limit to specific bots, remove |
| Services members may connect | **All**, Approved list only, All except a block list |
| Members may add private custom tool servers | **On** |
| Members may add connections by access key (§8.5) | **On** |
| Organisation secrets | Manage shared keys and tokens on the Secrets page (§8.9) |
| Built-in tools | Turn web search, image generation and document creation on/off for the whole organisation (**all On**) |
| Interactive replies | **Building blocks and custom mini-apps**, Building blocks only, Off |

**Device tools**
| Setting | Options |
|---|---|
| Device tools | **On** (§14.3) |
| Allowed device tools | **All**, or choose: local files, look at my screen, local tool servers, clipboard, open, control my computer, camera and scanner, contacts, send via phone apps, device calendar, location |
| Members may add local tool servers | **On** |
| Automations may use desktop tools | **On** (never includes control my computer) |
| Require fingerprint / face unlock for approvals on mobile | Payments and website passwords (**always**), plus optionally: all approvals, emails outside the company, deleting data |

**Cloud computers**
| Setting | Options |
|---|---|
| Cloud computers | **On** |
| Who can use them | **Everyone**, Owners and Admins only |
| Pause when idle after | 5 min, **15 min**, 30 min |
| Maximum continuous session | 1 hour, **4 hours**, 24 hours |
| File storage per bot | Size limit |
| Members may take control / explore manually | **On** |
| Record session replays | **On** |
| Blocked websites | List of websites bots may never visit |

**Approvals and safety**
| Setting | Options |
|---|---|
| Minimum approval level | **None**, or a level members can't go below |
| Always require approval for (enforced) | Choose from: emails to people outside the company (**On**), payments/purchases (**On**), public posts, deleting data, sharing files externally |
| Bots consulting other bots | **On** |
| Approval timeout | **Keep waiting**, cancel after a chosen time |

**Skills**
| Setting | Options |
|---|---|
| Who can create skills | **Everyone**, Owners and Admins only |
| Starter skills library | **On** — choose which starter skills members see |
| Import skills from files | **On** |

**Artifacts**
| Setting | Options |
|---|---|
| Artifacts | **On** |
| Public links | **Everyone can create**, Owners and Admins only, Off |
| Require a password on public links | **Off** |
| Maximum public link lifetime | **No limit**, 7 days, 30 days, 90 days |
| AI features in public artifacts | **On** (counts toward the artifact owner's usage) |
| File uploads in public artifacts | **On** |
| Allow embedding in other websites | **On** |
| Default artifact design | **Organisation brand colour and logo**, Neutral |

**Voice mode**
| Setting | Options |
|---|---|
| Voice mode | **On** (uses OpenAI's real-time voice service; see §7.6) |
| Who can use it | **Everyone**, Owners and Admins only |
| Camera and screen sharing in voice mode | **On** (§7.6) |
| Maximum voice session length | 15 min, **30 min**, 60 min |
| Approve actions by voice | **On** (payments and passwords always need a tap); Off means every approval needs a tap |
| Keep spoken messages as text | **On** |

**Automations**
| Setting | Options |
|---|---|
| Automations | **On** |
| Maximum active automations per member | **No limit**, or a number |
| Automations may use the cloud computer | **On** |
| Pre-approved actions in automations | **On** — Off means every approval-needing step in an automation waits for the user (§10.3) |
| Most frequent schedule allowed | Every 15 min, **Every hour**, Daily |

**Usage and limits**
| Setting | Options |
|---|---|
| Monthly usage limit | For the organisation, per member and per bot (**none**) |
| Alerts | **At 80% and 100%**, sent to Owners/Admins (and the member, for member limits) |
| When a limit is reached | **Pause and notify**, Switch to a cheaper model, Notify only |
| Usage overview | Usage and cost by member, bot and model |

**Data and privacy**
| Setting | Options |
|---|---|
| Keep conversations for | **Forever**, 1 year, 90 days, 30 days |
| Keep cloud computer files and replays for | 30 days, **90 days**, 1 year |
| Maximum file size | 25 MB, 50 MB, **100 MB** (public artifact uploads are always limited to 25 MB; §7.7) |
| Members may export their data | **On** |
| Temporary chats allowed | **On** |

**Security**
| Setting | Options |
|---|---|
| Sign out inactive sessions after | **30 days**, 7 days, 1 day |

**Activity history**
- View, search and filter all bot actions and admin changes; export to a file.

**Danger zone** (Owners only)
- Transfer ownership, delete organisation.

### 13.5 Changing settings by chat
- Any personal setting (except Security) and any bot setting the user is allowed to change can be changed by asking a bot (§6.6).
- Owners and Admins can also change organisation settings by chat, **except** Security and Danger zone, which require the settings screens.
- Every change requested in chat is shown as a summary and needs confirmation before it's applied.

---

## 14. Platforms and Experience

| Platform | Notes |
|---|---|
| **Web** | Full experience in any modern browser. |
| **Desktop (Windows, Mac)** | Same as web, plus: launch at start-up, system notifications, a global shortcut to open a quick-ask window (by text or in voice mode), quick-ask with selected text or a screenshot, drag-and-drop files from the computer, and desktop device tools such as local files, "look at my screen", local tool servers and control my computer (§14.2, §14.3). |
| **Mobile (Android)** | Full chat, approvals (including from the lock screen, with fingerprint / face unlock for sensitive ones), notifications, voice input, voice mode that keeps working with the screen locked (with camera sharing), camera, photo upload and document scanner, share-to-bot from other apps, Google Assistant shortcuts, widgets, live progress of long tasks, live view of the cloud computer (view and basic control), and mobile device tools such as contacts, device calendar and location (§14.2, §14.3). |

**Design principles**
- Feels like a modern messaging app: conversation list on the left, chat in the centre, optional side panel on the right (cloud computer, files, task details).
- Clean, friendly and fast; bots are recognisable by their emoji and colour.
- Works in light and dark mode; accessible (keyboard navigation, screen readers, good contrast).
- Voice: send voice notes, hear replies read aloud, or talk with a bot in real time using voice mode (§7.6).
- Languages: the app is available in English and Greek. Bots reply in the language the user writes in.

### 14.1 One app for every platform
Agent Space is **one app**: the same React code runs on the web, inside the desktop app and inside the mobile apps. The first release ships on the web only (§17), but it is built from day one so that the desktop and mobile apps can be added later without rewriting screens or changing how the app talks to the server.

**How it's built (for the development team):** these rules apply from the first release.

- **One codebase, packaged three ways.**
  - `app/` (Vite + React + React Router) is a client-only single-page app. It must build to static files that work without a web server, with no server-side rendering and no server-side URL rewrites the app depends on.
  - The same build will later be packaged for mobile and desktop. All screens, interactive replies (§7.4), artifact previews, live view and voice mode live in this one codebase.
- **The platform layer.**
  - Every feature that differs between web, desktop and mobile goes through one module, `app/src/platform/`. Each capability has a TypeScript interface and, for now, a web implementation. Desktop and mobile implementations are added later behind the same interface.
  - Capabilities from day one:

    | Capability | Web implementation now |
    |---|---|
    | `storage` (secure key-value, e.g. sign-in tokens) | httpOnly cookie for the refresh token; memory for the access token |
    | `files` (pick, upload, download, save) | File input; download links |
    | `share` (share out of the app) | Web Share API, or copy link |
    | `clipboard` | Clipboard API |
    | `notifications` (permission, register device, show) | Web Push + Notification API |
    | `media` (microphone, camera, audio session) | `getUserMedia` |
    | `voice` (voice-mode connection, §7.6) | Browser WebRTC |
    | `links` (open external links, OAuth sign-in windows, deep links) | `window.open`, redirects |
    | `appInfo` (platform, app version, device ID) | Browser |
    | `lifecycle` (foreground/background, online/offline) | Page Visibility and online/offline events |

  - Feature code asks `platform.is('web' | 'desktop' | 'android')` and `platform.supports('<capability>')`. It never assumes a feature exists. Interface elements for unsupported features are hidden, not broken.
- **Automated checks:**
  - ESLint rules (`no-restricted-imports`, `no-restricted-globals`, `no-restricted-properties`) block, outside `app/src/platform/`:
    - direct imports of `@capacitor/*` and `electron`
    - direct use of `navigator.clipboard`, `navigator.mediaDevices`, `navigator.share`, `Notification`, `window.open`, and `localStorage`/`sessionStorage` for sign-in data
  - CI fails on any violation.
  - CI also checks that the production build loads from the static files alone, with the API address coming only from configuration.
- **Talking to the API from any app.**
  - Every API call uses an absolute address from configuration. Nothing relies on the app and the API sharing an origin.
  - Sign-in uses short-lived Bearer access tokens plus refresh tokens kept through `platform.storage`. Cookies are not the only sign-in method.
  - The API's allowed-origins list (CORS) is configurable per environment, so the mobile and desktop app origins can be added later without code changes.
- **Connection redirects.** Users sign in to Agent Space with email and password only. Composio connections (§8.1) and custom tool server sign-ins (§8.4) take a **return address** parameter and finish on an app route (`/connections/callback`). This lets the mobile and desktop apps later run them in the system browser and return through a deep link.
- **Every screen has its own address.** Every conversation, bot, artifact, skill, automation, approval and setting has a stable path (e.g. `/c/<conversationId>`, `/approvals/<id>`). Notifications and emails link to these paths, and later the desktop and mobile apps will open them from deep links.
- **Devices are recorded from the start.**
  - The API keeps a `devices` table: user, platform (`web`/`desktop`/`android`), app version, push token and provider (`webpush` now; `fcm` later), supported capabilities and last seen.
  - Notifications (§12) are sent per device through a provider interface, so FCM can be added later as a new provider.
- **Version check.** The API publishes the minimum supported app version per platform. The app checks it on start-up and asks the user to update if it's too old. This applies to web too: "Reload to update".
- **Tools know where they run.** Every tool in the tool layer has a `runs_on` field. In the first release this is always `server`. The value `device` is reserved, so tools running on the user's own computer or phone can be added later without changing the tool layer.
- **Mobile-ready layout and input:**
  - Every screen works from **360 px wide** upwards and respects the screen's safe areas (`env(safe-area-inset-*)`).
  - Touch targets are at least **44 × 44 px**.
  - Nothing works only on hover; every hover action has a tap equivalent.
  - The message box and voice bar stay visible above the on-screen keyboard.
  - Long lists (conversations, messages) are virtualised.
- **Unreliable connections.** Real-time connections (chat streaming, live activity, voice mode) reconnect automatically and resume where they stopped when the app comes back to the foreground or online, through `platform.lifecycle`.
- **Testing.** End-to-end tests run at desktop (1280 px) and phone (390 px) sizes, in Chromium and WebKit (the engine behind Safari).


### 14.2 Desktop and mobile apps
- **Desktop (Windows, Mac):** the Agent Space web app inside a desktop app. It adds:
  - launch at start-up and system notifications
  - a global shortcut for quick-ask (by text or in voice mode)
  - quick-ask with the selected text or a screenshot
  - drag-and-drop of files
  - deep links that open Agent Space links in the app
  - the desktop device tools (§14.3)
- **Mobile (Android):** the Agent Space app from Google Play. It adds:
  - push notifications, including **approving from the lock screen**
  - fingerprint / face unlock for sensitive approvals
  - camera and a document scanner
  - share-to-bot from other apps
  - voice mode that keeps working with the screen locked (§7.6)
  - Google Assistant shortcuts, home-screen widgets, and live progress of long tasks in an ongoing notification
  - the mobile device tools (§14.3)
- The apps look and work the same as the web app, and everything a user does in one shows up in the others straight away.

**How it's built (for the development team):**
- **Packaging:** the same `app/` build (§14.1) is packaged with **Capacitor** for Android and with **Electron** for Windows and Mac. Expo/React Native and Tauri are not used. React Native would need a second codebase; Tauri makes local tool servers and screen capture harder.
- **Capacitor (mobile):**
  - **Bundled code:** the app's code is bundled inside the app, never loaded from the website. This avoids Google Play rejection for being a "wrapped website". Web-code-only fixes may be shipped as over-the-air updates, as Google Play's rules allow for code that doesn't change the app's purpose. Anything touching native code goes through a store release.
  - **Platform implementations:** native versions of the platform capabilities (§14.1) use Capacitor plugins:

    | Capability | Plugin |
    |---|---|
    | Push and lock-screen actions | `@capacitor/push-notifications`, `@capacitor/local-notifications` (action buttons) |
    | Camera | `@capacitor/camera` |
    | Location | `@capacitor/geolocation` |
    | Sharing | `@capacitor/share` |
    | Clipboard | `@capacitor/clipboard` |
    | Sign-in tokens | Secure storage in the Android Keystore |
    | Contacts | `@capacitor-community/contacts` |
    | Biometrics | A biometrics plugin |
    | Receiving shares | A share-receiving plugin with an Android intent filter |
    | Document scanner | An ML Kit document-scanner plugin |
    | Calendar and reminders | A calendar plugin (CalendarContract) |
    | Place-based triggers | A background-geolocation plugin |

  - **Community plugins:** each is pinned to a version and reviewed before adoption. If one is unmaintained or can't support a feature, that capability is built as our own native plugin behind the same interface.
  - **Native voice plugin:** `@agentspace/voice` (Kotlin) implements `platform.voice` on mobile. The built-in browser view doesn't keep the microphone and audio running when the app is in the background, so the plugin runs the OpenAI Realtime WebRTC connection natively instead:
    - It runs as a foreground service of type microphone + media playback.
    - The plugin passes events (speaking state, transcripts, connection state) to the web interface.
    - Server-side control of the session (§7.6) is unchanged.
  - **Native extras:** Android App Actions, home-screen widgets and ongoing progress notifications are small native targets in Kotlin. They talk to the API using the app's stored sign-in.
  - **Push provider:** FCM is added as a push provider (§14.1). Lock-screen Approve / Reject actions require the device to be unlocked. Approvals that need biometrics (§11) open the app.
- **Electron (desktop):**
  - **Security:** `contextIsolation` on, `sandbox` on, `nodeIntegration` off. The web app reaches native features only through a typed preload bridge that implements the platform interfaces (§14.1).
  - **Main process:** local file access, screen capture, local tool server processes and the global shortcut run there, never in the page.
- **Deep links:** the `agentspace://` scheme plus Android App Links on the web domain open the matching path (§14.1). Sign-in and connection flows on mobile and desktop run in the system browser and return through these links.
- **Release process:** CI builds the web bundle once and packages it for the web, Capacitor (Android) and Electron (Mac, Windows). The minimum supported version per platform (§14.1) is raised whenever the API drops support for an old app.

### 14.3 Device tools
Device tools let a bot use things that only exist on the user's own computer or phone: local files, the screen, phone contacts, location and so on. Everything else (email, calendar, CRM, browsing, scripts) already works through connections (§8) and the cloud computer (§9), so device tools cover only what the cloud can't reach.

**Desktop tools**
| Tool | What the bot can do |
|---|---|
| **Local files** | List, search, read, create, move and rename files, **only inside folders the user has allowed** (e.g. Documents/Reports, Downloads). Nothing outside them is visible. Deleting or overwriting a file needs approval. |
| **Look at my screen** | Take a picture of a window or area the user picks, **only when asked** ("what's this error?"). Each time, the user sees a picker and can cancel. (Screen sharing in voice mode is separate; see §7.6.) |
| **Local tool servers** | Run tool servers (MCP) that exist only on the user's computer or company network, e.g. an internal system behind the company VPN or a local database. They're added in the desktop app, are private to that computer, and appear next to the other tools labelled "on Petros's MacBook". |
| **Clipboard** | Put results on the clipboard ("copy the table"). Reading the clipboard is only done when the user asks. |
| **Open** | Open files, links and apps on the computer ("open the report", "open the deal in HubSpot"). |
| **Control my computer** | Use the apps on the computer like a person, clicking, typing and scrolling, to finish a task the user asked for (e.g. "fill in this expense claim in our old finance app"). **Off until the user turns it on**, and needs the user's OK every time (see below). |

**Control my computer**
- **Off by default:** this tool's switch starts at **Never** and has no "Always allow". The user turns it on in Settings → Devices on that computer, which explains what it does. On Mac, the app then asks for the Accessibility and Screen Recording permissions.
- **Permission every time:** when a bot wants to use it, a card appears **on that computer**: "Sales Sam wants to control this computer to: fill in the expense claim in FinanceApp". It has a screen picker and the buttons **Allow** and **Don't allow**. Because the card only appears on the computer itself, someone has to be at it, even if the request came from a chat on the phone.
- **How long it lasts:** permission ends when the task finishes, when the user stops it, or after 30 minutes, whichever comes first. After that the bot has to ask again.
- **One screen only:** the bot sees and acts only on the screen picked in the card.
- **While the bot is working:**
  - A coloured border goes around the screen, with a small bar at the top: "Sales Sam is using your computer", with **Pause** and **Stop**.
  - **Taking over:** as soon as the user moves the mouse or types, the bot pauses and the bar shows "You have control" with **Hand back**.
  - **Stop shortcut:** **Ctrl/Cmd+Alt+Shift+S** stops the bot straight away from anywhere.
- **Apps the bot can't use:** Agent Space itself, password managers, system settings and security prompts (e.g. Windows administrator prompts, macOS password dialogs), and terminal apps. Users can add more apps in Settings → Devices. If one of these apps is in front, the bot stops acting and asks the user to switch away from it.
- **Passwords and payment details:** the bot never types passwords or card numbers. When a sign-in or payment needs them, it pauses and asks the user to type them. Nothing is recorded while the user has control.
- **Approvals:** the same rules as on the cloud computer (§9.3, §11). Sending, submitting, buying and deleting need approval first.
- **Never in automations:** this tool is only used in a conversation the user started and is present for. Automations can't use it.
- **Record:** each action appears in the activity feed with a small screenshot, and a replay is kept like the cloud computer's replay (§9.2). It follows the organisation's data retention settings, and the parts where the user had control are left out.

**Mobile tools**
| Tool | What the bot can do |
|---|---|
| **Camera and document scanner** | Ask the user to take a photo or scan a document (receipts, business cards, contracts, whiteboards). The text is recognised so the bot can read it. The user always takes the picture; the bot can't use the camera by itself. |
| **Contacts** | Search the phone's contacts for a name, number or email ("text Anna I'm late"). It can't read the whole address book at once. |
| **Send via phone apps** | Prepare a text message, WhatsApp message, email or phone call and open it in that app with everything filled in. **The user taps Send**; the bot can't send through these apps by itself. |
| **Device calendar and reminders** | Read and add events and reminders in calendars on the phone (including personal and work calendars synced to the phone but not connected in §8). Adding or changing events follows the usual approval rules. |
| **Location** | Get the current location once, when asked ("cafés near me"). Also used for **place-based automations** (§10.2), e.g. "when I arrive at the office, brief me on today". |

**Mobile features that aren't bot tools**
- Approve from the lock screen, with fingerprint / face unlock for sensitive approvals: payments, entering passwords on websites, and anything the organisation adds (§13.4).
- **Google Assistant:** "Ask Sales Sam…", "Start voice mode with Sales Sam", "Run my morning briefing".
- **Home-screen widgets:** quick-ask, voice mode, and the number of approvals waiting.
- **Live progress of long tasks** on the lock screen ("Researching… 12 of 30 done").

**Not offered:** reading text messages or call history, tracking location continuously (other than the user's own place-based automations), health data, and sending messages or making calls without the user tapping.

**Permissions**
- **Three layers:**
  1. The operating system's own permission prompt.
  2. An Agent Space switch per device and per tool.
  3. Organisation settings that can turn device tools off (§13.4).
- **Each tool switch** has three options: **Ask each time** (default), **Always allow** and **Never**. Control my computer is the exception, as described above. With "Ask each time", the bot shows a card on that device: "Sales Sam wants to search your Contacts on this phone — Allow once / Always allow / Don't allow".
- **Desktop folders and local tool servers** are only available once the user has added them. There are no defaults.
- **Logging:** every use of a device tool appears in the activity feed (§7.3) and the activity history (§11), showing which device and which tool.
- **Online only:** device tools work only while that device is online with Agent Space signed in. The bot sees them as available only then, e.g. "Petros's MacBook (online)".
- **Several devices online:** the bot uses the device the user is currently using, or asks if it's unclear.
- **In automations:**
  - Automations may use desktop tools, except control my computer. If the computer is offline when a run needs it, the run waits up to 1 hour and then fails with a notification (§10.5).
  - Mobile device tools are not used in automations, apart from location for place-based triggers.

**How it's built (for the development team):**
- **Tool definitions:** device tools are ordinary tools with `runs_on: device` (§14.1) and a `platforms` list. They are offered to the model only when an online device of the right platform has them enabled.
- **Routing:**
  - The tool layer sends the call to the target device over the existing real-time channel, routed through Redis to the API instance holding that device's connection (§14.4).
  - The device runs it through the platform layer, applying the permission switches and showing any prompts, and returns the result.
  - If there's no response within 30 seconds (2 minutes for anything waiting on the user), the call fails as "device not responding".
- **Results:** device results pass through the same redaction, logging and approval checks as server tools. Files or images over 1 MB are uploaded to file storage (§7.7) and returned as file IDs.
- **Permission storage:** switches are saved per device in the `devices` table (§14.1) and synced, so the server knows which tools to offer. The device enforces them again locally before running anything.
- **Local tool servers:** started by the Electron main process from a command and arguments the user enters, connected over stdio, and their tools listed to the server marked `runs_on: device`. They stop when the app quits.
- **Control my computer:**
  - A device tool `computer_control` (`runs_on: device`, platforms `desktop`) with the same actions as the cloud computer's computer tool: screenshot, click, double-click, type, key, scroll, move and drag.
  - It runs in the Electron main process. Screenshots come from `desktopCapturer` for the chosen display, scaled to at most 1280 px wide, and coordinates are mapped back to the real screen. Input is sent with `@nut-tree-fork/nut-js`.
  - The grant (conversation, task ID, display, expiry) is held in the main process and checked on every call. Calls without a valid grant fail.
  - Before each action the main process reads the frontmost app (`get-windows`) and refuses the action if that app is on the blocked list.
  - A global input hook (`uiohook-napi`) detects real mouse and keyboard input, ignoring events the tool generated itself, and pauses the tool. The stop shortcut is registered with `globalShortcut`.
  - The border and the status bar are always-on-top, click-through windows excluded from screenshots.
  - The tool is never offered to automation runs. Screenshots for the activity feed and replay are uploaded to file storage (§7.7).
- **Place-based triggers:** use the operating system's geofencing (up to 20 places per user). The device reports "arrived" / "left" events to the API, which starts the automation.

### 14.4 Background work, queues and Redis (for the development team)

Bots keep working after the user leaves, automations run while nobody is watching, and the API runs as several instances. Anything that is slow, must survive a restart, must run on a schedule, or must reach a client connected to a different API instance goes through **Redis** and **BullMQ**. Everything else stays a plain request to the API and the database.

**What uses BullMQ and Redis, and what doesn't**
| Use BullMQ / Redis for | Keep as a normal request or in-process |
|---|---|
| Bot runs: chat replies, long tasks, automation runs, bot-to-bot requests | Reading and saving records (settings, bots, connections, messages already written) |
| Anything on a schedule or delay: automations, approval timeouts, idle pause of cloud computers, token refresh, clean-up, reports | Creating signed upload/download URLs (§7.7) |
| Anything that must retry: email, push, provider revocation, webhook handling | Writing a pasted secret to Secret Manager (§8.7, §8.8) |
| Live events that must reach whichever API instance holds the user's connection: streaming replies, live activity, task list, approvals, device tool calls | The voice-mode sideband connection and its tool calls (§7.6), which must answer within the same live session |
| Short-lived shared state: locks, rate-limit counters, usage counters, non-secret caches | Anything that is the source of truth: the database (Postgres) always is |

**Redis**
- One Redis 7 instance per environment (staging, production), in the same EU region as the API, with persistence (AOF) on. Locally, Redis runs in Docker; `REDIS_URL` is set in each environment's `.env` file.
- `maxmemory-policy` is `noeviction`, as BullMQ requires. Every non-queue key therefore has a TTL.
- All keys are prefixed `as:<env>:` (BullMQ queues use the same prefix through the queue `prefix` option), so staging and production can never collide even if they share an instance.
- The existing `RedisModule` (`api/src/core/databases/redis/`) provides the connection options; `QueuesModule` (`api/src/core/queues/`) connects BullMQ with them. The API refuses to start without `REDIS_URL` outside local development.
- **Never in Redis:** secret values, decrypted tokens (§8.7), signed URLs, or message content beyond the live event streams below. Job payloads contain **IDs only** (run ID, automation ID, credential ID); workers load everything else from the database when the job runs.

**Processes**
- The API and the workers are the same NestJS codebase, started with `PROCESS_ROLE`:
  - `api`: serves HTTP, GraphQL and real-time connections, and adds jobs to queues. It runs no queue workers.
  - `worker`: runs the queue processors and no HTTP server except `/health`.
  - `all` (local development only): both in one process.
- Processors live in `api/src/background/<queue>/` (per the API rules), one processor class per queue. Queue names and job names are constants in `api/src/core/queues/queues.constants.ts`.
- Workers scale horizontally; BullMQ ensures each job runs on only one worker. On shutdown, workers stop taking new jobs and wait up to 60 seconds for running jobs; unfinished jobs are picked up again by another worker (a job that stops reporting progress is marked stalled after 30 seconds and retried).
- **Recurring work uses BullMQ job schedulers** (`queue.upsertJobScheduler`), never `@nestjs/schedule` `@Cron`, so a recurring job runs once across all instances, not once per instance. Platform schedulers are upserted at worker start-up from a single list in code.

**Queues**
| Queue | Jobs | Concurrency per worker | Retries | Notes |
|---|---|---|---|---|
| `agent-runs` | `run` (chat reply, task, automation run, bot-to-bot request), `resume` (after an approval or user input) | 20 | None automatically (see below) | Job ID = run ID, so a run can never be queued twice |
| `automations` | `tick` (a scheduled or triggered start), `retry` | 20 | 3, exponential from 5 s | Decides whether a run starts; never does the work itself |
| `triggers` | `composio-event`, `device-place-event` | 20 | 5, exponential from 5 s | Job ID = provider event ID, so repeated webhook deliveries are ignored |
| `approvals` | `timeout` | 10 | 3 | Delayed job per pending approval with a timeout (§13.2, §13.4) |
| `notifications` | `dispatch`, `email`, `push` | 20 | 5, exponential from 30 s | `dispatch` applies the user's settings and quiet hours, then adds one job per channel |
| `connections` | `sync-composio-status`, `refresh-token`, `revoke-and-delete-credentials` | 10 | 5, exponential from 1 min | |
| `cloud-computers` | `idle-pause`, `session-limit`, `process-replay` | 10 | 3 | |
| `storage` | `purge-deleted`, `apply-retention`, `aggregate-usage` | 2 | 3 | |
| `exports` | `user-data-export`, `activity-export` | 2 | 2 | The user is notified with a download link when done (§11, §13.4) |
| `usage` | `flush-counters`, `limit-alerts` | 2 | 3 | |

- Completed jobs are kept for 24 hours (at most 1,000 per queue); failed jobs for 14 days, for debugging.
- Each job records its run, automation or user ID in its data and in log lines, so a job can be traced from Bull Board to the run history and back.

**Bot runs (`agent-runs`)**
- Every bot run executes in a worker, never inside the HTTP request: sending a message saves it, creates a run record (`queued`) and adds a `run` job, then returns. This is what lets the user close the app and come back (§10.1), and keeps runs going when an API instance restarts.
- **One run at a time per bot per conversation.** The worker takes a Redis lock `as:<env>:lock:conv:<conversationId>:bot:<botId>` (renewed every 10 seconds, expiring after 30). If the lock is held, the job is moved back to delayed for 2 seconds. A message sent while the bot is still replying is therefore answered after the current reply, in order.
- **One run at a time per cloud computer.** A run that needs the bot's computer (§9) takes `as:<env>:lock:computer:<botId>` the same way. Other runs for that bot wait for it; the activity feed shows "Waiting for the computer to be free".
- **Waiting doesn't hold a worker.** When a run needs approval (§11), user input (an interactive reply, the secure secret box) or an offline device (§14.3), its state is saved to the database, the run is marked `waiting`, and the job completes. The approval, answer or device coming online adds a `resume` job for the same run.
- **Stopping:** "Stop" (§7.2) sets `as:<env>:run:<runId>:cancel`; the run loop checks it between steps and before every tool call, and ends the run as `stopped`.
- **Failures:** chat replies and tasks are not retried automatically, since a retry could repeat actions already taken; the run is marked failed and the user can re-run it (§7.2). Automation runs follow §10.5, handled by the `automations` queue, not by BullMQ retries.
- **Priority:** chat replies have priority 1, bot-to-bot requests 2, tasks 3 and automation runs 5, so people waiting in a chat are served first when workers are busy.

**Automations (`automations`, `triggers`)**
- **Schedules:** each active scheduled automation has one BullMQ job scheduler with ID `automation:<automationId>`, using its cron expression and time zone (§10.6). Saving or resuming an automation upserts it; pausing or deleting removes it. A nightly `reconcile-schedulers` job compares schedulers with the database and fixes any difference.
- **Triggers:** Composio webhooks are verified in the API and added to `triggers` with the event ID as job ID. The job finds the subscribed automations and adds a `tick` for each. Place-based events from devices (§14.3) do the same.
- **Each `tick`:**
  - Checks the automation is still active and its owner still has access to everything it uses; otherwise pauses it and notifies (§10.5).
  - Checks usage limits (§11).
  - If a run of this automation is still active, records "skipped" in the run history and stops (§10.5). This check uses the run records plus a lock `as:<env>:lock:automation:<automationId>` held for the length of the run.
  - Otherwise creates the run record and adds an `agent-runs` job with priority 5.
- **Retry and auto-pause (§10.5):** when an automation run fails, the automation service adds a `retry` job delayed by 10 minutes, once. If the retry also fails, the user is notified, and after 3 failed runs in a row the automation is paused and its scheduler removed.
- **Most frequent schedule allowed** (§13.4) is checked on save, from the cron expression.

**Live events across API instances**
- Clients keep one real-time connection to whichever API instance they reached. Workers publish events to Redis; every API instance reads the ones its connected clients need.
- **Conversation events** (message parts as they stream, live activity steps, interactive replies, approval cards) go to a Redis Stream per conversation, `as:<env>:stream:conv:<conversationId>`, capped at about 5,000 entries and expiring 24 hours after the last event. Each event carries the stream entry ID.
- **Resuming:** when a client reconnects (§14.1, "Unreliable connections"), it sends the last entry ID it received, and the API replays everything after it from the stream before sending live events. If the ID is older than the stream, the client reloads the conversation from the database. Messages are written to the database at the end of every step, so the stream is never the only copy of a finished message.
- **User events** (notifications, Tasks page updates, connection status, "a task finished" during voice mode) use a Redis Stream per user, `as:<env>:stream:user:<userId>`, in the same way.
- **Device tool calls (§14.3):** the tool layer publishes the call on `as:<env>:device:<deviceId>` (Redis pub/sub). The API instance holding that device's connection forwards it; the result comes back on a reply key the waiting run reads with `BLPOP`, using the timeouts in §14.3.
- **Voice mode (§7.6):** the sideband connection stays in the API instance that opened it. Its tool calls run in that instance through the shared tool layer, because they must answer within the live session. `start_task` adds a normal `agent-runs` job, and the result reaches the voice session through the user's event stream.

**Other timed jobs**
- **Approval timeouts:** creating an approval with a timeout adds a delayed `approvals.timeout` job with ID `approval:<approvalId>`; resolving the approval removes it.
- **Cloud computer idle pause (§9.3, §13.4):** every bot or user action on the computer replaces a delayed `idle-pause` job (ID `computer-idle:<botId>`) set to the organisation's idle time. A `session-limit` job enforces the maximum continuous session.
- **Sign-in refresh (§8.7):** after every refresh of a custom tool server sign-in, a `refresh-token` job is added for 5 minutes before the new expiry. A Composio status sync runs every 15 minutes, and also immediately when Composio reports an expired connection.
- **Member removal (§8.7):** adds `revoke-and-delete-credentials` for that member.
- **Notifications (§12):** quiet hours delay the channel jobs until quiet hours end, except approvals marked urgent. The `email` job is rate-limited with BullMQ's queue limiter to stay inside the email provider's sending limits.
- **Platform schedules** (all times UTC):
  | Job | When |
  |---|---|
  | `storage.purge-deleted` (§7.7) | Daily 02:00 |
  | `storage.apply-retention` (§7.7, §13.4) | Daily 02:30 |
  | `storage.aggregate-usage` (§7.7) | Daily 03:00 |
  | `automations.reconcile-schedulers` | Daily 03:30 |
  | `connections.sync-composio-status` | Every 15 minutes |
  | `usage.flush-counters` | Every minute |
  | `usage.limit-alerts` | Every 5 minutes |

**Caching, locks and limits in Redis**
- **Locks:** the locks above use a single Redis key set with `SET NX PX` and a random token, released only by the holder (checked in a Lua script).
- **Rate limits:** API request rate limiting (per user and per IP for sign-in, public artifact and webhook endpoints) uses the NestJS throttler with Redis storage, so the limits apply across instances.
- **Usage counters (§11, §13.4):** every model call, cloud computer minute and voice minute increments counters per organisation, member and bot for the current month (`as:<env>:usage:<orgId>:<yyyymm>:…`). Limit checks before and during runs read these counters. `usage.flush-counters` writes them to the database every minute; the database is the record used for the usage overview.
- **Caches** (via the existing `AppCacheModule` with the Redis store), each with a TTL: the OpenRouter model list (1 hour), tool lists of custom tool servers (10 minutes, cleared when the server is edited), Composio connection status (5 minutes), and the effective settings for a user and bot (§13.1; 5 minutes, cleared on any settings change). Decrypted secrets are never cached in Redis (§8.7).

**Operations**
- **Bull Board** is served at `/admin/queues` behind basic auth (`BULL_BOARD_USER` / `BULL_BOARD_PASSWORD`) in every environment, with every queue above registered. In production it is reachable only from the internal network.
- **Health:** `/health` on API and worker processes checks the Redis connection. Workers also report each queue's waiting, active, delayed and failed counts.
- **Alerts:** a queue with more than 500 waiting jobs or 50 failed jobs in an hour, an `agent-runs` job waiting longer than 30 seconds, or Redis memory above 75% raises an alert to the team.

---

## 15. Main User Journeys

1. **First-time setup (under 5 minutes):** Sign up → personal organisation is created → pick a starter bot template → connect Gmail and Calendar → ask the first question ("What's on my plate today?").
2. **Build a team setup:** Create organisation "Acme" → invite colleagues as Admins/Members → Admin connects the shared company CRM and support inbox → create Sales and Marketing bots → create a "Go-to-market" group with both bots and the team.
3. **Real work with the cloud computer:** "Find 20 dentists in Athens with websites, collect their emails into a spreadsheet." → bot browses the web on its computer → user clicks *Watch* → bot hits a sign-in page and asks for help → user takes control, signs in, hands back → bot delivers the spreadsheet.
4. **Bots collaborating:** In the Marketing chat: "Write a case study about our latest closed deal." → Marketing bot asks Sales bot for deal details → drafts the case study → asks approval before sharing it in Slack.
5. **Choosing a model:** Create a Research bot → pick a "Smart" model for in-depth work → create a Quick Assistant bot on a "Fast" model → later ask "Switch the Research bot to the recommended model" to reduce costs.
6. **Change settings by chat:** "Make the Finance bot green, call it Penny, and stop it from sending emails without asking me." → bot shows the changes → user confirms → done.
7. **Multiple accounts:** User connects two Gmail accounts → tells the Sales bot to use only the work one → asks the Personal bot to manage the other.
8. **Publishing an artifact:** "Build a sign-up page for our webinar on 5 December." → bot builds the page in the side panel → user asks for a few changes → shares it with the Marketing team as Editors → turns on a public link and adds it to the company website → sign-ups are collected in the artifact → later, user asks "How many people signed up?" and restores an earlier version after a teammate's unwanted change.
9. **Creating and using a skill:** User walks the Sales bot through onboarding a new client → says "Turn what we just did into a skill" → bot drafts "🤝 Client onboarding", user confirms → "Give this skill to the Support bot too" → next week, types "/client-onboarding for Acme Ltd" in the Support chat → bot asks for the start date and completes all steps → later: "Add a step to create a Slack channel" → bot updates the skill as a new version.
10. **Voice mode on the move:** User taps the voice mode button in the Sales bot chat while walking to a meeting → "What's the latest with Acme?" → bot checks HubSpot and Gmail (activity shown on screen) and answers out loud → "Email Anna that I'll be 10 minutes late" → bot reads a short summary of the draft → user says "send it" → email is sent → "And book a follow-up next Tuesday afternoon" → bot checks both calendars and books it → user exits voice mode → everything that was said, plus the email and meeting, is in the chat as text.
11. **Daily automation with the cloud computer:** "Scan the x repository on my GitHub every day for vulnerabilities and send the results to Slack channel y." → bot checks GitHub and Slack are connected and its computer is on → asks the run time and "new findings only?" → shows the summary with "Post to #y" pre-approved → user confirms → every morning the code is copied to the bot's computer, scanned, compared with yesterday and a summary of new and fixed issues is posted to #y → one day GitHub needs re-connecting, the automation pauses and tells the user → user re-connects and resumes. (Full example in §10.6.)

---

## 16. Additional Features (Suggested Enhancements)

These go beyond the original idea and are recommended for the roadmap:

- **Bot templates gallery** inside the organisation, so teams can share proven bots.
- **Meeting assistant** — prepares briefs before meetings and drafts follow-ups after.
- **Knowledge library** — upload company documents once; all permitted bots can use them.
- **Built-in slash commands** (`/summarise`, `/remind`, `/watch`) shown in the same `/` menu as skills.
- **Local terminal commands** on desktop for developers, behind a "Developer mode" switch, with approval for every command.
- **Message from anywhere** — talk to bots through email, Slack or WhatsApp in addition to the app. Each member links a channel to one of their bots in Settings → Message from anywhere: email works from the member's own address to a personal address; Slack and WhatsApp are linked by sending a one-time code from that account. Messages go into the member's chat with that bot, and the answer is sent back to the same place (with a link to the app for anything that only shows there, and for approvals).
- **Undo** for actions where the connected service allows it.
- **Password manager connection** (1Password, through the organisation's 1Password Connect server) — the bot's computer fills in a website password straight from the password manager, still without the bot ever seeing it.
- **More bot templates**, starting with Recruiting and Finance.

---

## 17. Release Plan

**Phase 1 — Foundation (MVP)**
- Sign up, organisations, invitations, three fixed roles
- Bots with name, emoji, colour, instructions and a chosen AI model; direct and group conversations
- Private and shared connections, including multiple accounts per service and connections by access key
- Secure storage of sign-ins and keys in Google Cloud Secret Manager; bots never see secrets (§8.7)
- File storage on Google Cloud Storage with signed upload and download links (§7.7)
- Secure secret box in chat, and warning when a secret is typed into a message (§8.8)
- Secrets page to view, rename, replace, share and delete secrets, in the app or by chat (§8.9)
- Built-in core tools (web search, files, memory, app management by chat)
- Approvals for sensitive actions
- Interactive replies using ready-made building blocks
- Background work on BullMQ and Redis: queue workers, bot runs outside the request, live event streams across API instances, locks, rate limits, usage counters and Bull Board (§14.4)
- Web app, built as one cross-platform app with the platform layer, checks and device records described in §14.1, ready for the desktop and mobile apps

**Phase 2 — Cloud computer and teamwork**
- Cloud computer with live view, take control, file panel
- Bringing files from connected services onto the cloud computer and sending results back (§9.5)
- Website sign-ins on the cloud computer: secure sign-in box, kept sessions and the signed-in websites list (§9.4)
- Bots consulting other bots
- Custom tool servers
- Task list, long-running tasks, notifications
- Custom mini-apps in interactive replies; pinning and saved widgets
- Artifacts with links, sharing permissions, public links, version history and comments
- Skills: create, edit, delete and assign in the app or by chat; `/` mentions; starter library; versions and sharing
- Voice mode (§7.6) on web and desktop
- Desktop app (Electron) with quick-ask with selection, deep links and desktop device tools: local files, look at my screen, local tool servers, clipboard, open (§14.2, §14.3)

**Phase 3 — Automation and mobile**
- Scheduled and triggered automations, with pre-approved actions, automation memory, run history and automatic pausing on failure (§10)
- Mobile app (Capacitor) for Android: push with lock-screen approvals, fingerprint / face unlock, camera and document scanner, share-to-bot, native voice plugin for voice mode with the screen locked, Google Assistant shortcuts, widgets, live task progress, and mobile device tools: contacts, send via phone apps, device calendar and reminders, location and place-based automations (§14.2, §14.3)
- Control my computer on desktop (§14.3), and camera and screen sharing in voice mode (§7.6)
- Usage limits
- Selected suggested enhancements from §16

---

## 18. Success Measures

- Time from sign-up to first completed task (target: under 5 minutes)
- Weekly active users and active bots per organisation
- Number of tasks completed by bots per week
- Share of tasks completed without user intervention
- Approval acceptance rate (signals bots propose the right actions)
- Number of connections per user and share using multiple accounts
- Team expansion (members per organisation)
- Customer satisfaction score on completed tasks
- Voice mode sessions per active user per week, and share of sessions in which the bot completed at least one action

---

## 19. Implementation Status (20 November 2026)

This section records what the code does today against this specification. Setup, environment variables and run commands are in `docs/RUNNING.md`. "Tested" means it was tried end to end against the staging services (staging database, OpenRouter, Composio, Daytona, OpenAI, Google Cloud) in Chrome. "Built" means the code is in place but was not tried end to end.

### 19.1 Built and tested

| Area | Spec | What works |
|---|---|---|
| Accounts and organisations | §5 | Email sign-up and sign-in, organisations, invitations, the three roles (Owner, Admin, Member) |
| Bots | §6.1–6.6 | Create from the 6 templates or from scratch, emoji/colour/instructions, AI model choice, memory (`remember` / `forget`), bots consulting other bots (`ask_bot`), changing bots and personal settings by chat |
| Skills | §6.7 | Create, edit, delete and assign in the app or by chat, `/` mentions, starter library. Files can be attached to a skill and the bot reads them when it follows the skill |
| Knowledge | §6.2, §16 | Files (PDF, Word, Excel/ODS, PowerPoint, text, Markdown, CSV, JSON, HTML, images), web pages and notes per bot, plus an organisation knowledge library (Settings → Knowledge library). Each item is indexed in the background (status Processing → Ready / Failed with a reason and a retry): text is extracted, images and scanned PDF pages are read with a vision model (OCR), and the text is split into embedded passages. `search_knowledge` is semantic (vector) search; bots also use `read_knowledge` and `read_file` and name the source they used |
| Conversations | §7.1–7.4 | Direct and group conversations, live activity steps with icons, approvals for sensitive actions, interactive replies (`show_ui`), reactions, pinned messages, file attachments |
| Artifacts | §7.5 | Bots create and update pages and apps. They run on an isolated host, with sharing levels, public links (optional password and expiry), version history, comments, a saved-data runtime (`window.agentspace.save/list/ai`) with a Data tab, and a report link on public pages |
| Voice mode | §7.6 | OpenAI Realtime over WebRTC. The API holds the key and runs every tool server-side. Includes the voice picker with samples, push-to-talk, mute, interrupt, reconnecting within 15 s, silence and length limits, approvals by voice, and transcripts saved to the chat as voice messages. Tested with a synthetic audio stream, because the browser's microphone prompt can't be clicked by automation |
| Files and storage | §7.7 | Google Cloud Storage with signed upload and download links. Data from the earlier dev stand-in was moved with `api/scripts/migrate-dev-stores.cjs` |
| Connections | §8.1–8.3, §8.5 | Composio accounts, several accounts per service, private and shared connections, services added by access key, `call_api` |
| Custom tool servers | §8.4 | MCP over Streamable HTTP with SSE fallback, sign-in through OAuth (dynamic client registration and PKCE). Tested with DeepWiki |
| Built-in tools | §8.6 | Web search, read web page, create document, memory, app management by chat |
| Secrets | §8.7–8.9 | Google Cloud Secret Manager, secret box in chat, warning when a secret is typed into a message, Secrets page, and managing secrets by chat |
| Cloud computer | §9.1–9.3 | One Daytona sandbox per bot with turn on, pause and reset, and auto-stop when idle. The live view goes through an API proxy, which hides Daytona's warning page and blocks input for people who are only watching. Includes take control and hand back, commands, file read/write, the files panel, screenshots the bot can see, browser clicking, typing and scrolling, a session replay, and minute-based usage |
| Automations | §10.2–10.5 | Scheduled automations created in the app or by chat, with Run now, run history, pre-approved actions, automation memory, retries and automatic pausing after repeated failures. Pre-approved actions are built but were not tried end to end |
| Activity history | §11, §13.4 | Organisation-wide activity history for Owners and Admins, in Settings → Activity (`/settings/activity`) and the `GET /activity` API |
| Artifact download and export | §7.5 | "Download as" offers PDF, image (PNG) and the self-contained web page for every artifact, PowerPoint for slide decks and Word for documents. The API opens the live page in headless Chrome (`RendererService`, Puppeteer; `CHROME_PATH` optional) with a short-lived view token: PDF from print layout, PNG full page, decks by stepping through slides with the right arrow (one image per slide, also used for deck PDFs), Word from the rendered content |
| Artifact live data | §7.5 | `window.agentspace.live("HUBSPOT_LIST_DEALS", params)` runs a read-only connected-service action with the viewer's own connection (members only, never public links; anything that sends, changes or deletes is refused; 60 calls a minute). The first time, the app (not the page) asks "Let … read your Gmail data?"; the answer is saved per member, artifact and service and can be removed in the artifact's Settings. Tested in Chrome with a real Gmail account |
| Artifact visitor uploads | §7.5, §7.7 | `window.agentspace.upload(file)` posts the file (multipart, no CORS preflight) to `/ax/:id/files`; the page saves the returned reference in a record. Up to 10 MB; PDF, images, Office, text, CSV or ZIP (scripts, HTML and programs refused); 500 per artifact. Members can always upload; public visitors only while "File uploads from visitors" is on in Share. Files are stored with the artifact and only owners and editors download them from the Data tab (signed links) |
| Desktop device tools | §14.3 | Local files (allowed folders only; delete and overwrite always ask for approval), look at my screen (picker in the app), local tool servers (MCP over stdio, env values encrypted on the computer), clipboard, open, and control my computer. The desktop app announces itself on the real-time connection (`device:hello`), calls go out on a Redis channel to whichever API instance holds its socket and come back on a reply list (30 s, 2 min when waiting for the user, up to 1 hour for an offline computer in automations). Settings → Devices → This computer has the per-tool switches (Ask each time / Always allow / Never; control has no Always allow), allowed folders, local tool servers and blocked apps. Tested in the real desktop app on Windows: the bot listed and read files after "Allow once", used a local tool server tool, saw a window picked in the screen picker, and took a control-my-computer screenshot after "Allow" (border and bar shown, then removed when the run ended) |
| Camera and screen sharing in voice mode | §7.6 | Camera and Share screen buttons in the voice bar (camera on web, desktop and Android with front/back switch; screen on desktop browsers and the desktop app), a live preview with Show this and Snapshot, and a small camera/screen icon on spoken messages that came with a picture. The organisation switch hides the buttons and the sideband deletes any picture in a session where it's off. Tested in Chrome with a fake camera: the bot described the camera picture and the snapshot was posted in the chat as an image |
| Saved widgets | §7.4 | "Save as widget" on any interactive reply. The Widgets page lists them; opening one shows the last version and asks the bot again for fresh data with read-only tools (anything needing approval is skipped), then rebuilds it. Rename, change what the bot is asked, refresh, open the source conversation, delete |
| Deleted artifacts | §7.5, §13.2 | Kept and restorable from the Deleted tab by default. The personal setting "Permanently delete my deleted artifacts after 30 days" (off by default) makes the daily `storage.purge-deleted` job remove them and their files 30 days after deletion |
| Automation triggers from connected services | §10.2 | "When something happens" in the automation form (and `create_automation` with a trigger, after `list_automation_triggers`): pick the connected account, the event (Composio trigger types, e.g. a new Gmail message or a Slack channel message) and its settings. Composio watches the event and calls `POST /api/webhooks/composio`; deliveries are checked with the Standard Webhooks signature (`COMPOSIO_WEBHOOK_SECRET`), replays are ignored, and the matching automation runs with the event as its input (kept on the run, also for the retry). Pausing disables the watch, resuming re-enables it, deleting removes it. Tested with a real Gmail trigger created and removed at Composio and a signed event: the run started and the bot reported the sender and subject |
| Cloud computer: files from connected services | §9.5 | `copy_to_computer` from a chat file, a link or a connected account (through the Composio proxy, named by its label; the sign-in never reaches the computer), with optional unpacking, and `copy_from_computer`. Tested: a bot copied a Gmail API response through the connected account onto the computer and read it there |
| Meeting assistant | §16 | A card on the Automations page sets it up with a bot, a calendar (Google Calendar or Outlook) and optionally an email account. It creates two automations the member owns: "Meeting briefs" (hourly at :45, briefs meetings starting in the next hour: attendees, recent emails with them, other connected data, purpose and agenda) and "Meeting follow-ups" (hourly at :05, saves a follow-up email to the attendees as a draft, never sends). Each remembers which meetings it handled; turning it off deletes both. Tested with the real Google Calendar: a meeting added 30 minutes ahead was briefed on "Run now" and remembered |
| Undo | §16 | When a bot's action created something a connected service can take back (calendar events, drafts, labels, Linear/Jira/Asana/Todoist/Trello items, Slack messages, reactions and reminders, Notion pages, Drive files and folders, HubSpot contacts, GitHub issues closed), its step shows **Undo** for 24 hours. Only the person the bot acted for can use it, once; the inverse call goes through the same account, and the message shows the step as undone. Sent emails can't be undone and get no button. Tested with a real Google Calendar event: created by a bot, deleted with Undo, a second Undo refused |
| Password manager connection | §16, §9.4 | Secrets → Add → Password manager connects a 1Password Connect server (address and access token, checked before saving; replacing the token checks it again and keeps the address). The bot sees it under "Saved website logins" as "any website with a login stored in …" and calls `computer_sign_in` with it and the website it is on: the API reads the Connect server at that moment, picks the login item whose website covers the open site (never a parent or look-alike domain), and the username, password and authenticator code are typed by the sign-in helper exactly as for a saved login. Nothing is cached or shown to the bot, the approval says which manager is used, and the secret's history records the website and item. Tested with a mock Connect server: the bot signed in to `the-internet.herokuapp.com` on its cloud computer and reported the secure-area message |
| Message from anywhere | §16 | Settings → Message from anywhere turns on email, Slack and WhatsApp per member, each with its bot. Email: a personal address on `INBOUND_EMAIL_DOMAIN` (Resend inbound; only mail from the member's own account address that passed SPF/DKIM/DMARC is accepted; quoted earlier mail is dropped; the answer is a reply from the same address). Slack and WhatsApp: a 6-digit code valid 15 minutes, sent from the account to link it (one Slack / WhatsApp account links to one member); unlinked senders get a how-to-link hint. Messages go into the member's direct chat with the bot (shown with a mail / Slack / WhatsApp mark) and the answer goes back to the same place; anything that only shows in the app, approvals and questions come with a link. Webhooks are signature-checked (Svix, Slack signing, Meta), stale or repeated deliveries are ignored, and each link is limited to 60 messages an hour. Tested with signed webhooks and mock provider APIs: real bot answers came back by email (threaded reply), in the Slack thread and on WhatsApp; another sender's email, bad signatures and a turned-off address were ignored, and the Settings card turned "Linked" by itself when the code arrived |
| Fingerprint / face unlock for approvals | §11, §13.4 | Payments and website passwords always need it on the Android app; Approvals & safety adds "all approvals", "emails outside the company" or "deleting data". Approvals carry `requires_biometric`; approving one in the Android app asks for fingerprint, face or screen lock first. The approval push is data-only so the phone draws Approve / Reject itself, and leaves the buttons off when unlock is needed. Rule, setting and push format tested through the API; the phone side has not been run on a device |
| Cloud computer: browsing and website sign-ins | §9.1, §9.4 | The sandbox now reaches public websites. Tested: the bot opened `the-internet.herokuapp.com`, signed in with `computer_sign_in` after the approval, and read the page after signing in |
| Usage limits | §13.4 | Limits for the organisation, each member and each bot, with spending bars and alerts at 80% and 100%. Checked through the API; the alerts were not triggered in a real session |
| Notifications | §12 | In-app notifications and web push (VAPID, service worker, a per-device switch in Settings → Notifications). Tested in Chrome with notifications allowed: turning push on created a browser subscription, and a finished task's push was shown by the service worker while Agent Space was not on screen (when it is on screen, non-urgent pushes are left to the in-app notifications) |
| Settings | §13 | Personal, bot and organisation settings, including voice and cloud computer settings |
| Background work | §14.4 | BullMQ queues, bot runs outside the request, Redis Streams events across API instances, locks, rate limits, usage counters, Bull Board |
| Responsive web app | §14.1 | Checked at phone width (390 px): no sideways scrolling on the pages added this round |

### 19.2 Built, not yet tested end to end

| Area | Spec | Status and what is missing |
|---|---|---|
| Cloud computer: signed-in websites list | §9.4 | The list of websites the computer is signed in to (read from the browser's cookies) and signing out of one are built but were not tried end to end |
| Desktop app (Electron) | §14.2 | `desktop/` builds, and the unpacked Windows app loads the app. Includes the secure bridge, `agentspace://` deep links, native notifications, open at start-up, a quick-ask shortcut and file pick/download |
| Mobile app (Capacitor) | §14.2, §14.3 | Android only. Everything below is built and the app compiles (`gradlew assembleDebug` produces the APK), but it has not been run on a phone: voice mode in a native foreground service (keeps going with the screen locked, End button in the notification), lock-screen Approve / Reject, fingerprint / face unlock before approving, home-screen widgets (quick ask, voice, approvals count), ongoing task-progress notifications (latest step, then "Finished"), Google Assistant and launcher shortcuts ("Ask …", "Start voice mode with …", "Run my …", open a feature; a chat opened with `?voice=1` starts voice mode), share to a bot, the document scanner, App Links (`/.well-known/assetlinks.json` from `ANDROID_CERT_SHA256`), icons, splash and the store listing text. Mobile device tools: scan with the phone (text read on the phone), search contacts, send via phone apps (the user taps Send), device calendar and reminders, and location; the server side was tested with a simulated phone connection. Push works through FCM once `FCM_PROJECT_ID` and `FCM_CREDENTIALS_JSON_BASE64` are set |
| Control my computer: input | §14.3 | Clicks, typing, keys, scrolling and drags (nut-js), pausing when the user moves the mouse or types (uiohook), the stop shortcut and the blocked-app check are built and their logic is unit-tested, but no real mouse or keyboard input was sent in testing. Nothing was tested on a Mac (Accessibility and Screen Recording prompts, coordinates) or in a packaged installer |
| Direct browser uploads to GCS | §7.7 | Need a CORS rule on the bucket for the app's origin. The staging service account can't read bucket settings, so this wasn't checked |

### 19.3 Not built yet

- **Automations (§10.2):** place-based triggers (postponed by the product owner; kept in the specification).

### 19.4 Skipped on purpose (product owner decision, 18 November 2026)

- Data export (§13.2, §13.4).
- From §16: the bot templates gallery, built-in slash commands, local terminal commands (developer mode) and more bot templates (they stay in the specification).
- Building and running the mobile app in Android Studio on a device.
- Applying the app-language setting to the interface. The setting is stored, but the interface stays in English (§13.2).

### 19.5 What needs action outside the code

- **Composio webhook:** run `node scripts/composio-webhook.mjs --create` (in `api/`, with the production `COMPOSIO_API_KEY` and `PUBLIC_API_URL`) once the API is deployed, and set the printed `COMPOSIO_WEBHOOK_SECRET`. Until then, automation triggers are created but their events can't reach the API.
- **Google Cloud Storage:** add a CORS rule on the bucket for the app's origin(s): `PUT` and `POST`, headers `Content-Type` and `x-goog-resumable`.
- **Firebase:** set `FCM_PROJECT_ID`, `FCM_CREDENTIALS_JSON_BASE64` and `android/app/google-services.json` for Android push.
- **Google Play:** a developer account for the mobile app, the release signing key, and its SHA-256 fingerprint in `ANDROID_CERT_SHA256` on the API; set `APP_LINKS_HOST` to the web app's domain in the Android build.
- **Message from anywhere:** each channel appears in Settings once its provider is set up (details in `docs/RUNNING.md`): a Resend receiving domain and `email.received` webhook (`INBOUND_EMAIL_DOMAIN`, `RESEND_INBOUND_WEBHOOK_SECRET`); a Slack app with direct messages and the `message.im` event (`SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`); a WhatsApp Cloud API number and webhook (`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_DISPLAY_NUMBER`).
- **Password manager:** organisations that want it run a 1Password Connect server reachable over https.
- **Production keys:** VAPID keys for web push (generated for staging), and `OPENAI_API_KEY` and `DAYTONA_API_KEY` for production.
