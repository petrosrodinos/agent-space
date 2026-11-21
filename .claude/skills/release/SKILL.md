---
name: release
description: Release a new version of the Agent Space desktop app (Windows installer) and Android APK to Google Cloud Storage with auto-update. Use when the user says "release", "release new version", "ship desktop/mobile", "publish a new build". Contains everything needed so the scripts and code never need to be explored.
---

# Release desktop + mobile

Both apps ship from the same web code in `app/`. Two scripts do everything (version bump, build, sign, upload, switch the live feed). **Do not read the scripts or explore the code** — run the commands below.

## Default procedure (patch release of both)

Run from the repo root, **sequentially** (both build `app/dist`, so never in parallel), in the background (takes several minutes; use `run_in_background` with `timeout: 600000`):

```bash
(cd desktop && npm run release -- patch --win) && (cd app && npm run release:android -- patch)
```

You are notified on completion. Then read the output file and grep for `^\[release` to confirm:

- desktop: `[release] done. Version X is live` and `latest.yml now points to X`
- android: `[release-android] done. Version Y is live` plus `built AgentSpace-Y.apk`

If only one platform was requested, run only that half. Desktop and Android have **independent version numbers** (desktop `desktop/package.json`, Android `app/package.json`); each script bumps its own.

## Arguments

| Script | Command (cwd) | Args |
|---|---|---|
| Desktop | `npm run release -- <bump> [--win] [--mac] [--skip-web] [--dry-run] [--build-only] [--force]` (in `desktop/`) | `<bump>` = `patch` \| `minor` \| `major` \| `x.y.z`; omitted = release current package.json version as is |
| Android | `npm run release:android -- <bump> [--notes "text"] [--skip-web] [--dry-run] [--build-only] [--force]` (in `app/`) | same bump values; `--notes` is shown in the update manifest |

- Default bump is `patch` unless the user says minor/major/a number.
- `--dry-run` prints the target version and bucket without building (note: with a bump it does not write the bump). `--build-only` builds locally and uploads nothing.
- Without `--win`/`--mac` the desktop script builds the host OS. **Mac builds need a Mac**; on Windows only pass `--win`. Tell the user Mac was not built.
- Without `--force` the script refuses to re-publish an existing version (the bump normally avoids this).

## What the scripts do (so you can reason about failures)

- Config is read from `api/.env.staging` (`GCS_PROJECT_ID`, `GCS_BUCKET_NAME` = `ld-agent-space`, `GCS_CREDENTIALS_JSON_BASE64`, `PUBLIC_API_URL` = `https://api.agentspace.logiqdev.com`); real env vars win. The web bundle is built against `$PUBLIC_API_URL/api`.
- Both bump `package.json` via `npm version <bump> --no-git-tag-version` (touches `package.json` + `package-lock.json` in `desktop/` or `app/`), build, upload to the private bucket and switch the live feed **last**.
- Desktop: electron-builder NSIS installer to `gs://ld-agent-space/desktop-releases/<version>/`, then `latest.yml`, `releases.json`, and `download/AgentSpace-Setup.exe`. Installed apps auto-update within a few hours (or Settings -> Check now). The updater never downgrades; to roll back, release a higher version.
- Android: Gradle `assembleRelease` with `versionName=x.y.z`, `versionCode = major*10000 + minor*100 + patch` (minor and patch must be 0-99). Uploads `android-releases/<version>/AgentSpace-<version>.apk`, `latest.json`, `releases.json`, `download/AgentSpace.apk`. The app shows the update under Settings -> Devices.
- Android signing needs `app/android/keystore.properties` + `release.keystore` (git-ignored, must never be replaced: a different key breaks in-place updates) or `KEYSTORE_*` env vars. JDK comes from `JAVA_HOME` or Android Studio's `jbr`.

## Public links (report these after release)

- Windows installer: https://api.agentspace.logiqdev.com/api/desktop/releases/download/AgentSpace-Setup.exe
- Android APK: https://api.agentspace.logiqdev.com/api/android/releases/download/AgentSpace.apk

## After the release

1. Report the new versions of both apps, the links, and that Mac was not built (if so).
2. **Builds use the working tree, including uncommitted code.** If `git status` shows source changes that were shipped, mention it.
3. The version bump leaves 4 modified files: `desktop/package.json`, `desktop/package-lock.json`, `app/package.json`, `app/package-lock.json`. Commit them only when the user asks (use the scoped-commit skill; message like `Release desktop X and Android Y`, with the Co-Authored-By line from the session). Never push unless asked.

## Known noise and failure modes

- Desktop output has a huge "duplicate dependency references" line and a `MaxListenersExceededWarning`; both are harmless.
- `Version X is already published`: the version already exists in the bucket; bump again (or `--force` only if the user wants to overwrite).
- `No release signing config`: keystore files missing (Android). Stop and ask the user; do not generate a new keystore.
- Windows antivirus locking `default_app.asar`/old `release/` folders: the script already skips locked folders and reuses the installed Electron; just retry once.
- `GCS_*`/`PUBLIC_API_URL is not set` or auth errors: `api/.env.staging` is missing or lacks credentials; ask the user.
- If a release fails after the bump, `package.json` is already bumped. Re-run with the explicit same version (`x.y.z`) rather than `patch` to avoid skipping a number, adding `--force` only if files were partially uploaded for that version.
