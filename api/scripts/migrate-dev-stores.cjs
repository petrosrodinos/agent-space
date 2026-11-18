/**
 * One-off: moves data written by the development fallbacks into the production stores.
 *  - dev_secret_blobs (SECRET_STORE=local-encrypted) → Google Secret Manager (`cred-<credentialId>`), then deletes the blob.
 *  - local files (STORAGE_DRIVER=local, LOCAL_STORAGE_DIR or ./.storage) → the GCS bucket, same object keys.
 * Usage (from api/): npx dotenv run -f .env.staging -- node scripts/migrate-dev-stores.cjs [--dry-run]
 * Needs SECRETS_ENCRYPTION_KEY (the key the blobs were written with) and the GCS_* variables.
 */
const fs = require('fs');
const path = require('path');
const { createDecipheriv, createHash } = require('crypto');
const { Client } = require('pg');
const { Storage } = require('@google-cloud/storage');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const dry = process.argv.includes('--dry-run');

(async () => {
  const credentials = JSON.parse(Buffer.from(process.env.GCS_CREDENTIALS_JSON_BASE64, 'base64').toString('utf8'));
  const projectId = process.env.SECRET_MANAGER_PROJECT_ID || process.env.GCS_PROJECT_ID;
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  // ---- Secrets ----
  const blobs = (await db.query('select resource_name, ciphertext from dev_secret_blobs')).rows;
  console.log(`dev secret blobs: ${blobs.length}`);
  if (blobs.length) {
    if (!process.env.SECRETS_ENCRYPTION_KEY) throw new Error('SECRETS_ENCRYPTION_KEY is needed to read the dev blobs');
    const key = createHash('sha256').update(process.env.SECRETS_ENCRYPTION_KEY).digest();
    const sm = new SecretManagerServiceClient({ projectId, credentials });
    for (const b of blobs) {
      const [iv, tag, enc] = b.ciphertext.split('.').map((s) => Buffer.from(s, 'base64'));
      const d = createDecipheriv('aes-256-gcm', key, iv);
      d.setAuthTag(tag);
      const payload = Buffer.concat([d.update(enc), d.final()]);
      const secretId = b.resource_name.split('/secrets/')[1];
      const cred = (await db.query('select id from credentials where secret_resource_name = $1', [b.resource_name])).rows[0];
      console.log(` - ${secretId} (credential ${cred ? 'found' : 'missing'})`);
      if (dry) continue;
      let name = `projects/${projectId}/secrets/${secretId}`;
      try {
        await sm.createSecret({ parent: `projects/${projectId}`, secretId, secret: { replication: { automatic: {} }, labels: { migrated: 'dev-store' } } });
      } catch (e) {
        if (e.code !== 6) throw e; // 6 = ALREADY_EXISTS
      }
      const [version] = await sm.addSecretVersion({ parent: name, payload: { data: payload } });
      if (cred) await db.query('update credentials set secret_resource_name = $1, secret_version = $2 where id = $3', [name, version.name.split('/').pop(), cred.id]);
      await db.query('delete from dev_secret_blobs where resource_name = $1', [b.resource_name]);
    }
  }

  // ---- Files ----
  const dir = path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), '.storage'));
  const files = fs.existsSync(dir) ? walk(dir).filter((f) => !f.endsWith('.ct')) : [];
  console.log(`local files in ${dir}: ${files.length}`);
  if (files.length) {
    const bucket = new Storage({ projectId: process.env.GCS_PROJECT_ID, credentials }).bucket(process.env.GCS_BUCKET_NAME);
    for (const f of files) {
      const keyPath = path.relative(dir, f).split(path.sep).join('/'); // <bucket kind>/<orgs/...>
      const ct = fs.existsSync(`${f}.ct`) ? fs.readFileSync(`${f}.ct`, 'utf8') : 'application/octet-stream';
      console.log(` - ${keyPath}`);
      if (!dry) await bucket.file(keyPath).save(fs.readFileSync(f), { contentType: ct, resumable: false });
    }
  }
  const ready = (await db.query("select count(*)::int n from files where status = 'READY' and deleted_at is null")).rows[0].n;
  console.log(`file records marked ready: ${ready}`);
  await db.end();
  console.log(dry ? 'dry run — nothing changed' : 'done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
}
