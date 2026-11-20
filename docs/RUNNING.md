# Running Agent Space locally

## Prerequisites
- Node 22+
- `api/.env.staging` (staging Postgres, Redis, OpenRouter, Composio, Resend, Daytona, OpenAI keys)

Local ports: **API `http://localhost:3100/api`**, **app `http://localhost:5180`** (3000/3001/5173 are used by other local projects).

## API (`api/`)
```bash
npm install
npx dotenv run -f .env.staging -- npx prisma migrate deploy   # apply migrations
npm run build
npx dotenv run -f .env.staging -- node dist/src/main.js        # PROCESS_ROLE=all: HTTP + realtime + queue workers
```
- Swagger: `http://localhost:3100/api/docs`
- Bull Board: `http://localhost:3100/admin/queues` (basic auth `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD`)
- Production runs two process roles from the same build: `PROCESS_ROLE=api` (HTTP, Socket.IO) and `PROCESS_ROLE=worker` (BullMQ processors).

The catalogue (AI models, the 6 bot templates, starter skills, app version policy) is upserted automatically at start-up.

## App (`app/`)
```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # static files in dist/ (no SSR, API address from VITE_API_URL)
```

## Environment notes
| Variable | Purpose |
|---|---|
| `STORAGE_DRIVER` | `gcs` (production: V4 signed URLs) or `local` (dev: files on the API disk, served through short-lived signed API links) |
| `SECRET_STORE` | `gcp` (Google Cloud Secret Manager, one secret `cred-<id>` per credential) or `local-encrypted` (dev only: AES-256-GCM, needs `SECRETS_ENCRYPTION_KEY`). Both are refused in production except `gcp`. |
| `PROCESS_ROLE` | `api`, `worker` or `all` |
| `JWT_ACCESS_EXPIRATION` | Access token lifetime (default 15m); refresh tokens rotate and live in an httpOnly cookie on web |

**Current staging status:** the staging service account can read/write objects in `ld-agent-space`, sign V4 URLs and manage Secret Manager secrets, so `.env.staging` uses `STORAGE_DRIVER=gcs` and `SECRET_STORE=gcp`. Direct browser uploads also need a CORS rule on the bucket allowing the app origin (`PUT`/`POST`, headers `Content-Type`, `x-goog-resumable`). Data written earlier by the dev fallbacks can be moved with `npx dotenv run -f .env.staging -- node scripts/migrate-dev-stores.cjs` (add `--dry-run` first).

## Cloud computer, voice, push, knowledge (§9, §7.6, §12, §6.2)

