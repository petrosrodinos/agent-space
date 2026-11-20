import { environments } from "@/config/environments";

/** Written by app/scripts/release-android.mjs and served by the API (api/src/modules/android-releases). */
export const ANDROID_RELEASES_URL = `${environments.API_URL}/android/releases`;
export const ANDROID_LATEST_MANIFEST_URL = `${ANDROID_RELEASES_URL}/latest.json`;
export const ANDROID_LATEST_APK_URL = `${ANDROID_RELEASES_URL}/download/AgentSpace.apk`;
