/**
 * Android app releases (§14.2) live in GCS_BUCKET_NAME under this folder, uploaded by app/scripts/release-android.mjs.
 * The bucket is private, so devices and the download page reach the APKs through this API.
 */
export const ANDROID_RELEASES_FOLDER = 'android-releases';