- **Cloud computer (Daytona):** one sandbox per bot (`DAYTONA_API_KEY`; optional `DAYTONA_API_URL`, `DAYTONA_TARGET`). Auto-stop follows the organisation idle setting. Live view is proxied through the API at `/api/computer-view/<token>/…` (Daytona shows a browser warning page that an iframe can't skip); watch-only viewers have keyboard/mouse input dropped server-side. Computer minutes are billed at `COMPUTER_COST_PER_MINUTE` (default 0.0015 USD).
  - **Network:** the current Daytona account tier only lets sandboxes reach "essential" hosts (PyPI, npm, GitHub…); other websites are reset. Browsing arbitrary sites needs a Daytona tier with full internet access — no code change.
- **Voice mode (OpenAI Realtime):** `OPENAI_API_KEY`; optional `VOICE_MODEL` (default `gpt-realtime`; the key also has `gpt-realtime-2.1`), `VOICE_TRANSCRIBE_MODEL`, `VOICE_SAMPLE_MODEL`. The browser's SDP offer goes to `POST /api/voice/sessions`; the API answers with the real key server-side and attaches a sideband WebSocket that runs every tool call. The browser needs microphone permission.
- **Web push:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (generate with `npx web-push generate-vapid-keys`). Users turn it on per device in Settings → Notifications.
- **Knowledge and skill files:** PDF, Word, Excel/ODS, PowerPoint, text, Markdown, CSV, HTML and web pages are read as text. Knowledge items are indexed by the `knowledge` queue (worker): images and scanned PDF pages go through `gpt-4.1-mini` vision (OCR), then passages are embedded with `text-embedding-3-small` into `knowledge_chunks` and searched by exact cosine similarity (`KnowledgeVectorStore`). Needs `OPENAI_API_KEY`. Items left Processing are re-queued when the worker starts. Bots use `search_knowledge` / `read_knowledge` / `read_file`.

## Artifacts (§7.5)

- **Source:** each version stores one self-contained HTML document written by the bot (`ArtifactVersion.source = { html }`). Bots may load React/Tailwind/chart libraries only from the allowed CDNs; the build guide lives in `api/src/modules/agent/tools/artifact-tools.service.ts` (`create_artifact`, `update_artifact` with full HTML or find/replace edits, `read_artifact`, `list_artifacts`, `get_artifact_records`).
- **Isolated host:** artifacts are served by the API at `<API_URL>/a/<org-slug>/<artifact-slug>` (`artifact-view.controller.ts`). Every response sends a CSP with `sandbox` (no `allow-same-origin`), so the page always runs in an opaque origin and can't read API cookies, the app or other artifacts. The app embeds it in a sandboxed iframe too. `frame-ancestors` is the app origin(s) for members, or `*` for public links with embedding allowed. `X-Robots-Tag: noindex` unless "Allow search engines" is on.
- **Access:** members open it with a 15-minute signed view token (`POST /api/artifacts/:id/view-token`, re-checked at render time). Public links need sharing level "Public link" + link enabled + not expired; passwords are bcrypt-hashed and unlock with a signed `k` token (invalidated when the password changes).
- **Runtime:** the page gets `window.agentspace.save(collection, data)`, `.list(collection)` and `.ai(prompt)`, calling `<API_URL>/ax/:id/{records,ai}` with a per-page session token (12 h) as `text/plain` simple requests (no CORS preflight). `private_*` collections are only readable in the app's Data tab (owners/editors). Limits: 20 KB per entry, 10 000 entries per artifact, 30 saves/min/IP, AI 10/min/IP and 200/day per artifact (public AI usage is billed to the owner and can be switched off).
- **Reports:** public pages show a small "Report" link (`/ax/:id/report`), stored as `ArtifactReport`.
- **Not yet:** live connected-account data inside artifacts, visitor file uploads, editing text directly in the preview, real-time co-editing presence, PDF/PPTX/DOCX export (HTML download only), and the 30-day purge job for deleted artifacts.

## Desktop and mobile apps (§14.2)

The same `app/` build is packaged with **Electron** (Windows, Mac) in `desktop/` and with **Capacitor** (Android) in `app/android`. The platform layer (`app/src/platform/`) picks the implementation at start-up: `desktop.ts` when the Electron preload bridge (`window.agentspaceDesktop`) is present, `native.ts` inside Capacitor, `web.ts` otherwise. The apps keep the refresh token in the OS keychain (Electron `safeStorage`; Android Keystore via `@aparajita/capacitor-secure-storage`) and send `X-Client-Platform: desktop|android`, so the API returns the token in the body instead of the cookie. The API allows the app-shell origins `app://agentspace` and `https://localhost` (`api/src/shared/config/cors`).

Build the web bundle for the API the apps should talk to first: `VITE_API_URL=https://api.example.com/api npm run build` in `app/`.

**Desktop (`desktop/`)**

| Command | What it does |
|---|---|
| `npm install` | Installs Electron 45 / electron-builder 26 / electron-updater 6 (pinned) |
| `npm run dev` | Opens the app against the Vite dev server (`http://localhost:5180`, or `AGENTSPACE_DEV_URL`) |
| `npm start` | Opens the bundled `../app/dist` through the `app://agentspace` protocol |
| `npm run package:dir` | Unpacked app in `release/win-unpacked` (quick local test) |
| `npm run package:win` / `package:mac` | Builds `app/` and makes the NSIS installer / DMG + ZIP (no update feed) |
| `npm run release -- patch` | Versioned release uploaded to GCS, with automatic updates (see below) |

- **Security:** `contextIsolation`, `sandbox`, no `nodeIntegration`. The page has a strict CSP and can't navigate away from the app; outside links and sign-in pages open in the system browser. Permissions (microphone, notifications, clipboard) are granted to the app origin only, and every IPC call checks the sender.
- **What it adds:**
  - deep links `agentspace://<path>` (single instance; sign-in and connection flows return through them)
  - native notifications
  - open at start-up
  - a global quick-ask shortcut (default `CommandOrControl+Shift+Space`, set in Settings → Devices)
  - native file pick and download
- **Signing:**
  - Windows: `CSC_LINK`, `CSC_KEY_PASSWORD`.
  - Mac: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, and set `mac.notarize: true` in `electron-builder.yml`.
- **Releases (Google Cloud Storage):** `npm run release -- [patch|minor|major|x.y.z] [--win|--mac]` bumps `desktop/package.json`, builds `app/` against `$PUBLIC_API_URL/api` and the installer with the update feed baked in, and uploads to the `desktop-releases/` folder of the API bucket (`GCS_BUCKET_NAME`):
  - `<version>/…` immutable installer, zip (Mac) and blockmaps per version; existing versions are never overwritten (`--force` to override)
  - `latest.yml` / `latest-mac.yml` the live update feeds, switched over last
  - `releases.json` index of all versions; `download/AgentSpace-Setup.exe`, `download/AgentSpace.dmg` stable "latest" download links
  - Config: read from `api/.env.staging` (`GCS_PROJECT_ID`, `GCS_BUCKET_NAME`, `GCS_CREDENTIALS_JSON_BASE64`, `PUBLIC_API_URL`); real environment variables win.
  - Serving: the bucket is private (uniform access, user files), so the API serves the folder publicly at `GET /api/desktop/releases/<path>` (`api/src/modules/desktop-releases`): `.yml`/`.json` are returned directly (no-cache), everything else redirects to a 15-minute signed GCS URL. The app's feed is `$PUBLIC_API_URL/api/desktop/releases`, and the latest Windows installer is `…/download/AgentSpace-Setup.exe`.
  - `--dry-run` prints what would happen; `--build-only` builds without uploading. Mac builds need a Mac; run the script once per OS for the same version.
  - Rolling back: release a higher version (the updater never downgrades).
- **Automatic updates:** the packaged app checks the feed 10 s after launch, every 4 hours and when the computer wakes, downloads in the background, then shows "Restart to update" (toast and Settings → Devices). If ignored, it installs on the next quit. Builds made with `package:*` have no feed and report updates as not set up.
- **Windows note:** real-time antivirus can lock `default_app.asar` while electron-builder extracts Electron. `package:dir` therefore uses the already-installed `node_modules/electron/dist` (`electronDist`).

**Mobile (`app/`, Capacitor 8)**

| Command | What it does |
|---|---|
| `npm run cap:sync` | Builds the web bundle and copies it plus the plugins into `android/` |
| `npm run cap:android` | Opens Android Studio |
| `CAP_SERVER_URL=http://<lan-ip>:5180 npx cap run android` | Live reload from the dev server (development only; release builds always bundle the code) |
| `cd android && gradlew.bat assembleDebug` (with `JAVA_HOME` = Android Studio's `jbr`) | Debug APK in `android/app/build/outputs/apk/debug/` without opening Android Studio |

- **Releasing the APK** (`npm run release:android -- [patch|minor|major|x.y.z] [--notes "text"]` in `app/`; `--build-only` builds without uploading, `--skip-web` reuses `dist/`):
  - Builds the web bundle against `PUBLIC_API_URL`, syncs, runs `assembleRelease`, signs it and uploads to `gs://$GCS_BUCKET_NAME/android-releases/` (same settings as the desktop release, read from `api/.env.staging`).
  - Version: `versionName` = `x.y.z` from `app/package.json`, `versionCode` = major*10000 + minor*100 + patch (it must only ever increase).
  - Bucket: `<version>/AgentSpace-<version>.apk` (immutable), `latest.json` (what the app reads), `releases.json` (history), `download/AgentSpace.apk` (stable link).
  - The API serves it publicly at `/api/android/releases/*` (`api/src/modules/android-releases`). The download button is under Settings → Devices on the web; inside the Android app the same card shows an update check.
  - Signing: `app/android/release.keystore` + `app/android/keystore.properties` (both git-ignored). **Back them up**: with a different key, installed apps can't update in place. Set `ANDROID_CERT_SHA256` on the API to the keystore's SHA-256 so App Links verify.
  - Installing needs "install unknown apps" allowed once.
- **Plugins:**
  - push notifications and local notifications
  - share and clipboard
  - camera and preferences
  - app (for deep links) and browser (external sign-in)
  - secure storage, biometrics, geolocation, contacts, calendar, document scanner, app launcher, share target
- **Native code** (`android/app/src/main/java/com/agentspace/app/`): voice mode in a foreground service (native WebRTC, keeps working with the screen locked), lock-screen Approve / Reject, home-screen widgets, ongoing task-progress notifications, Google Assistant and launcher shortcuts (`res/xml/shortcuts.xml`), and the shared encrypted sign-in store.
- **Android manifest:** `agentspace://` deep links, auto-verified App Links for `APP_LINKS_HOST` (set it in the Android build; the API serves `/.well-known/assetlinks.json` with the fingerprints in `ANDROID_CERT_SHA256`, comma-separated), a share target (text, images, PDF), and the microphone, camera, contacts, calendar, location and notification permissions.
- **Push:** the apps register FCM tokens at `POST /me/push-subscription` with `{ provider, token }`.
  - The API sends FCM through HTTP v1 when `FCM_PROJECT_ID` and `FCM_CREDENTIALS_JSON_BASE64` (a Firebase service account) are set. Android also needs `android/app/google-services.json` from the Firebase project.
  - Approval pushes are data-only (`kind: "approval"`, `approval_id`, `organization_id`, `requires_biometric`, `url`) so the app draws the Approve / Reject buttons itself; other pushes carry a normal notification.
- **Store listing:** `android/store-listing.md` (texts and data safety answers).

**Not built yet**
- Place-based automation triggers (geofencing).

**Message from anywhere (email, Slack, WhatsApp; §16)**

Each channel is offered in Settings → Message from anywhere only when its variables are set on the API. Webhooks are under `$PUBLIC_API_URL/api/webhooks/channels/…` and every delivery is signature-checked.

| Channel | Variables | Provider setup |
|---|---|---|
| Email (Resend inbound) | `INBOUND_EMAIL_DOMAIN`, `RESEND_INBOUND_WEBHOOK_SECRET`, `RESEND_API_KEY` | Receiving domain (MX record, or the `<id>.resend.app` address) for `INBOUND_EMAIL_DOMAIN`; a webhook for `email.received` to `/webhooks/channels/email`, its signing secret in `RESEND_INBOUND_WEBHOOK_SECRET`. Replies are sent from the member's personal address on that domain, so the domain must also be verified for sending |
| Slack | `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN` | A Slack app with the Messages tab on, bot scopes `chat:write` and `im:history`, and Event Subscriptions (`message.im`) to `/webhooks/channels/slack` |
| WhatsApp (Cloud API) | `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, optional `WHATSAPP_DISPLAY_NUMBER` | Meta app with WhatsApp; webhook URL `/webhooks/channels/whatsapp` with the verify token, subscribed to `messages` |

`RESEND_API_URL`, `SLACK_API_URL` and `WHATSAPP_API_URL` point the API at mock servers for local tests.
