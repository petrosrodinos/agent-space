#!/usr/bin/env node
/**
 * Builds a versioned desktop release and uploads it to Google Cloud Storage (§14.2).
 *
 *   npm run release -- [patch|minor|major|<x.y.z>] [--win] [--mac] [--skip-web] [--dry-run] [--build-only] [--force]
 *
 * With no version argument the current package.json version is released. Without --win/--mac the host OS is built
 * (Mac builds need a Mac).
 *
 * Settings come from api/.env.staging (process environment wins, e.g. in CI):
 *   GCS_PROJECT_ID, GCS_BUCKET_NAME, GCS_CREDENTIALS_JSON_BASE64   where to upload (the API's bucket)
 *   PUBLIC_API_URL   e.g. https://api.agentspace.logiqdev.com — the app talks to <it>/api and updates from
 *                    <it>/api/desktop/releases (the bucket is private; the API serves the folder, see
 *                    api/src/modules/desktop-releases)
 *
 * Bucket layout (everything under the `desktop-releases/` folder):
 *   latest.yml, latest-mac.yml       update feeds electron-updater reads (no-cache); `path`/`url` point into <version>/
 *   releases.json                    index of every version and its files (for a download page)
 *   <version>/…                      immutable installers, zips and blockmaps of that version
 *   download/AgentSpace-Setup.exe, download/AgentSpace.dmg   stable "latest" download links
 *
 * The feed URL is baked into the app (resources/app-update.yml), so installed apps update through the API.
 */
import { Storage } from '@google-cloud/storage';
import { execSync } from 'child_process';
import { build, Platform } from 'electron-builder';
import { existsSync, promises as fs, readFileSync } from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseEnv } from 'util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_ROOT = path.join(ROOT, 'release');
/** Set per run: release/<version>-<timestamp> (Windows antivirus often keeps an old output folder locked). */
let RELEASE_DIR = RELEASE_ROOT;
const PKG_FILE = path.join(ROOT, 'package.json');
const ENV_FILE = path.join(ROOT, '..', 'api', '.env.staging');
/** Must match DESKTOP_RELEASES_FOLDER in api/src/modules/desktop-releases/constants. */
const RELEASES_FOLDER = 'desktop-releases';

const Target = { win: 'win', mac: 'mac' };
const BUMPS = ['patch', 'minor', 'major'];
const CACHE_NO_STORE = 'no-cache, max-age=0';
const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';
/** The feed file electron-updater reads per OS, and the stable download alias. */
const FEEDS = {
    [Target.win]: { feed: 'latest.yml', installerExt: '.exe', alias: 'AgentSpace-Setup.exe' },
    [Target.mac]: { feed: 'latest-mac.yml', installerExt: '.dmg', alias: 'AgentSpace.dmg' },
};

// ---------------- Arguments and config ----------------

/** Only the variables this script needs, so the rest of .env.staging (NODE_ENV=staging…) doesn't leak into the builds. */
const fileEnv = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {};
const env = (name) => process.env[name] || fileEnv[name] || '';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const versionArg = args.find((a) => !a.startsWith('--'));
const dryRun = flag('dry-run');
const force = flag('force');
/** Build with the feed URL baked in, but upload nothing (to test the package locally). */
const buildOnly = flag('build-only');

let targets = [Target.win, Target.mac].filter((t) => flag(t));
if (!targets.length) targets = [process.platform === 'darwin' ? Target.mac : Target.win];
if (targets.includes(Target.mac) && process.platform !== 'darwin') fail('Mac builds need a Mac (DMG and code signing).');

const bucketName = env('GCS_BUCKET_NAME');
const publicApiUrl = env('PUBLIC_API_URL').replace(/\/+$/, '');
if (!bucketName) fail('GCS_BUCKET_NAME is not set (api/.env.staging or environment).');
if (!publicApiUrl) fail('PUBLIC_API_URL is not set (api/.env.staging or environment).');
const apiUrl = `${publicApiUrl}/api`;
const feedUrl = `${apiUrl}/desktop/releases`;
const objectKey = (rel) => `${RELEASES_FOLDER}/${rel}`;

function fail(msg) {
    console.error(`\n[release] ${msg}\n`);
    process.exit(1);
}
const log = (msg) => console.log(`[release] ${msg}`);

function storageClient() {
    const b64 = env('GCS_CREDENTIALS_JSON_BASE64');
    const credentials = b64 ? JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) : undefined;
    // Without explicit credentials, Application Default Credentials are used (`gcloud auth application-default login`).
    return new Storage({ projectId: env('GCS_PROJECT_ID') || credentials?.project_id, credentials });
}

// ---------------- Version ----------------

function resolveVersion() {
    const pkg = JSON.parse(readFileSync(PKG_FILE, 'utf8'));
    if (!versionArg) return pkg.version;
    if (!BUMPS.includes(versionArg) && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(versionArg)) fail(`"${versionArg}" is not patch|minor|major or a x.y.z version.`);
    if (dryRun) return `${pkg.version} (would bump: ${versionArg})`;
    execSync(`npm version ${versionArg} --no-git-tag-version --allow-same-version`, { cwd: ROOT, stdio: 'ignore' });
    return JSON.parse(readFileSync(PKG_FILE, 'utf8')).version;
}

// ---------------- Main ----------------

