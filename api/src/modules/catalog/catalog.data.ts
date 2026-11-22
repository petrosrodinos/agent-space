import { ApprovalLevel, ModelCostTier } from 'generated/prisma';

export interface ModelSeed {
    openrouter_id: string;
    name: string;
    provider: string;
    labels: string[];
    cost_tier: ModelCostTier;
    input: number;
    output: number;
    context: number;
    vision: boolean;
    recommended?: boolean;
    fallback?: string;
}

/**
 * Curated OpenRouter catalogue (§6.4). Labels are plain-language: fast, smart, writing, coding, vision.
 * "Recommended" is a balanced all-round model (Claude Sonnet at launch) and can be changed here without users doing anything.
 */
export const MODEL_SEEDS: ModelSeed[] = [
    { openrouter_id: 'anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', provider: 'Anthropic', labels: ['smart', 'writing', 'coding', 'vision'], cost_tier: 'MEDIUM', input: 2, output: 10, context: 1_000_000, vision: true, recommended: true, fallback: 'openai/gpt-6.2-sol' },
    { openrouter_id: 'anthropic/claude-haiku-5.5', name: 'Claude Haiku 5.5', provider: 'Anthropic', labels: ['fast', 'vision'], cost_tier: 'LOW', input: 0.1, output: 0.5, context: 1_000_000, vision: true, fallback: 'openai/gpt-6.1-terra' },
    { openrouter_id: 'anthropic/claude-opus-5.5', name: 'Claude Opus 5.5', provider: 'Anthropic', labels: ['smart', 'writing', 'coding', 'vision'], cost_tier: 'HIGH', input: 4, output: 20, context: 1_000_000, vision: true, fallback: 'anthropic/claude-sonnet-5.5' },
    { openrouter_id: 'anthropic/claude-fable-5.2', name: 'Claude Fable 5.2', provider: 'Anthropic', labels: ['smart', 'writing', 'coding', 'vision'], cost_tier: 'HIGH', input: 8, output: 40, context: 1_000_000, vision: true, fallback: 'anthropic/claude-opus-5.5' },
    { openrouter_id: 'openai/gpt-6.2-sol', name: 'GPT-6.2 Sol', provider: 'OpenAI', labels: ['smart', 'coding', 'vision'], cost_tier: 'MEDIUM', input: 2, output: 10, context: 1_050_000, vision: true, fallback: 'anthropic/claude-sonnet-5.5' },
    { openrouter_id: 'openai/gpt-6.1-terra', name: 'GPT-6.1 Terra', provider: 'OpenAI', labels: ['fast', 'vision'], cost_tier: 'MEDIUM', input: 1, output: 5, context: 1_050_000, vision: true, fallback: 'anthropic/claude-haiku-5.5' },
    { openrouter_id: 'openai/gpt-6.2-astra', name: 'GPT-6.2 Astra', provider: 'OpenAI', labels: ['smart', 'coding', 'writing', 'vision'], cost_tier: 'HIGH', input: 8, output: 40, context: 1_050_000, vision: true, fallback: 'openai/gpt-6.2-sol' },
    { openrouter_id: 'google/gemini-4-carbon', name: 'Gemini 4 Carbon', provider: 'Google', labels: ['smart', 'vision'], cost_tier: 'MEDIUM', input: 2, output: 10, context: 1_048_576, vision: true, fallback: 'anthropic/claude-sonnet-5.5' },
    { openrouter_id: 'google/gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', provider: 'Google', labels: ['fast', 'vision'], cost_tier: 'MEDIUM', input: 1.5, output: 7.5, context: 1_048_576, vision: true, fallback: 'anthropic/claude-haiku-5.5' },
    { openrouter_id: 'x-ai/grok-4.7', name: 'Grok 4.7', provider: 'xAI', labels: ['smart', 'vision'], cost_tier: 'MEDIUM', input: 2, output: 6, context: 500_000, vision: true, fallback: 'openai/gpt-6.2-sol' },
    { openrouter_id: 'mistralai/mistral-large-4-0', name: 'Mistral Large 4', provider: 'Mistral', labels: ['writing', 'vision'], cost_tier: 'LOW', input: 0.7, output: 2.1, context: 1_048_576, vision: true, fallback: 'anthropic/claude-haiku-5.5' },
    { openrouter_id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', provider: 'DeepSeek', labels: ['fast', 'coding'], cost_tier: 'LOW', input: 0.3, output: 1.2, context: 1_048_576, vision: true, fallback: 'anthropic/claude-haiku-5.5' },
    { openrouter_id: 'qwen/qwen4-max', name: 'Qwen 4 Max', provider: 'Qwen', labels: ['smart', 'coding'], cost_tier: 'MEDIUM', input: 1.43, output: 4.28, context: 1_000_000, vision: true, fallback: 'anthropic/claude-sonnet-5.5' },
    { openrouter_id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'Meta', labels: ['fast', 'vision'], cost_tier: 'LOW', input: 0.35, output: 1, context: 524_288, vision: true, fallback: 'anthropic/claude-haiku-5.5' },
];

/** Model used by the web_search built-in tool (searches the live web and returns cited answers). */
export const WEB_SEARCH_MODEL = 'perplexity/sonar';
/** Small model used for internal tasks (titles, drafting a bot from a description). */
export const UTILITY_MODEL = 'anthropic/claude-haiku-5.5';

export interface TemplateSeed {
    key: string;
    name: string;
    /** Seed for the generated portrait shown on the template card and given to bots made from it. */
    avatar_seed: string;
    color: string;
    description: string;
    instructions: string;
    welcome_message: string;
    conversation_starters: string[];
    suggested_services: string[];
    model: string;
    voice: string;
    approval_level: ApprovalLevel;
    cloud_computer: boolean;
    starter_skills: string[];
}

/** §6.1 — six templates at launch. Colours are DESIGN.MD bot colours. */
export const TEMPLATE_SEEDS: TemplateSeed[] = [
    {
        key: 'personal-assistant', name: 'Personal Assistant', avatar_seed: 'personalassistant', color: '#6B4EFF',
        description: 'Keeps your inbox, calendar and to-dos under control.',
        instructions: 'You are a friendly, efficient personal assistant. Help the user manage email, calendar, reminders and everyday tasks. Be proactive: suggest next steps, flag anything urgent, and keep answers short unless asked for detail. Always confirm before sending anything on the user\'s behalf.',
        welcome_message: 'Hi! I can help with your inbox, calendar and to-dos. What\'s on your plate today?',
        conversation_starters: ["What's on my plate today?", 'Summarise my unread emails', 'Find a free hour this week', 'Remind me to call Anna tomorrow'],
        suggested_services: ['gmail', 'googlecalendar', 'googledrive'], model: 'anthropic/claude-sonnet-5.5', voice: 'marin', approval_level: 'IMPORTANT_ACTIONS', cloud_computer: false,
        starter_skills: ['meeting-prep', 'email-follow-up'],
    },
    {
        key: 'sales', name: 'Sales', avatar_seed: 'salesbot', color: '#FF7A3D',
        description: 'Researches leads, drafts outreach and keeps the CRM up to date.',
        instructions: 'You are a sharp, upbeat sales assistant. Research companies and contacts, prepare call briefs, draft personalised outreach and follow-ups, and keep the CRM accurate after every interaction. Never promise discounts or terms that were not approved. Ask before sending emails or changing deal stages.',
        welcome_message: 'Ready to sell! Tell me about a lead, a call to prep for, or a deal to update.',
        conversation_starters: ['Prep me for my next call', 'Research acme.com', 'Draft a follow-up to yesterday\'s demo', 'Which deals need attention this week?'],
        suggested_services: ['gmail', 'hubspot', 'googlecalendar', 'linkedin'], model: 'anthropic/claude-sonnet-5.5', voice: 'cedar', approval_level: 'IMPORTANT_ACTIONS', cloud_computer: false,
        starter_skills: ['meeting-prep', 'email-follow-up', 'competitor-research'],
    },
    {
        key: 'marketing', name: 'Marketing', avatar_seed: 'marketingbot', color: '#FF5FAE',
        description: 'Drafts content, watches competitors and reports on campaigns.',
        instructions: 'You are a creative, data-aware marketing assistant. Draft on-brand content (posts, emails, landing page copy), research competitors, and summarise campaign results with clear takeaways. Follow the company tone of voice. Ask for approval before publishing or posting anything publicly.',
        welcome_message: 'Let\'s make something great. What are we launching, writing or measuring?',
        conversation_starters: ['Draft 3 LinkedIn posts about our launch', 'What are competitors announcing?', 'Write a newsletter intro', 'Summarise last month\'s campaign results'],
        suggested_services: ['gmail', 'slack', 'notion', 'googledrive'], model: 'anthropic/claude-sonnet-5.5', voice: 'coral', approval_level: 'IMPORTANT_ACTIONS', cloud_computer: false,
        starter_skills: ['blog-post', 'competitor-research', 'weekly-report'],
    },
    {
        key: 'support', name: 'Support', avatar_seed: 'supportbot', color: '#FFC83D',
        description: 'Answers customer questions clearly and keeps tickets moving.',
        instructions: 'You are a calm, empathetic customer support assistant. Answer clearly and accurately using the knowledge you have, never invent policies, and escalate to a human when unsure. Keep a friendly, professional tone. Ask before replying to customers directly.',
        welcome_message: 'Hi! Paste a customer question or ticket and I\'ll help you answer it.',
        conversation_starters: ['Draft a reply to this ticket', 'Summarise open tickets', 'What is our refund policy?', 'Turn this into a help article'],
        suggested_services: ['gmail', 'slack', 'zendesk', 'intercom'], model: 'anthropic/claude-haiku-5.5', voice: 'sage', approval_level: 'ALWAYS_ASK', cloud_computer: false,
        starter_skills: ['email-follow-up'],
    },
    {
        key: 'researcher', name: 'Researcher', avatar_seed: 'researcher', color: '#38B6FF',
        description: 'Digs deep on the web and delivers well-sourced reports.',
        instructions: 'You are a meticulous research assistant. Search the web, read sources carefully, compare evidence and deliver structured findings with sources for every claim. Be explicit about uncertainty. Prefer tables for comparisons and finish with a short summary of key takeaways.',
        welcome_message: 'What should I research? I\'ll come back with sources.',
        conversation_starters: ['Compare the top 5 CRMs for a small team', 'Research our top competitors', 'What changed in EU AI rules this year?', 'Find 20 dentists in Athens with websites'],
        suggested_services: ['googledrive', 'notion'], model: 'anthropic/claude-sonnet-5.5', voice: 'ash', approval_level: 'IMPORTANT_ACTIONS', cloud_computer: true,
        starter_skills: ['competitor-research', 'weekly-report'],
    },
    {
        key: 'executive-assistant', name: 'Executive Assistant', avatar_seed: 'execassistant', color: '#3A6BFF',
        description: 'Briefs, schedules and follows up like a seasoned EA.',
        instructions: 'You are a discreet, highly organised executive assistant. Prepare briefings before meetings, manage scheduling across calendars, draft polished correspondence and track follow-ups. Be concise and formal. Always confirm before sending emails or accepting invitations.',
        welcome_message: 'Good to meet you. Shall I start with today\'s briefing?',
        conversation_starters: ["Brief me on today's meetings", 'Draft a polite decline', 'What follow-ups am I missing?', 'Plan my week'],
        suggested_services: ['gmail', 'googlecalendar', 'outlook', 'slack'], model: 'anthropic/claude-sonnet-5.5', voice: 'ballad', approval_level: 'ALWAYS_ASK', cloud_computer: false,
        starter_skills: ['meeting-prep', 'email-follow-up', 'weekly-report'],
    },
];

export interface StarterSkillSeed {
    key: string;
    name: string;
    emoji: string;
    description: string;
    instructions: string;
    questions: { key: string; question: string; required: boolean }[];
    required_tools: { service_key: string }[];
    result: string;
}

/** §6.7 starter library. */
export const STARTER_SKILLS: StarterSkillSeed[] = [
    {
        key: 'meeting-prep', name: 'Meeting prep', emoji: '📋',
        description: 'Use before a meeting or call to prepare a one-page brief on the people, company and agenda.',
        instructions: '1. Identify the meeting (from the calendar if connected, otherwise ask).\n2. Research each external attendee and their company (web search, CRM if connected).\n3. Pull recent emails or notes with them.\n4. Produce a brief: purpose, attendees (role, background), company snapshot, recent history, 3 talking points, open questions, and risks.\n5. Keep it to one screen; put sources at the end.',
        questions: [{ key: 'meeting', question: 'Which meeting should I prepare for?', required: true }],
        required_tools: [{ service_key: 'googlecalendar' }], result: 'A one-page meeting brief in the chat',
    },
    {
        key: 'email-follow-up', name: 'Email follow-up', emoji: '✉️',
        description: 'Use after a call or meeting to draft a clear follow-up email with next steps.',
        instructions: '1. Collect what was discussed (ask the user, or read notes/transcript provided).\n2. Draft a short follow-up: thanks, a recap in 3 bullets, agreed next steps with owners and dates, and a clear call to action.\n3. Match the user\'s tone preferences.\n4. Show the draft and ask for approval before sending.',
        questions: [{ key: 'recipient', question: 'Who is the follow-up for?', required: true }, { key: 'notes', question: 'What were the key points or next steps?', required: false }],
        required_tools: [{ service_key: 'gmail' }], result: 'A ready-to-send email draft',
    },
    {
        key: 'competitor-research', name: 'Competitor research', emoji: '🕵️',
        description: 'Use to research one or more competitors and compare them on product, pricing, positioning and recent news.',
        instructions: '1. Confirm the competitors and what to compare.\n2. Search the web for each: website, pricing page, recent announcements, reviews.\n3. Build a comparison table (product, pricing, target customer, strengths, weaknesses, recent news).\n4. Finish with 3 takeaways and suggested responses for us.\n5. Cite sources for every claim.',
        questions: [{ key: 'competitors', question: 'Which competitors should I research?', required: true }],
        required_tools: [], result: 'A comparison table with takeaways and sources',
    },
    {
        key: 'weekly-report', name: 'Weekly report', emoji: '📊',
        description: 'Use to build a weekly summary report of progress, numbers and next week\'s priorities.',
        instructions: '1. Gather this week\'s activity from the sources the user names (CRM, email, docs, or pasted notes).\n2. Compare with last week where data exists.\n3. Produce: headline summary, key numbers (as a table or chart), wins, issues, and next week\'s priorities.\n4. Offer to post it to the team channel or turn it into a dashboard artifact.',
        questions: [{ key: 'scope', question: 'What should the report cover (team, metrics, sources)?', required: true }],
        required_tools: [], result: 'A weekly report with key numbers and priorities',
    },
    {
        key: 'blog-post', name: 'Blog post', emoji: '✍️',
        description: 'Use to research and write a blog post in the company\'s tone of voice.',
        instructions: '1. Confirm topic, audience, length and call to action.\n2. Research the topic and collect 3–5 credible sources.\n3. Write an outline and show it.\n4. Write the post in the company tone of voice: strong headline, short intro, scannable sections, conclusion with CTA.\n5. Suggest a meta description and 3 social posts.',
        questions: [{ key: 'topic', question: 'What is the topic and who is it for?', required: true }],
        required_tools: [], result: 'A full blog post draft with SEO meta and social posts',
    },
    {
        key: 'client-onboarding', name: 'Client onboarding', emoji: '🤝',
        description: 'Use when a new client signs, to run the standard onboarding steps.',
        instructions: '1. Collect the client name, main contact and start date.\n2. Create or update the client in the CRM.\n3. Create a shared folder for the client.\n4. Draft the welcome email from the template and ask for approval.\n5. Propose kick-off call times and book once confirmed.\n6. Summarise everything done with links.',
        questions: [
            { key: 'client', question: 'What is the client\'s name?', required: true },
            { key: 'contact', question: 'Who is the main contact (name and email)?', required: true },
            { key: 'start_date', question: 'What is the start date?', required: true },
        ],
        required_tools: [{ service_key: 'hubspot' }, { service_key: 'gmail' }, { service_key: 'googledrive' }], result: 'CRM record, shared folder, welcome email and kick-off booked',
    },
];

/** Voices available for voice mode (OpenAI Realtime). */
export const VOICES = ['alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'marin', 'sage', 'shimmer', 'verse'];
