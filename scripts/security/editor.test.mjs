import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rejectCrossSiteWrite, readBoundedJson, rejectNonLocalRequest } from '../../app-store-screenshots/src/lib/request-guard.ts';

test('editor writes accept only the same local origin and exact JSON media type', () => {
  const request = (url = 'http://localhost:3000/api/project', headers = {}) => new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' });
  assert.equal(rejectCrossSiteWrite(request()), null);
  assert.equal(rejectCrossSiteWrite(request(undefined, { origin: 'http://localhost:3000' })), null);
  assert.equal(rejectCrossSiteWrite(request('https://editor.production.com/api/project')).status, 403);
  for (const origin of ['https://attacker.invalid', 'http://localhost:8080', 'null']) assert.equal(rejectCrossSiteWrite(request(undefined, { origin })).status, 403);
  for (const type of ['text/plain', 'application/json-malicious']) assert.equal(rejectCrossSiteWrite(request(undefined, { 'content-type': type })).status, 415);
  assert.equal(rejectCrossSiteWrite(request(undefined, { 'sec-fetch-site': 'cross-site' })).status, 403);
});

test('editor bounds actual body bytes, including requests without Content-Length', async () => {
  const request = body => new Request('http://localhost:3000/api/project', { method: 'POST', body });
  assert.deepEqual(await readBoundedJson(request('{"ok":true}'), 30), { ok: true });
  await assert.rejects(readBoundedJson(request('a'.repeat(100)), 20));
  await assert.rejects(readBoundedJson(request('invalid JSON'), 30));
});

test('editor project reads reject remote and DNS-rebinding hostnames', () => {
  assert.equal(rejectNonLocalRequest(new Request('http://localhost:3000/api/project')), null);
  assert.equal(rejectNonLocalRequest(new Request('http://rebind.attacker.invalid:3000/api/project')).status, 403);
});