async function main() {
    const bucket = storageClient().bucket(bucketName);
    const version = resolveVersion();
    log(`version ${version} → gs://${bucketName}/${objectKey('')} (feed ${feedUrl}) for ${targets.join(', ')}${dryRun ? ' [dry run]' : ''}`);

    if (!dryRun && !force && !buildOnly) {
        const [existing] = await bucket.getFiles({ prefix: objectKey(`${version}/`), maxResults: 1 });
        if (existing.length) fail(`Version ${version} is already published. Bump the version, or pass --force to overwrite it.`);
    }
    if (dryRun) return;

    if (!flag('skip-web')) {
        log(`building the web app (app/) against ${apiUrl}…`);
        // Real environment variables take priority over app/.env in Vite.
        execSync('npm --prefix ../app run build', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_API_URL: apiUrl } });
    }
    log('compiling the Electron main process…');
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

    // Clear old outputs where possible; a locked one is skipped and left for the next run.
    for (const old of existsSync(RELEASE_ROOT) ? await fs.readdir(RELEASE_ROOT) : []) {
        await fs.rm(path.join(RELEASE_ROOT, old), { recursive: true, force: true, maxRetries: 2 }).catch(() => log(`could not remove locked release/${old}, skipping`));
    }
    RELEASE_DIR = path.join(RELEASE_ROOT, `${version}-${Date.now()}`);
    const electronDist = path.join(ROOT, 'node_modules', 'electron', 'dist');
    await build({
        projectDir: ROOT,
        targets: mergeTargets(targets),
        publish: 'never',
        config: {
            // Generic provider: electron-updater reads <feedUrl>/latest.yml. Baked into resources/app-update.yml.
            publish: { provider: 'generic', url: feedUrl },
            directories: { output: path.relative(ROOT, RELEASE_DIR) },
            // Windows antivirus can lock the freshly extracted Electron zip; reuse the installed one on the same OS.
            ...(existsSync(electronDist) && process.platform !== 'darwin' ? { electronDist } : {}),
        },
    });

    if (buildOnly) return log(`built ${version} in ${path.relative(ROOT, RELEASE_DIR)} (not uploaded).`);

    const index = await readIndex(bucket);
    for (const target of targets) await publishTarget(bucket, target, version, index);
    index.latest = version;
    index.updatedAt = new Date().toISOString();
    await upload(bucket, Buffer.from(JSON.stringify(index, null, 2)), objectKey('releases.json'), { contentType: 'application/json', cacheControl: CACHE_NO_STORE });

    log(`done. Version ${version} is live; installed apps pick it up within a few hours (or Settings → Check now).`);
    log(`download links: ${feedUrl}/download/${FEEDS[targets[0]].alias}`);
}

function mergeTargets(list) {
    const map = new Map();
    if (list.includes(Target.win)) for (const [k, v] of Platform.WINDOWS.createTarget()) map.set(k, v);
    if (list.includes(Target.mac)) for (const [k, v] of Platform.MAC.createTarget()) map.set(k, v);
    return map;
}

/** Uploads one OS's files into <version>/ and then switches its feed over to them. */
async function publishTarget(bucket, target, version, index) {
    const { feed, installerExt, alias } = FEEDS[target];
    const feedFile = path.join(RELEASE_DIR, feed);
    if (!existsSync(feedFile)) fail(`${feed} was not generated for ${target}. Check the electron-builder output above.`);
    const info = yaml.load(await fs.readFile(feedFile, 'utf8'));

    // Every file the feed names, plus its blockmap (differential downloads), goes to the immutable version folder.
    const names = new Set(info.files.map((f) => f.url));
    for (const n of [...names]) if (existsSync(path.join(RELEASE_DIR, `${n}.blockmap`))) names.add(`${n}.blockmap`);
    const installer = (await fs.readdir(RELEASE_DIR)).find((f) => f.endsWith(installerExt) && f.includes(version));
    if (installer) names.add(installer);
    if (installer && existsSync(path.join(RELEASE_DIR, `${installer}.blockmap`))) names.add(`${installer}.blockmap`);

    for (const name of names) {
        log(`uploading ${version}/${name}`);
        await upload(bucket, path.join(RELEASE_DIR, name), objectKey(`${version}/${name}`), { cacheControl: CACHE_IMMUTABLE });
    }

    // Point the feed into the version folder. electron-updater resolves these relative to the feed URL.
    const versioned = {
        ...info,
        path: `${version}/${info.path}`,
        files: info.files.map((f) => ({ ...f, url: `${version}/${f.url}` })),
    };
    const feedBody = Buffer.from(yaml.dump(versioned, { lineWidth: -1 }));
    await upload(bucket, feedBody, objectKey(`${version}/${feed}`), { contentType: 'text/yaml', cacheControl: CACHE_IMMUTABLE });
    if (installer) {
        const aliasFile = bucket.file(objectKey(`download/${alias}`));
        await bucket.file(objectKey(`${version}/${installer}`)).copy(aliasFile);
        await aliasFile.setMetadata({ cacheControl: CACHE_NO_STORE, contentDisposition: `attachment; filename="${installer}"` });
    }
    // Switch the live feed last, so apps never see a feed whose files aren't uploaded yet.
    await upload(bucket, feedBody, objectKey(feed), { contentType: 'text/yaml', cacheControl: CACHE_NO_STORE });
    log(`${feed} now points to ${version}`);

    const entry = (index.versions[version] ??= { version, releaseDate: info.releaseDate, platforms: {} });
    entry.platforms[target] = {
        installer: installer ? `${feedUrl}/${version}/${installer}` : null,
        files: [...names].map((n) => `${feedUrl}/${version}/${n}`),
    };
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

async function upload(bucket, source, key, { contentType, cacheControl }) {
    const file = bucket.file(key);
    const metadata = { cacheControl, ...(contentType ? { contentType } : {}) };
    if (Buffer.isBuffer(source)) await file.save(source, { resumable: false, metadata });
    else await bucket.upload(source, { destination: key, resumable: true, metadata });
}

main().catch((e) => fail(e?.stack ?? String(e)));
