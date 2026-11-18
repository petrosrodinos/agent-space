/**
 * Desktop app releases (§14.2) live in GCS_BUCKET_NAME under this folder, uploaded by desktop/scripts/release.mjs.
 * The bucket is private (uniform access, user files), so installed apps reach them through this API.
 */
export const DESKTOP_RELEASES_FOLDER = 'desktop-releases';

/** Small metadata files (update feeds, index) are returned directly and never cached. */
export const DESKTOP_RELEASE_METADATA_TYPES: Record<string, string> = {
  '.yml': 'text/yaml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

/** Installers redirect to a signed GCS URL valid this long. */
export const DESKTOP_RELEASE_DOWNLOAD_TTL_MS = 15 * 60_000;

/** `1.2.0/AgentSpace-Setup-1.2.0.exe`, `latest.yml`, `download/AgentSpace.dmg` — no `..`, no leading slash. */
export const DESKTOP_RELEASE_PATH_PATTERN =
  /^(?!.*\.\.)[\w.-]+(\/[\w.-]+){0,2}$/;
