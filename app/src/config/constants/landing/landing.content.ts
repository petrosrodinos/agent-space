import {
  BarChart3,
  Brain,
  Briefcase,
  CalendarClock,
  Eye,
  FileText,
  Globe,
  Hand,
  History,
  Megaphone,
  Monitor,
  Plug,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Static copy for the public landing page (PRODUCT.md pitch, pillars and audiences). */

export const LandingSectionIds = {
  FEATURES: "features",
  HOW_IT_WORKS: "how-it-works",
  TEAMS: "teams",
  CONTROL: "control",
} as const;
export type LandingSectionId = (typeof LandingSectionIds)[keyof typeof LandingSectionIds];

export const LandingNavLinks: { id: LandingSectionId; label: string }[] = [
  { id: LandingSectionIds.FEATURES, label: "Features" },
  { id: LandingSectionIds.HOW_IT_WORKS, label: "How it works" },
  { id: LandingSectionIds.TEAMS, label: "For teams" },
  { id: LandingSectionIds.CONTROL, label: "Control" },
];

/** Bot "characters" used across the page — DESIGN.MD bot colours, lucide icons instead of emoji. */
export const LandingBots = {
  SALES: { name: "Sales Sam", color: "#FF7A3D", icon: Briefcase },
  MARKETING: { name: "Mia", color: "#FF5FAE", icon: Megaphone },
  RESEARCH: { name: "Researcher", color: "#38B6FF", icon: Search },
  OPS: { name: "Ops Otto", color: "#1FC98E", icon: Settings2 },
  ANALYST: { name: "Ada", color: "#FFC83D", icon: BarChart3 },
} as const satisfies Record<string, { name: string; color: string; icon: LucideIcon }>;
export type LandingBot = (typeof LandingBots)[keyof typeof LandingBots];

export const LandingIntegrations = ["Gmail", "Outlook", "Slack", "HubSpot", "Salesforce", "Notion", "Google Drive", "Google Calendar", "Linear", "Stripe", "Airtable", "Shopify", "Jira", "Zendesk"];

export const LandingSteps: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Sparkles, title: "Create a bot", text: "Give it a name, a colour and a job. Pick a ready-made skill or describe how you like things done." },
  { icon: Plug, title: "Connect your tools", text: "Link Gmail, your CRM, calendar and more in a couple of clicks. Keep each connection private or share it with your team." },
  { icon: Rocket, title: "Ask, and it's done", text: "Chat like you would with a colleague. Your bot does the work, shows every step and asks before anything important." },
];

export const LandingTeams = {
  SALES: "SALES",
  MARKETING: "MARKETING",
  OPERATIONS: "OPERATIONS",
  FOUNDERS: "FOUNDERS",
} as const;
export type LandingTeam = (typeof LandingTeams)[keyof typeof LandingTeams];

export const LandingTeamUseCases: { id: LandingTeam; label: string; bot: LandingBot; headline: string; prompts: { ask: string; done: string }[] }[] = [
  {
    id: LandingTeams.SALES,
    label: "Sales",
    bot: LandingBots.SALES,
    headline: "Spend your time selling, not updating the CRM.",
    prompts: [
      { ask: "Research Acme before my 2pm call", done: "Prepped a one-page brief with recent news and open deals" },
      { ask: "Draft follow-ups for today's demos", done: "4 drafts ready in Gmail – Sales, waiting for your OK" },
      { ask: "Log my calls and move the stages", done: "Updated 6 deals in HubSpot" },
    ],
  },
  {
    id: LandingTeams.MARKETING,
    label: "Marketing",
    bot: LandingBots.MARKETING,
    headline: "From idea to published campaign in one chat.",
    prompts: [
      { ask: "Write three launch posts for Friday", done: "Drafted 3 posts in our brand voice" },
      { ask: "What are competitors announcing this month?", done: "Compared 8 competitors. Here's the table" },
      { ask: "Build a landing page for the webinar", done: "Published the page with its own link" },
    ],
  },
  {
    id: LandingTeams.OPERATIONS,
    label: "Operations",
    bot: LandingBots.OPS,
    headline: "Repetitive work, handled across every tool.",
    prompts: [
      { ask: "Every Monday, send me the pipeline report", done: "Automation set: Mondays at 9:00" },
      { ask: "Chase the unpaid invoices from last month", done: "Sent 5 reminders after your approval" },
      { ask: "Onboard the two new hires", done: "Accounts, docs and welcome emails sorted" },
    ],
  },
  {
    id: LandingTeams.FOUNDERS,
    label: "Founders",
    bot: LandingBots.ANALYST,
    headline: "One assistant across inbox, calendar and numbers.",
    prompts: [
      { ask: "What needs my attention today?", done: "3 emails, 1 approval and a board deck review" },
      { ask: "Build a revenue dashboard", done: "Live dashboard published from Stripe" },
      { ask: "Find time with the investors next week", done: "Proposed 3 slots that work for everyone" },
    ],
  },
];

export const LandingControlPoints: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShieldCheck, title: "Approvals before consequences", text: "Emails, payments and anything hard to undo wait for a clear, previewed yes." },
  { icon: Eye, title: "Watch it work, live", text: "See every step, every tool and which account it used, as it happens." },
  { icon: Hand, title: "Take over any time", text: "Stop, correct or jump into the bot's cloud computer yourself." },
  { icon: History, title: "Nothing is lost", text: "Full activity history, versioned skills and artifacts, and 30-day restore." },
];

export const LandingMemoryChips: { icon: LucideIcon; text: string }[] = [
  { icon: Brain, text: "Prefers short, friendly emails" },
  { icon: FileText, text: "Pricing sheet v4 (company knowledge)" },
  { icon: Users, text: "Anna is the decision-maker at Acme" },
  { icon: CalendarClock, text: "No meetings before 10:00" },
];

export const LandingPlatforms: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Globe, title: "Web", text: "Open it in any browser" },
  { icon: Monitor, title: "Desktop", text: "Windows and Mac" },
  { icon: Smartphone, title: "Mobile", text: "iPhone and Android" },
];
