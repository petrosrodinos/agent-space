# Agent Space — Product Specification

**Version:** 1.0
**Date:** 17 November 2026
**Status:** Ready for implementation

---

## 1. Summary

Agent Space is a personal and team AI assistant platform for companies. Users create their own AI "bots" — each with a name, look and personality — and give them access to the tools they already use (email, calendar, documents, CRM, chat and more). Bots don't just answer questions: they take action. Each bot can use its own private computer in the cloud to browse websites, work with files, run tasks and complete multi-step jobs, and the user can watch it work live or take over at any time.

Bots live in conversations, much like a messaging app. A user can talk to one bot directly, or set up a group where several bots (for example a Sales bot and a Marketing bot) and several colleagues work together. Bots can see what other bots know and ask each other for help.

Agent Space is available on the web, as a desktop app (Windows and Mac) and as a mobile app (iPhone and Android), with the same experience everywhere.

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
| **Organisation owner / IT** | Manages members, roles, billing, shared connections and audit history. |

---

## 4. Key Concepts

| Term | Meaning |
|---|---|
| **Organisation** | A company or team workspace. Holds members, bots, conversations, connections and billing. |
| **Member** | A person who belongs to an organisation, with a role: Owner, Admin or Member. |
| **Bot** | An AI assistant with its own name, emoji, colour, instructions (personality and job), tools and memory. |
| **Conversation** | A chat. Can be one person with one bot, several people with one bot, or a group with several bots and people. |
| **Connection** | A linked account in another service (e.g. "Gmail – sales@company.com"). Can be **private** or **shared** with the organisation. |
| **Custom tool server** | An additional tool source a user adds themselves (for example their company's internal system), with its own sign-in. |
| **Built-in tools** | Abilities Agent Space provides itself, such as web search, file creation, reminders, memory and managing the app's own settings. |
| **Cloud computer** | A private virtual computer given to a bot to browse, run tasks and work with files. Users can watch and control it. |
| **Skill** | A reusable, step-by-step way of doing a specific job that can be given to any bot. See §6.7. |
| **Artifact** | A complete app, page, dashboard, document or presentation built by a bot, with its own link, sharing permissions and version history. See §7.5. |
| **Task** | A piece of work a bot carries out, possibly over several steps and several minutes or hours. |
| **Automation** | A task that runs on a schedule or when something happens (e.g. "every Monday at 9am" or "when a new lead arrives"). |

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
| Billing and plan | ✅ | ❌ | ❌ |
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

**Not changeable through chat** (for safety, these require the settings screens): password, sign-in methods, two-step verification, email address, phone number, personal identity details, payment details, organisation security settings, billing and plan, transferring ownership, deleting the account or organisation. See §13.5.

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
- Users change an artifact by asking ("make the header blue", "add a pricing section") or by editing text directly in the preview.
- Any member with access can **duplicate** an artifact to make their own copy and change it freely.
- An artifact can be created from an interactive reply ("turn this chart into a shareable dashboard").

**What artifacts can do**
- **Save information:** artifacts can store what visitors enter (form responses, votes, tracker items, sign-ups). This information is shared by everyone using the artifact and is visible to the artifact's owner and editors, who can also ask a bot to review or summarise it.
- **Show live data:** for organisation members, an artifact can show live information from connected accounts (e.g. this week's deals). Each viewer sees only what their own access allows, and is asked for permission the first time. Public artifacts never use anyone's connected accounts live; they only show information saved into the artifact.
- **Use AI:** artifacts can include AI features (e.g. a "summarise" button or a chat box). For organisation members, this counts toward their own usage. For public visitors, it counts toward the artifact owner's usage and can be switched off.
- **Accept file uploads** from visitors (e.g. CV uploads on a job form), stored with the artifact.
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
| **Editor** | View, use, comment, edit (directly or via a bot), publish new versions, restore old versions |
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
- If two people edit at the same time, both see each other's changes and nothing is overwritten.
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
- Deleting an artifact stops its link working and removes its versions and stored information after 30 days (restorable until then).

**How it's built (for the development team):** artifacts are React apps using shadcn/ui and the organisation's theme, built and versioned by the platform and served from a separate, isolated domain, each at its own permanent URL.

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
- Several can be added; each can be private or shared (shared requires Owner/Admin).
- Once added, its tools appear alongside all other tools and can be given to bots in the same way.

### 8.5 Built-in tools
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

---

## 9. The Bot's Cloud Computer

Each bot can get its own secure, private computer in the cloud (provided by our partner Daytona). This lets bots do things no chat-only assistant can.

### 9.1 What bots can do on it
- Browse websites like a person: log in, click, fill forms, download, compare prices, collect information.
- Work with files: open uploaded files, convert, combine, analyse, and create new ones.
- Run small programs and scripts to process data or automate repetitive work.
- Keep a workspace of files that stays between tasks.

### 9.2 Watching and taking control
- **Live view:** Users can watch the bot's screen in real time, in a side panel or full screen.
- **Take over:** Users can click "Take control" to use the computer themselves — for example, to enter a password, solve a "prove you're human" check, or show the bot how to do something — and then hand control back.
- **Explore manually:** Users can open a bot's computer at any time, even when the bot isn't working, to look around, browse or arrange files.
- **Files panel:** Browse, upload, download and preview the files on the computer.
- **Replay:** Review a recording/timeline of what the bot did during a task.

### 9.3 Safety
- Each computer is isolated; one bot can't reach another user's computer.
- Computers pause automatically when idle to save cost and resume automatically when the bot or user needs them again. Files are kept while paused.
- Bots ask before entering passwords, payment details or submitting anything important (see §11).

---

## 10. Tasks and Automations

- **Long tasks:** Users can give a bot a big job ("Research the 30 top competitors and build a comparison spreadsheet") and leave. The bot keeps working and notifies them when done or when it needs input.
- **Task list:** A "Tasks" page shows everything running, waiting for approval, finished or failed, across all bots.
- **Scheduled automations:** "Every morning at 8, summarise my unread emails and today's meetings."
- **Triggered automations:** "When a new deal is created in HubSpot, research the company and post a summary in the Sales group."
- Automations are created by asking a bot in plain words, and can be paused, edited or deleted from the Automations page.

---

## 11. Trust, Safety and Control

- **Approvals:** By default, bots ask before actions that are hard to undo or that go outside the company — sending emails, posting publicly, deleting things, making purchases, sharing files. Users can relax or tighten this per bot ("Always ask", "Ask for important actions", "Don't ask").
- **Approval cards:** Approval requests appear in chat and as notifications with a clear preview (e.g. the exact email to be sent) and Approve / Edit / Reject buttons.
- **Transparency:** Every action a bot takes is logged with what, when, which account and on whose behalf.
- **Activity history:** Owners and Admins can review organisation-wide activity.
- **Privacy:** Bots only use the connections and conversations the user is allowed to access. Private connections are never visible to other members.
- **Data control:** Users can export or delete their conversations and memories. Organisations can set how long data is kept.
- **Usage limits:** Organisations can set spending/usage limits per member or per bot.

---

## 12. Notifications

- In-app, push (desktop and mobile) and email notifications.
- Events: new message/mention, approval needed, task finished/failed, connection needs re-connecting, invitation received, automation results, artifact shared with me, comment or edit on my artifact, skill shared with me or changed.
- Per-user settings: which events, which channels, quiet hours. Can be changed in settings or by asking a bot.

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
| Bot voice | Choice of several voices |
| Speaking speed | Slower, **Normal**, Faster |
| Send voice message automatically when I stop talking | **Off** |

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
| Keep replays of bot sessions | **On** (subject to organisation retention) |

**Connections**
| Setting | Options |
|---|---|
| Default account per service | e.g. "Use Gmail – Work unless I say otherwise" |
| Connection problem alerts | **On** |

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

**Security** (settings screen only, never by chat)
| Setting | Options |
|---|---|
| Email, password | Change |
| Sign-in methods | Email, Google, Microsoft, Apple |
| Two-step verification | **Off** (On if the organisation requires it) |
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
| Knowledge | Files, documents and links it should know |
| Skills | Which skills it has (add or remove at any time) |
| Use skills automatically | **On** — the bot picks a matching skill by itself; Off means skills are only used when mentioned with `/` |
| Organisation knowledge | **On** — uses the company knowledge library |

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
| Built-in tools | Turn web search, image generation and document creation on/off for the whole organisation (**all On**) |
| Interactive replies | **Building blocks and custom mini-apps**, Building blocks only, Off |

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

**Automations**
| Setting | Options |
|---|---|
| Automations | **On** |
| Maximum active automations per member | **No limit**, or a number |
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
| Members may export their data | **On** |
| Temporary chats allowed | **On** |

**Security**
| Setting | Options |
|---|---|
| Require two-step verification | **Off** |
| Allowed sign-in methods | **All**, or a chosen subset (e.g. company Google/Microsoft only) |
| Sign out inactive sessions after | **30 days**, 7 days, 1 day |

**Activity history**
- View, search and filter all bot actions and admin changes; export to a file.

**Billing and plan** (Owners only)
- Plan, payment method, invoices, usage-based charges.

**Danger zone** (Owners only)
- Transfer ownership, delete organisation.

### 13.5 Changing settings by chat
- Any personal setting (except Security) and any bot setting the user is allowed to change can be changed by asking a bot (§6.6).
- Owners and Admins can also change organisation settings by chat, **except** Security, Billing and plan, and Danger zone, which require the settings screens.
- Every change requested in chat is shown as a summary and needs confirmation before it's applied.

---

## 14. Platforms and Experience

| Platform | Notes |
|---|---|
| **Web** | Full experience in any modern browser. |
| **Desktop (Windows, Mac)** | Same as web, plus: launch at start-up, system notifications, a global shortcut to open a quick-ask window, drag-and-drop files from the computer. |
| **Mobile (iPhone, Android)** | Full chat, approvals, notifications, voice input, camera/photo upload, share-to-bot from other apps, live view of the cloud computer (view and basic control). |

**Design principles**
- Feels like a modern messaging app: conversation list on the left, chat in the centre, optional side panel on the right (cloud computer, files, task details).
- Clean, friendly and fast; bots are recognisable by their emoji and colour.
- Works in light and dark mode; accessible (keyboard navigation, screen readers, good contrast).
- Voice: talk to bots and optionally hear replies read aloud.
- Languages: the app is available in English and Greek. Bots reply in the language the user writes in.

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

---

## 16. Additional Features (Suggested Enhancements)

These go beyond the original idea and are recommended for the roadmap:

- **Bot templates gallery** inside the organisation, so teams can share proven bots.
- **Meeting assistant** — prepares briefs before meetings and drafts follow-ups after.
- **Knowledge library** — upload company documents once; all permitted bots can use them.
- **Scheduled reports** delivered to a conversation, email or Slack.
- **Built-in slash commands** (`/summarise`, `/remind`, `/watch`) shown in the same `/` menu as skills.
- **Quick-ask window** on desktop and a home-screen widget on mobile.
- **Message from anywhere** — talk to bots through email, Slack or WhatsApp in addition to the app.
- **Undo** for actions where the connected service allows it.
- **More bot templates**, starting with Recruiting and Finance.
- **More languages** beyond English and Greek.

---

## 17. Release Plan

**Phase 1 — Foundation (MVP)**
- Sign up, organisations, invitations, three fixed roles
- Bots with name, emoji, colour, instructions and a chosen AI model; direct and group conversations
- Private and shared connections, including multiple accounts per service
- Built-in core tools (web search, files, memory, app management by chat)
- Approvals for sensitive actions
- Interactive replies using ready-made building blocks
- Web app

**Phase 2 — Cloud computer and teamwork**
- Cloud computer with live view, take control, file panel
- Bots consulting other bots
- Custom tool servers
- Task list, long-running tasks, notifications
- Custom mini-apps in interactive replies; pinning and saved widgets
- Artifacts with links, sharing permissions, public links, version history and comments
- Skills: create, edit, delete and assign in the app or by chat; `/` mentions; starter library; versions and sharing
- Desktop app

**Phase 3 — Automation and mobile**
- Scheduled and triggered automations
- Mobile apps
- Activity history, usage limits, billing
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
