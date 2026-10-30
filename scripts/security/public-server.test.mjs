import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPublicSiteServer } from '../../apps/web/scripts/serve-public-site.mjs';

test('public server blocks misplaced credentials, source maps, dotfiles, and escaping symlinks', async t => {
  const root = mkdtempSync(join(tmpdir(), 'okyo-public-'));
  const outside = mkdtempSync(join(tmpdir(), 'okyo-private-'));
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); });
  for (const file of ['.env', '.env.production', 'app.js.map', 'database.sqlite', 'key.pem', 'credentials.json']) writeFileSync(join(root, file), 'must never be served');
  writeFileSync(join(root, 'index.html'), '<h1>Okyo</h1>');
  writeFileSync(join(outside, 'private.html'), 'must never be served');
  symlinkSync(join(outside, 'private.html'), join(root, 'escape.html'));
  const server = createPublicSiteServer(root);
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin)).status, 200);
  for (const path of ['/.env', '/.env.production', '/app.js.map', '/database.sqlite', '/key.pem', '/credentials.json', '/escape.html', '/%2eenv']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 404, path);
    assert.ok(!(await response.text()).includes('must never be served'));
  }
});
