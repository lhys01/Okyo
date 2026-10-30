import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createWaitlistServer } from '../src/server.mjs';
import { openStore } from '../src/store.mjs';
const token = 'test-only-export-key-not-a-real-secret';
const origin = 'https://okyoapp.com';
async function setup(t, options = {}) {
  const store = options.store || openStore(':memory:');
  const server = createWaitlistServer({ store, origins: [origin], adminToken: token, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); store.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    store, url,
    signup: (data, headers = {}) => fetch(`${url}/api/waitlist`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
    }),
    export: (auth = `Bearer ${token}`) => fetch(`${url}/admin/waitlist.csv`, { headers: { Authorization: auth } }),
  };
}
test('signup is durable, normalized, and duplicate email cannot overwrite a name', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'okyo-waitlist-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'test.sqlite');
  const api = await setup(t, { store: openStore(path) });
  assert.equal((await api.signup({ firstName: '  Avery  ', email: ' AVery@Example.com ', consent: true })).status, 201);
  assert.equal((await api.signup({ firstName: 'Replacement', email: 'avery@example.com', consent: true })).status, 201);
  const reopened = openStore(path);
  assert.equal(reopened.all().length, 1);
  assert.equal(reopened.all()[0].first_name, 'Avery');
  assert.equal(reopened.all()[0].email, 'avery@example.com');
  assert.equal(reopened.all()[0].consent_version, 'launch-notification-v1');
  reopened.close();
});
test('rejects invalid fields, absent consent, blocked origins, wrong content types and large bodies', async (t) => {
  const api = await setup(t);
  for (const data of [
    { firstName: '', email: 'a@example.com', consent: true },
    { firstName: 'Avery', email: 'bad', consent: true },
    { firstName: 'Avery', email: 'a@example.com' },
    { firstName: 'Bad\nName', email: 'a@example.com', consent: true },
    { firstName: 'a'.repeat(81), email: 'a@example.com', consent: true },
  ]) assert.equal((await api.signup(data)).status, 400);
  assert.equal((await api.signup({ firstName: 'Avery', email: 'a@example.com', consent: true }, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await api.signup({}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await api.signup({ firstName: 'x'.repeat(3000) })).status, 400);
  assert.equal(api.store.all().length, 0);
});
test('honeypot skips bot entries and CORS allows only configured origins', async (t) => {
  const api = await setup(t);
  const response = await api.signup({ firstName: 'Bot', email: 'bot@example.com', website: 'spam', consent: true });
  assert.equal(response.status, 201);
  assert.equal(api.store.all().length, 0);
  const preflight = await fetch(`${api.url}/api/waitlist`, { method: 'OPTIONS', headers: { Origin: origin } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
});
test('authenticated admin can export and remove; CSV escapes formula-like names', async (t) => {
  const api = await setup(t);
  await api.signup({ firstName: '=HYPERLINK("example")', email: 'a@example.com', consent: true });
  assert.equal((await api.export('')).status, 401);
  const exported = await api.export();
  assert.equal(exported.status, 200);
  assert.equal(exported.headers.get('cache-control'), 'no-store');
  const csv = await exported.text();
  assert.ok(csv.includes("'="));
  assert.ok(csv.includes('""example""'));
  assert.ok(csv.includes('"a@example.com"'));
  assert.equal((await fetch(`${api.url}/admin/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@example.com' }) })).status, 401);
  assert.equal((await fetch(`${api.url}/admin/delete`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@example.com' }) })).status, 200);
  assert.equal(api.store.all().length, 0);
});
test('rate limit expires and storage errors never report success', async (t) => {
  let time = 1000;
  const api = await setup(t, { now: () => time });
  for (let i = 0; i < 10; i++) await api.signup({});
  assert.equal((await api.signup({})).status, 429);
  time += 15 * 60 * 1000;
  assert.equal((await api.signup({ firstName: 'Avery', email: 'a@example.com', consent: true })).status, 201);
  const broken = await setup(t, { store: { add() { throw new Error('Database unavailable'); }, close() {} } });
  const response = await broken.signup({ firstName: 'Avery', email: 'a@example.com', consent: true });
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('Database unavailable'));
});
