# New Features: Where to Find and How to Test

Covers the features merged in commit `421abc7` (20 November 2026). Full status is in `docs/Product_Specification.md` §19; setup details are in `docs/RUNNING.md`.

## Running locally

1. API: `npm run start:staging` in `api/`
2. App: `npm run dev` in `app/`
3. Open http://localhost:5180 and sign in with the test account.

## Web app

| Feature | Where | How to test |
|---|---|---|
| Knowledge library and reading of images and scans | Settings → Knowledge library, or a bot's Knowledge tab | Upload a PDF, Word file, Excel file or a photo of text. Its status should go from Processing to Ready, then ask the bot about the content; it should say which file it used. |
| Artifact "Download as" | Open any artifact → Download | Try PDF and PNG. A slide deck also offers PowerPoint, and a document also offers Word. |
| Artifact live data | Ask a bot: "make a page that lists my latest 10 Gmail emails live" | Open the page. The app should ask "Let … read your Gmail data?"; after you allow it, real data appears. You can remove that permission in the artifact's Settings. |
| Visitor uploads on artifacts | Ask a bot: "make a form where people can upload a CV" | Upload a file, then check it in the artifact's Data tab. To let public visitors upload, turn on "File uploads from visitors" under Share. |
| Saved widgets | Any interactive reply → "Save as widget", then the Widgets page | Open the widget; it should refresh with new data. Rename and delete it from there. |
| Deleted artifacts | Artifacts → Deleted tab | Delete an artifact and restore it. Your personal settings have the "permanently delete after 30 days" switch, which is off by default. |
| Camera and screen sharing in voice mode | Voice mode bar → Camera / Share screen | Show the camera something, press "Show this" and ask what it sees. Snapshot posts the picture in the chat. |
| Automation triggers | Automations → New → "When something happens" | Pick Gmail and "new message", then send yourself an email. This only works after the Composio webhook step below. |
| Meeting assistant | Card on the Automations page | Pick a bot and your Google Calendar, add a meeting starting in about 30 minutes, then press Run now on "Meeting briefs". |
| Undo | A bot's step in the chat | Ask a bot to create a calendar event, then press Undo on that step (available for 24 hours, once). |
| Copying files onto the cloud computer | Chat with a bot that has its cloud computer turned on | "Copy my latest Gmail email onto your computer and read it." It works with a chat file or a link too. |
| Cloud computer browsing and sign-ins | Secrets → add a website login, then chat | "Sign in to the-internet.herokuapp.com/login and tell me what it says." Approve when asked. |
| Password manager (1Password) | Secrets → Add → Password manager | Needs a real 1Password Connect server (address and token). After that, same test as the row above. |
| Message from anywhere | Settings → Message from anywhere | It shows "not set up" until the provider keys are added (see below). Then pick a bot, email the personal address shown, or send the code from Slack or WhatsApp. The answer comes back in the same place, and the chat shows a mail, Slack or WhatsApp mark. |
| Fingerprint unlock settings | Settings → Approvals & safety | Tick the scopes ("all approvals", "external emails", "deleting data"). The fingerprint prompt itself only happens on the phone. |
| Activity history | Settings → Activity (Owner or Admin) | Do something, then check it appears there. |
| Web push | Settings → Notifications → turn push on | Start a task, switch to another tab, and a push should appear when it finishes. |

## Desktop app (`desktop/`)

Go to Settings → Devices → This computer. There you allow folders, add local tool servers and set each tool to Ask, Always or Never. Then ask a bot to "list the files in my Documents folder", "look at my screen" or "take a screenshot of my computer".

Mouse and keyboard control was never tried with real input, so test that carefully.

## Android app (built, never run on a phone)

To install it:

1. In `app/`, run `npx cap sync android`.
2. In `app/android`, run `gradlew.bat assembleDebug` (with `JAVA_HOME` set to Android Studio's `jbr` folder).
3. Install `app/android/app/build/outputs/apk/debug/app-debug.apk` on a phone.

On the phone, try:

- voice mode with the screen locked;
- home-screen widgets;
- long-pressing the app icon for shortcuts;
- sharing something to a bot;
- the document scanner;
- task progress notifications;
- asking the bot about your contacts, calendar or location.

Lock-screen Approve / Reject and the fingerprint prompt only work once Firebase push is set up (below).

## What you need to do

1. **Database:** run `prisma migrate deploy` on production when you deploy, so it gets the new tables. Staging already has them.
2. **Composio webhook:** after you deploy, run `node scripts/composio-webhook.mjs --create` in `api/` and set the `COMPOSIO_WEBHOOK_SECRET` it prints. Until then, automation triggers never fire.
3. **Google Cloud Storage:** add a CORS rule on the bucket for your app's address, allowing `PUT` and `POST` with the headers `Content-Type` and `x-goog-resumable`.
4. **Firebase (Android push):** set `FCM_PROJECT_ID` and `FCM_CREDENTIALS_JSON_BASE64` on the API, and add `app/android/app/google-services.json`.
5. **Google Play:** a developer account, a release signing key, and its SHA-256 fingerprint in `ANDROID_CERT_SHA256` on the API. Set `APP_LINKS_HOST` to your web domain in the Android build.
6. **Message from anywhere:** each channel needs its own provider set up. Exact steps are in the "Message from anywhere" table in `docs/RUNNING.md`.
   - **Email:** a Resend receiving domain and an `email.received` webhook (`INBOUND_EMAIL_DOMAIN`, `RESEND_INBOUND_WEBHOOK_SECRET`).
   - **Slack:** a Slack app with direct messages and the `message.im` event (`SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`).
   - **WhatsApp:** a WhatsApp Cloud API number and webhook (`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_DISPLAY_NUMBER`).
7. **Password manager:** only if you want it, run a 1Password Connect server that is reachable over https.
8. **Production keys:** VAPID keys for push, plus `OPENAI_API_KEY` and `DAYTONA_API_KEY` for production.
