# Agent Space

**Your team's AI co-workers — connected to your tools, working on their own computers, right inside your chats.**

Agent Space is an AI co-worker platform for companies. People create their own AI **bots**, connect them to the tools they already use, and chat with them — alone or in groups with colleagues and other bots. Bots don't just answer; they do the work: send the email, update the CRM, research the web on their own cloud computer, build a dashboard, publish a page.

Available on web, desktop (Windows, Mac) and mobile (Android).

## Features

- **Bots** — custom assistants with a name, emoji, colour, instructions, AI model, tools, skills and memory.
- **Conversations** — direct chats, shared bot chats and groups with several people and bots.
- **Connections** — link accounts (Gmail, CRMs and more) through a connection partner; private or shared, several per service.
- **Cloud computer** — each bot can have a private computer in the cloud to browse sites, work with files and run programs. Watch it live, take over, pause it, and replay what it did.
- **Voice mode** — talk to a bot, with optional camera or screen sharing so it can see what you show it.
- **Skills** — reusable step-by-step procedures, given to any bot and mentioned with `/`.
- **Memory and knowledge** — bots remember context and can use your company knowledge.
- **Artifacts** — apps, pages, dashboards and documents a bot builds, with links, sharing and versions.
- **Interactive replies** — forms, charts and mini-apps rendered right inside the chat.
- **Tasks and automations** — long-running work, plus work that runs on a schedule or trigger.
- **Approvals and activity** — anything risky waits for a previewed approval; every action is logged.
- **Organisations** — workspaces with Owner, Admin and Member roles, usage tracking and notifications.
- **Messaging channels** and **device tools** on desktop and mobile (notifications, files, camera, and more).
- English and Greek interface, light and dark mode.

## Tech stack

| Part | Folder | Built with |
|---|---|---|
| Web app | `app/` | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui (Radix), TanStack Query, React Router, Socket.IO client |
| Mobile app | `app/` | The same app wrapped with Capacitor 8 (Android) |
| Desktop app | `desktop/` | Electron, loading the same app |
| API | `api/` | NestJS, TypeScript, Prisma with PostgreSQL, Redis, BullMQ job queues, Socket.IO for realtime |
| AI | `api/` | Vercel AI SDK with OpenRouter and OpenAI models |
| Cloud computers | `api/` | Daytona sandboxes |
| Storage and secrets | `api/` | Google Cloud Storage (signed URLs) and Secret Manager |
| Email and billing | `api/` | Resend and Stripe |

## Getting started

You need Node 22+ and the environment file for the API (`api/.env.staging`).

```bash
# API  (http://localhost:3100/api)
cd api
npm install
npx dotenv run -f .env.staging -- npx prisma migrate deploy
npm run build
npx dotenv run -f .env.staging -- node dist/src/main.js

# App  (http://localhost:5180)
cd app
npm install
npm run dev
```

More detail, environment variables and notes on cloud computers, voice and push are in [docs/RUNNING.md](docs/RUNNING.md).

## Documentation

- [PRODUCT.md](PRODUCT.md) — what the product is, who it's for and how it should feel
- [docs/Product_Specification.md](docs/Product_Specification.md) — full requirements
- [DESIGN.MD](DESIGN.MD) — visual design system
- [docs/RUNNING.md](docs/RUNNING.md) — running locally
