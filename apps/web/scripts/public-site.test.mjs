import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { request } from 'node:http';
import { createPublicSiteServer } from './serve-public-site.mjs';
let server, origin;
before(async () => { server = createPublicSiteServer(); await new Promise(done => server.listen(0, '127.0.0.1', done)); origin = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); });
test('all four legal/support pages have clean URLs and no launch or draft campaign', async () => {
  for (const path of ['/privacy', '/terms', '/support', '/delete-account']) {
    const response = await fetch(origin + path); assert.equal(response.status, 200, path);
    const html = await response.text(); assert.match(response.headers.get('content-type'), /text\/html/);
    assert.doesNotMatch(html, /coming soon|data-draft="legal"|data-open-waitlist|id="waitlist-dialog"|prototype|sample account|not implemented|test build/i);
  }
});
test('www and HTML aliases have one canonical redirect preserving the path', async () => {
  const www = await new Promise((done, reject) => {
    const req = request(origin + '/privacy?source=site', { headers: { host: 'www.okyoapp.com' } }, response => { response.resume(); done({ status: response.statusCode, location: response.headers.location }); });
    req.on('error', reject); req.end();
  });
  assert.equal(www.status, 308); assert.equal(www.location, 'https://okyoapp.com/privacy?source=site');
  const html = await fetch(origin + '/terms.html', { redirect: 'manual' }); assert.equal(html.status, 308); assert.equal(html.headers.get('location'), '/terms');
});
test('missing files return 404 and uploads cannot write to the public site', async () => {
  assert.equal((await fetch(origin + '/missing-page')).status, 404);
  assert.equal((await fetch(origin + '/privacy', { method: 'POST', body: 'ignored' })).status, 405);
  assert.equal((await fetch(origin + '/health')).status, 200);
});
