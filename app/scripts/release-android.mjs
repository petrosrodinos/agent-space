#!/usr/bin/env node
/**
 * Builds a signed, versioned Android APK and uploads it to Google Cloud Storage (§14.2), like desktop/scripts/release.mjs.
 *
 *   npm run release:android -- [patch|minor|major|<x.y.z>] [--dry-run] [--build-only] [--skip-web] [--force] [--notes "text"]
 *
 * With no version argument the current package.json version is released. Settings come from api/.env.staging
 * (process environment wins, e.g. in CI): GCS_PROJECT_ID, GCS_BUCKET_NAME, GCS_CREDENTIALS_JSON_BASE64, PUBLIC_API_URL.
 * Signing comes from android/keystore.properties (git-ignored) or KEYSTORE_* environment variables.
 *
 * Version: versionName = x.y.z, versionCode = major*10000 + minor*100 + patch (always increasing).
 *
 * Bucket layout (everything under `android-releases/`):
 *   latest.json                         what the app and the download page read (no-cache)
 *   releases.json                       index of every version
 *   <version>/AgentSpace-<version>.apk  immutable APK of that version
 *   download/AgentSpace.apk             stable "latest" download link
 */
import { Storage } from '@google-cloud/storage';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, promises as fs, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseEnv } from 'util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID_DIR = path.join(ROOT, 'android');
const PKG_FILE = path.join(ROOT, 'package.json');
const ENV_FILE = path.join(ROOT, '..', 'api', '.env.staging');
const APK_DIR = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release');
/** Must match ANDROID_RELEASES_FOLDER in api/src/modules/android-releases/constants. */
const RELEASES_FOLDER = 'android-releases';
const BUMPS = ['patch', 'minor', 'major'];
const CACHE_NO_STORE = 'no-cache, max-age=0';
const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';
const ALIAS = 'AgentSpace.apk';

const fileEnv = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {};
const env = (name) => process.env[name] || fileEnv[name] || '';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const notesIdx = args.indexOf('--notes');
const notes = notesIdx >= 0 ? (args[notesIdx + 1] ?? '') : '';
const versionArg = args.find((a, i) => !a.startsWith('--') && (notesIdx < 0 || i !== notesIdx + 1));
const dryRun = flag('dry-run');
const force = flag('force');
const buildOnly = flag('build-only');

const bucketName = env('GCS_BUCKET_NAME');
const publicApiUrl = env('PUBLIC_API_URL').replace(/\/+$/, '');
if (!bucketName) fail('GCS_BUCKET_NAME is not set (api/.env.staging or environment).');
if (!publicApiUrl) fail('PUBLIC_API_URL is not set (api/.env.staging or environment).');
const apiUrl = `${publicApiUrl}/api`;
const releasesUrl = `${apiUrl}/android/releases`;
const objectKey = (rel) => `${RELEASES_FOLDER}/${rel}`;

function fail(msg) {
    console.error(`\n[release-android] ${msg}\n`);
    process.exit(1);
}
const log = (msg) => console.log(`[release-android] ${msg}`);

function storageClient() {
    const b64 = env('GCS_CREDENTIALS_JSON_BASE64');
    const credentials = b64 ? JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) : undefined;
    return new Storage({ projectId: env('GCS_PROJECT_ID') || credentials?.project_id, credentials });
}

function resolveVersion() {
    const pkg = JSON.parse(readFileSync(PKG_FILE, 'utf8'));
    if (!versionArg) return pkg.version;
    if (!BUMPS.includes(versionArg) && !/^\d+\.\d+\.\d+$/.test(versionArg)) fail(`"${versionArg}" is not patch|minor|major or a x.y.z version.`);
    if (dryRun) return `${pkg.version} (would bump: ${versionArg})`;
    execSync(`npm version ${versionArg} --no-git-tag-version --allow-same-version`, { cwd: ROOT, stdio: 'ignore' });
    return JSON.parse(readFileSync(PKG_FILE, 'utf8')).version;
}

function versionCodeOf(version) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!m) fail(`Version "${version}" must be x.y.z (versionCode is derived from it).`);
    const [major, minor, patch] = m.slice(1).map(Number);
    if (minor > 99 || patch > 99) fail('minor and patch must be 0-99 (versionCode = major*10000 + minor*100 + patch).');
    return major * 10000 + minor * 100 + patch;
}

/** Android Studio's bundled JDK when JAVA_HOME isn't set. */
function javaHome() {
    if (process.env.JAVA_HOME) return process.env.JAVA_HOME;
    const studio = 'C:\\Program Files\\Android\\Android Studio\\jbr';
    return existsSync(studio) ? studio : undefined;
}

