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
- **Knowledge and skill files:** PDF, Word, text, Markdown, CSV and web pages are read as text at upload time; bots use `search_knowledge` / `read_knowledge` / `read_file`.

## Artifacts (§7.5)

- **Source:** each version stores one self-contained HTML document written by the bot (`ArtifactVersion.source = { html }`). Bots may load React/Tailwind/chart libraries only from the allowed CDNs; the build guide lives in `api/src/modules/agent/tools/artifact-tools.service.ts` (`create_artifact`, `update_artifact` with full HTML or find/replace edits, `read_artifact`, `list_artifacts`, `get_artifact_records`).
- **Isolated host:** artifacts are served by the API at `<API_URL>/a/<org-slug>/<artifact-slug>` (`artifact-view.controller.ts`). Every response sends a CSP with `sandbox` (no `allow-same-origin`), so the page always runs in an opaque origin and can't read API cookies, the app or other artifacts. The app embeds it in a sandboxed iframe too. `frame-ancestors` is the app origin(s) for members, or `*` for public links with embedding allowed. `X-Robots-Tag: noindex` unless "Allow search engines" is on.
- **Access:** members open it with a 15-minute signed view token (`POST /api/artifacts/:id/view-token`, re-checked at render time). Public links need sharing level "Public link" + link enabled + not expired; passwords are bcrypt-hashed and unlock with a signed `k` token (invalidated when the password changes).
- **Runtime:** the page gets `window.agentspace.save(collection, data)`, `.list(collection)` and `.ai(prompt)`, calling `<API_URL>/ax/:id/{records,ai}` with a per-page session token (12 h) as `text/plain` simple requests (no CORS preflight). `private_*` collections are only readable in the app's Data tab (owners/editors). Limits: 20 KB per entry, 10 000 entries per artifact, 30 saves/min/IP, AI 10/min/IP and 200/day per artifact (public AI usage is billed to the owner and can be switched off).
- **Reports:** public pages show a small "Report" link (`/ax/:id/report`), stored as `ArtifactReport`.
- **Not yet:** live connected-account data inside artifacts, visitor file uploads, editing text directly in the preview, real-time co-editing presence, PDF/PPTX/DOCX export (HTML download only), and the 30-day purge job for deleted artifacts.

## Desktop and mobile apps (§14.2)

The same `app/` build is packaged with **Electron** (Windows, Mac) in `desktop/` and with **Capacitor** (iPhone, Android) in `app/android` and `app/ios`. The platform layer (`app/src/platform/`) picks the implementation at start-up: `desktop.ts` when the Electron preload bridge (`window.agentspaceDesktop`) is present, `native.ts` inside Capacitor, `web.ts` otherwise. The apps keep the refresh token in the OS keychain (Electron `safeStorage`; iOS Keychain / Android Keystore via `@aparajita/capacitor-secure-storage`) and send `X-Client-Platform: desktop|ios|android`, so the API returns the token in the body instead of the cookie. The API allows the app-shell origins `app://agentspace`, `capacitor://localhost` and `https://localhost` (`api/src/shared/config/cors`).

Build the web bundle for the API the apps should talk to first: `VITE_API_URL=https://api.example.com/api npm run build` in `app/`.

**Desktop (`desktop/`)**

| Command | What it does |
|---|---|
| `npm install` | Installs Electron 45 / electron-builder 26 / electron-updater 6 (pinned) |
| `npm run dev` | Opens the app against the Vite dev server (`http://localhost:5180`, or `AGENTSPACE_DEV_URL`) |
| `npm start` | Opens the bundled `../app/dist` through the `app://agentspace` protocol |
| `npm run package:dir` | Unpacked app in `release/win-unpacked` (quick local test) |
| `npm run package:win` / `package:mac` | Builds `app/` and makes the NSIS installer / DMG + ZIP |

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
- **Automatic updates:** set `publish` in `electron-builder.yml` (e.g. a generic feed URL). Without it the updater logs "disabled" and Settings → Devices says so.
- **Windows note:** real-time antivirus can lock `default_app.asar` while electron-builder extracts Electron. `package:dir` therefore uses the already-installed `node_modules/electron/dist` (`electronDist`).

**Mobile (`app/`, Capacitor 8)**

| Command | What it does |
|---|---|
| `npm run cap:sync` | Builds the web bundle and copies it plus the plugins into `android/` and `ios/` |
| `npm run cap:android` / `cap:ios` | Opens Android Studio / Xcode (iOS needs a Mac; Capacitor 8 uses Swift Package Manager, no CocoaPods) |
| `CAP_SERVER_URL=http://<lan-ip>:5180 npx cap run android` | Live reload from the dev server (development only; release builds always bundle the code) |

- **Plugins:**
  - push notifications and local notifications
  - share and clipboard
  - camera and preferences
  - app (for deep links) and browser (external sign-in)
  - secure storage
- **Android manifest:** `agentspace://` deep links, a share target (text, images, PDF), and the microphone, camera and notification permissions.
- **iOS `Info.plist`:** the `agentspace` URL scheme, microphone, camera and photos usage strings, and remote notifications.
- **Push:** the apps register FCM (Android) / APNs (iOS) tokens at `POST /me/push-subscription` with `{ provider, token }`.
  - The API sends FCM through HTTP v1 when `FCM_PROJECT_ID` and `FCM_CREDENTIALS_JSON_BASE64` (a Firebase service account) are set. Android also needs `android/app/google-services.json` from the Firebase project.
  - **APNs sending is not built yet.** iOS tokens are stored, but no push is delivered until an APNs sender (or FCM for iOS) is added.

**Not built yet**
- Device tools (§14.3): local files, screen capture, local tool servers, contacts, calendar, location and place-based triggers.
- The native voice plugin `@agentspace/voice`: voice mode on mobile uses the WebView's WebRTC, so it stops when the iPhone screen locks.
- Siri / App Actions, home-screen widgets and Live Activities.
- Biometrics for sensitive approvals, and lock-screen Approve/Reject actions.
- The document scanner, the iOS Share Extension, and handling the shared content in the app (Android only declares the share intent).
- Universal links / App Links (needs `apple-app-site-association` / `assetlinks.json` on the web domain).
- App icons and splash screens (the defaults are used), and store listings.
