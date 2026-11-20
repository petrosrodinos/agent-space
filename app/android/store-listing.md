# Agent Space — Google Play store listing

Package: `com.agentspace.app` · Category: Productivity · Contains ads: No · In-app purchases: No (billing happens on the web)

## Title (max 30 characters)

Agent Space: AI co-workers

## Short description (max 80 characters)

Your AI co-workers that use your apps, talk with you and ask before they act.

## Full description (max 4000 characters)

Agent Space gives you and your team AI co-workers ("bots") that get real work done. Each bot has its own instructions, memory and connected apps. Chat with them, talk to them out loud, or let them run tasks on a schedule. They ask before they send, buy or delete anything.

The Android app is the same Agent Space you use on the web and on your computer, with everything in sync, plus features that only make sense on a phone.

**Chat and voice**
- Chat with your bots and groups, with files, images and replies that update live.
- Voice mode: talk to a bot in real time and interrupt it any time. It keeps working with the screen locked.
- Show a bot what you're looking at with the camera while you talk.

**Approve from anywhere**
- When a bot needs your OK, you get a notification with Approve and Reject. Your phone must be unlocked to use them.
- Sensitive approvals, like payments, need your fingerprint or face.

**Made for your phone**
- Share to a bot: send text, links, photos and PDFs from any app straight to a bot.
- Scan documents, receipts and business cards. The text is read on your phone.
- Find a contact, prepare a text, WhatsApp message, email or call. You always tap Send yourself.
- Read and add events in the calendars on your phone.
- Share your location once, when you ask ("cafés near me").
- Google Assistant: "Ask Sales Sam…", "Start voice mode with Sales Sam", "Run my morning briefing".
- Home-screen widgets for quick questions, voice mode and the approvals waiting for you.
- Follow long tasks in a progress notification.

**You stay in control**
- Every phone feature has its own switch: Ask each time (the default), Always allow, or Never.
- Android's own permission prompts come first, and your organisation can turn device features off.
- Everything a bot does appears in your activity history.
- Agent Space never reads your text messages or call history, never tracks your location in the background, and never sends messages or makes calls without your tap.

An Agent Space account is required. Sign in with your work or personal account.

## Feature bullets (for screenshots / promo graphics)

1. Your AI co-workers, in your pocket
2. Talk to a bot, even with the screen locked
3. Approve or reject from the notification
4. Share anything from any app to a bot
5. Scan documents and receipts
6. Ask with Google Assistant or a home-screen widget

## Graphics checklist

- App icon: 512 x 512 from `app/resources/icon-only.png` (neutral monochrome).
- Feature graphic: 1024 x 500, dark `#0A0A0A` background, white mark, no purple.
- Phone screenshots: chat, voice mode, approval notification, share to a bot, scanner, widgets.

## Data safety form

Answers follow the product specification (§11 Trust, §14.3 Device tools). Re-check before each release if a feature changes.

**Does the app collect or share user data?** Yes, it collects data. It does not share data with third parties for their own purposes. AI model providers and infrastructure providers process data only on our behalf (service providers), which Play does not count as sharing.

**Is all data encrypted in transit?** Yes (HTTPS / TLS; voice uses encrypted WebRTC).

**Can users request deletion?** Yes. In the app: Settings → Danger zone → Delete account. Organisation data follows the organisation's retention settings.

**Is collection required or optional?** Account information is required. Everything else is optional and only happens when the user uses that feature.

| Data type (Play category) | Collected | Optional | Purpose | Notes |
|---|---|---|---|---|
| Personal info: Name, Email address | Yes | Required | Account management, App functionality | Sign-in and showing who did what |
| Personal info: User IDs | Yes | Required | Account management | Internal account ID |
| Messages: Other in-app messages | Yes | Required | App functionality | Chats with bots and colleagues |
| Photos and videos: Photos | Yes | Optional | App functionality | Only photos and scans the user takes or shares; voice-mode camera pictures are not stored |
| Audio: Voice or sound recordings | Yes | Optional | App functionality | Voice mode and voice notes; audio is processed to text and not kept, the transcript is saved as chat messages |
| Files and docs | Yes | Optional | App functionality | Files the user attaches or shares |
| Calendar: Calendar events | Yes | Optional | App functionality | Only when the user allows the calendar tool; only the events asked for |
| Contacts | Yes | Optional | App functionality | Only matching contacts (max 20) for a search the user allows; never the whole address book |
| Location: Approximate location, Precise location | Yes | Optional | App functionality | Once, when the user asks; never in the background |
| App activity: App interactions, Other user-generated content | Yes | Required | App functionality, Analytics | Activity history of what bots did (§11) |
| App info and performance: Crash logs, Diagnostics | Yes | Required | App functionality | Error reports |
| Device or other IDs | Yes | Optional | App functionality | Push notification token (FCM) |
| Financial info, Health and fitness, Web browsing, SMS / call logs | No | — | — | Not collected |

**Permissions to explain in the Play Console (sensitive permissions)**

- `RECORD_AUDIO`, `FOREGROUND_SERVICE_MICROPHONE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`: voice mode, which keeps running with the screen locked; a notification is shown the whole time and has an End button.
- `CAMERA`: photos, document scans and showing the camera to a bot in voice mode, always started by the user.
- `READ_CONTACTS` / `WRITE_CONTACTS`: contact search when the user allows it. Write is only declared because the contacts plugin requests both as one group; the app never adds or edits contacts.
- `READ_CALENDAR` / `WRITE_CALENDAR`: reading and adding events in the phone's calendars, with the user's approval.
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`: the current location once, when asked. No background location.
- `POST_NOTIFICATIONS`: messages, approvals and task progress.

**Foreground service declaration (Play Console → App content → Foreground service types)**

- Microphone + media playback: "Voice mode: a real-time spoken conversation with an AI assistant that continues while the screen is locked. Started only by the user tapping the voice mode button; stopped from the app or the notification."
