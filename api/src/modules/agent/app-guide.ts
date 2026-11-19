/**
 * How Agent Space works, for bots answering "how do I…" / "where is…" questions (app_help tool). Loaded on demand
 * so it never adds to every prompt. Paths mirror app/src/routes/routes.ts and the settings sections in
 * app/src/pages/settings/index.tsx — keep them in sync when screens move. `{{app}}` becomes APP_URL.
 */
export const AppGuideTopics = {
    OVERVIEW: 'overview',
    CHATS: 'chats',
    VOICE: 'voice',
    BOTS: 'bots',
    SKILLS: 'skills',
    CONNECTIONS: 'connections',
    SECRETS: 'secrets',
    TASKS: 'tasks',
    AUTOMATIONS: 'automations',
    APPROVALS: 'approvals',
    ARTIFACTS: 'artifacts',
    KNOWLEDGE: 'knowledge',
    MEMORY: 'memory',
    CLOUD_COMPUTER: 'cloud_computer',
    PERSONAL_SETTINGS: 'personal_settings',
    ORGANISATION: 'organisation',
    USAGE: 'usage',
    APPS: 'apps',
} as const;
export type AppGuideTopic = (typeof AppGuideTopics)[keyof typeof AppGuideTopics];

export const APP_GUIDE: Record<AppGuideTopic, string> = {
    overview: `# Agent Space
AI co-workers ("bots") that chat, use the user's connected apps, run skills, work on long tasks and automations, and build artifacts.
Main pages (left sidebar on desktop; on phones the grid button in Chats opens [Tools]({{app}}/tools), a list of every page; Ctrl/Cmd+K opens quick search):
- [Chats]({{app}}/c) — conversations with bots and colleagues
- [Bots]({{app}}/bots) — create and configure bots
- [Skills]({{app}}/skills) — reusable step-by-step ways of doing a job
- [Connections]({{app}}/connections) — linked apps (Gmail, Calendar, Slack, Linear, HubSpot…)
- [Secrets]({{app}}/secrets) — API keys, tokens and website logins
- [Tasks]({{app}}/tasks) — long jobs bots are working on
- [Automations]({{app}}/automations) — jobs bots do on a schedule
- [Approvals]({{app}}/approvals) — actions waiting for the user's OK
- [Artifacts]({{app}}/artifacts) — apps, pages, dashboards and documents bots built
- [Settings]({{app}}/settings/profile) — personal and organisation settings`,

    chats: `# Chats — [open]({{app}}/c)
- Start a chat with a bot, or a group with bots and colleagues. In a group, mention a bot with @name; otherwise the lead bot answers.
- Messages can include files, images, screenshots, voice notes and links. Reply to a specific message to give context.
- Type / to use a skill directly. Bots show interactive replies (tables, charts, forms, buttons) when useful.
- Bot actions appear live in the chat; sensitive ones show an approval card.
- The details panel (tap the bot's name in the chat header) shows the bot's activity, library and voice settings.
- Temporary chats are not saved (if the organisation allows them).`,

    voice: `# Voice mode (talk with a bot in real time)
- Open any chat in [Chats]({{app}}/c) and tap the waveform button next to the message box (the microphone button is for one-off voice notes).
- The voice bar has Mute mic, Stop bot (interrupt), Keyboard (type without leaving voice mode) and Exit. On phones it can go full screen.
- The bot can use all the same tools as in text chat; approvals are asked out loud (payments and passwords always need a tap).
- Say "that's all" or "goodbye" to end it. It also ends after 2 minutes of silence or the organisation's maximum session length.
- Hands-free or push-to-talk, one voice for all bots, and speaking speed: [Settings → Replies & chat]({{app}}/settings/replies).
- Each bot's own voice: the bot's page in [Bots]({{app}}/bots), or the chat's details panel.
- Admins pick the voice model for the organisation in [Settings → AI models]({{app}}/settings/ai-models).`,

    bots: `# Bots — [open]({{app}}/bots)
- Create one with [New bot]({{app}}/bots/new): from a template, by describing it, or from scratch.
- A bot's page has tabs: Behaviour, Abilities, Skills, Connections, Approvals, Memory, Library, Computer and Sharing.
- Many settings can also be changed by asking the bot in chat ("rename yourself to Mia and make it purple"); the user confirms a summary first.
- Who can create bots, and which AI models they may use, is set by admins in [Settings → General]({{app}}/settings/organization) and [Settings → AI models]({{app}}/settings/ai-models).`,

    skills: `# Skills — [open]({{app}}/skills)
- Reusable, step-by-step ways of doing a job (e.g. "Blog post", "Invoice check"). Each has instructions, optional questions to ask first, and files.
- Give a skill to bots on the skill's page ("Give to bots") or on the bot's Skills tab. Bots use assigned skills automatically when a request matches, or when mentioned with /name in chat.
- [Create a skill]({{app}}/skills/new), or ask a bot: "Add a step to the onboarding skill…". Every change is saved as a version; deleted skills can be restored for 30 days.`,

    connections: `# Connections — [open]({{app}}/connections)
- Link the apps bots should use: Gmail, Google Calendar, Slack, Linear, HubSpot and many more. Bots act with the user's accounts without ever seeing passwords or tokens.
- Click a service to connect, add more accounts, pick the default account, or disconnect. Each service's page also shows its tools, and lets the user block tools bots shouldn't use.
- If a bot says a sign-in expired, reconnect it here. Custom tool servers (MCP) are also added here.
- Bots only see connections they're allowed to use (bot page → Connections tab).`,

    secrets: `# Secrets — [open]({{app}}/secrets)
- API keys, tokens and website logins given to Agent Space. Stored encrypted, never shown again, and never seen by bots.
- When a bot needs a key it shows a secure box in the chat — paste it there, never in a normal message.
- Saved website logins let a bot's cloud computer sign in to sites without the bot seeing the password.`,

    tasks: `# Tasks — [open]({{app}}/tasks)
- Long jobs (deep research, big documents, long computer work) run as tasks and keep going after the user leaves.
- The Tasks page shows everything bots are working on, waiting for, finished or failed. Open a task to see its steps in order.
- The user is notified when a task finishes or needs input.`,

    automations: `# Automations — [open]({{app}}/automations)
- Jobs bots do by themselves on a schedule ("Every Monday at 9, summarise last week's sales and email it to me").
- Create one by asking a bot in chat, or from the Automations page. Each has plain-language instructions, a schedule, and run history.
- Use Run now to try it. Pre-approvals let one automation repeat a specific action (e.g. emailing one address) without asking each time.
- Admins can limit automations in [Settings → Approvals & safety]({{app}}/settings/safety).`,

    approvals: `# Approvals — [open]({{app}}/approvals)
- When a bot wants to send, post, delete, pay or change something, it asks first with an approval card (in the chat and on this page).
- Approve, Edit, or Reject. Payments and passwords always need a tap.
- How often a bot asks: the bot's Approvals tab, and the default in [Settings → Replies & chat]({{app}}/settings/replies). Organisation rules in [Settings → Approvals & safety]({{app}}/settings/safety) always win.`,

    artifacts: `# Artifacts — [open]({{app}}/artifacts)
- Apps, pages, dashboards, documents and decks bots built — each with its own link.
- Ask a bot to build or change one ("make a sign-up page for the webinar"). Open an artifact to preview, share, or open it in a new tab.
- Sharing can be private, organisation-wide or a public link (if the organisation allows). Deleted artifacts can be restored from Recently deleted for 30 days.`,

    knowledge: `# Knowledge
- Company documents, web pages and notes bots can search and read.
- Organisation-wide: [Settings → Knowledge library]({{app}}/settings/knowledge) (bots with "Organisation knowledge" turned on use it).
- Per bot: the bot's Library tab in [Bots]({{app}}/bots).
- PDFs, Word, Excel, PowerPoint, text, Markdown, CSV and web pages are supported; scanned pages are read too.`,

    memory: `# Memory
- Bots remember lasting facts and preferences about the user (never secrets). Ask a bot to remember or forget something, or see and delete memories in [Settings → Memory & data]({{app}}/settings/memory).
- Admins can add company facts every bot knows in the same place.
- Memory can be turned off per bot (bot page → Memory tab) or for the user.`,

    cloud_computer: `# Cloud computer
- Bots with the cloud computer turned on get a private Linux computer with a browser, Python and Node.js. It keeps files and website sign-ins between tasks.
- Watch it live from the chat, take control when a site needs a sign-in or a "prove you're human" check, and see a step-by-step timeline.
- Turn it on and manage files and saved logins on the bot's Computer tab in [Bots]({{app}}/bots).`,

    personal_settings: `# Personal settings
- [Profile]({{app}}/settings/profile) — name, photo and details bots use about you.
- [Appearance]({{app}}/settings/appearance) — theme and colours.
- [Replies & chat]({{app}}/settings/replies) — reply length and tone, emoji, follow-up suggestions, send with Enter, voice settings, default approvals.
- [Notifications]({{app}}/settings/notifications) — which events notify you and where; quiet hours.
- [Memory & data]({{app}}/settings/memory) — what bots remember about you.
- [Security]({{app}}/settings/security) — password, email and two-step sign-in. These can only be changed here, never by chat.
- [Devices]({{app}}/settings/devices) — desktop and mobile apps, this device.`,

    organisation: `# Organisation settings (Owners and Admins)
- [General]({{app}}/settings/organization) — name, logo, brand colour, company instructions for every bot, default language, invites, who can create bots and skills, data retention, file size.
- [Members]({{app}}/settings/members) — invite people, invite link, roles, remove members.
- [AI models]({{app}}/settings/ai-models) — default model, allowed models, fallback, voice mode model.
- [Approvals & safety]({{app}}/settings/safety) — minimum approval level, actions that always need approval, bots consulting bots, approval timeout, what happens at a usage limit.
- [Knowledge library]({{app}}/settings/knowledge) — company documents for all bots.
- [Activity history]({{app}}/settings/activity) — audit log of what people and bots did.
- [Leave or delete]({{app}}/settings/danger) — transfer ownership, leave or delete the organisation.`,

    usage: `# Usage — [open]({{app}}/settings/usage)
- Usage overview per month: cost by member, by bot and by model (voice mode included).
- Admins set monthly usage limits per organisation, member or bot. Alerts arrive at 80% and 100%; what happens at the limit is set in [Approvals & safety]({{app}}/settings/safety).`,

    apps: `# Desktop and mobile apps
- Web, Windows/Mac desktop, iPhone and Android all share the same account and chats.
- Desktop adds a global quick-ask shortcut, notifications, launch at start-up, drag-and-drop files and "look at my screen".
- Mobile adds push notifications with approvals on the lock screen, Face ID / fingerprint, camera and document scanner, and sharing to a bot.
- Downloads and connected devices: [Settings → Devices]({{app}}/settings/devices).`,
};

/** The guide text for one topic (or the overview), with links pointing at this deployment. */
export const appGuide = (topic: string | undefined, appUrl: string) => {
    const key = (Object.values(AppGuideTopics) as string[]).includes(topic ?? '') ? (topic as AppGuideTopic) : AppGuideTopics.OVERVIEW;
    return APP_GUIDE[key].replaceAll('{{app}}', appUrl.replace(/\/$/, ''));
};
