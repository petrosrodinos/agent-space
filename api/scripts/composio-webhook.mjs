// One-time setup for automation triggers (§10.2): registers our webhook with Composio and prints its signing secret.
//   node scripts/composio-webhook.mjs            → shows what exists and what would be created
//   node scripts/composio-webhook.mjs --create   → creates the subscription; put the printed secret in COMPOSIO_WEBHOOK_SECRET
// Reads COMPOSIO_API_KEY and PUBLIC_API_URL from the environment (e.g. npx dotenv run -f .env.production -- node …).
const key = process.env.COMPOSIO_API_KEY;
const base = (process.env.PUBLIC_API_URL || process.env.API_URL || '').replace(/\/api\/?$/, '').replace(/\/$/, '');
if (!key || !base) {
  console.error('Set COMPOSIO_API_KEY and PUBLIC_API_URL first.');
  process.exit(1);
}
const url = `${base}/api/webhooks/composio`;
const call = async (method, path, body) => {
  const res = await fetch(`https://backend.composio.dev/api/v3${path}`, { method, headers: { 'x-api-key': key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
};

const existing = await call('GET', '/webhook_subscriptions');
const items = existing.items ?? [];
console.log(`Existing subscriptions: ${items.length ? items.map((s) => s.webhook_url).join(', ') : 'none'}`);
if (items.some((s) => s.webhook_url === url)) {
  console.log(`Already registered: ${url}. Its secret is shown once at creation; rotate it in Composio if it was lost.`);
  process.exit(0);
}
if (!process.argv.includes('--create')) {
  console.log(`Would register ${url} for composio.trigger.message. Run again with --create.`);
  process.exit(0);
}
const created = await call('POST', '/webhook_subscriptions', { webhook_url: url, enabled_events: ['composio.trigger.message'] });
console.log(`Registered ${url}`);
console.log(`COMPOSIO_WEBHOOK_SECRET=${created.secret ?? '(not returned — copy it from the Composio dashboard)'}`);