function checkSigning() {
    const hasFile = existsSync(path.join(ANDROID_DIR, 'keystore.properties'));
    if (!hasFile && !process.env.KEYSTORE_STOREFILE) fail('No release signing config: create android/keystore.properties (see docs/RUNNING.md) or set KEYSTORE_* variables.');
}

async function main() {
    const bucket = storageClient().bucket(bucketName);
    const version = resolveVersion();
    log(`version ${version} -> gs://${bucketName}/${objectKey('')}${dryRun ? ' [dry run]' : ''}`);
    if (dryRun) return;
    const versionCode = versionCodeOf(version);
    checkSigning();

    if (!buildOnly && !force) {
        const [existing] = await bucket.getFiles({ prefix: objectKey(`${version}/`), maxResults: 1 });
        if (existing.length) fail(`Version ${version} is already published. Bump the version, or pass --force to overwrite it.`);
    }

    if (!flag('skip-web')) {
        log(`building the web app and syncing into android/ against ${apiUrl}...`);
        execSync('npm run build && npx cap sync android', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_API_URL: apiUrl } });
    }

    log(`assembling the signed APK (versionName ${version}, versionCode ${versionCode})...`);
    const jdk = javaHome();
    const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
    execSync(`${gradlew} assembleRelease -PAPP_VERSION_CODE=${versionCode} -PAPP_VERSION_NAME=${version}`, {
        cwd: ANDROID_DIR,
        stdio: 'inherit',
        env: { ...process.env, ...(jdk ? { JAVA_HOME: jdk } : {}) },
    });

    const apkSource = path.join(APK_DIR, 'app-release.apk');
    if (!existsSync(apkSource)) fail('app-release.apk was not produced. It is only built when signing is configured; check the Gradle output above.');
    const apkName = `AgentSpace-${version}.apk`;
    const body = await fs.readFile(apkSource);
    const sha256 = createHash('sha256').update(body).digest('hex');
    log(`built ${apkName} (${(body.length / 1048576).toFixed(1)} MB, sha256 ${sha256.slice(0, 12)}...)`);

    if (buildOnly) return log(`built ${apkSource} (not uploaded).`);

    log(`uploading ${version}/${apkName}`);
    await bucket.upload(apkSource, {
        destination: objectKey(`${version}/${apkName}`),
        resumable: true,
        metadata: { cacheControl: CACHE_IMMUTABLE, contentType: 'application/vnd.android.package-archive' },
    });

    const aliasFile = bucket.file(objectKey(`download/${ALIAS}`));
    await bucket.file(objectKey(`${version}/${apkName}`)).copy(aliasFile);
    await aliasFile.setMetadata({ cacheControl: CACHE_NO_STORE, contentDisposition: `attachment; filename="${apkName}"` });

    const releasedAt = new Date().toISOString();
    const entry = {
        version,
        versionCode,
        apk: `${releasesUrl}/${version}/${apkName}`,
        download: `${releasesUrl}/download/${ALIAS}`,
        sha256,
        size: body.length,
        notes,
        releasedAt,
    };
    const index = await readIndex(bucket);
    index.versions[version] = entry;
    index.latest = version;
    index.updatedAt = releasedAt;
    await upload(bucket, Buffer.from(JSON.stringify(index, null, 2)), objectKey('releases.json'), { contentType: 'application/json', cacheControl: CACHE_NO_STORE });
    // Switch the live manifest last, so apps never see a version whose APK isn't uploaded yet.
    await upload(bucket, Buffer.from(JSON.stringify(entry, null, 2)), objectKey('latest.json'), { contentType: 'application/json', cacheControl: CACHE_NO_STORE });

    log(`done. Version ${version} is live; the app offers it under Settings -> Devices.`);
    log(`download link: ${entry.download}`);
}

async function readIndex(bucket) {
    try {
        const [buf] = await bucket.file(objectKey('releases.json')).download();
        const index = JSON.parse(buf.toString('utf8'));
        return { latest: index.latest ?? null, updatedAt: index.updatedAt ?? null, versions: index.versions ?? {} };
    } catch (e) {
        if (e?.code === 404) return { latest: null, updatedAt: null, versions: {} };
        throw e;
    }
}

async function upload(bucket, buffer, key, { contentType, cacheControl }) {
    await bucket.file(key).save(buffer, { resumable: false, metadata: { cacheControl, contentType } });
}

main().catch((e) => fail(e?.stack ?? String(e)));
