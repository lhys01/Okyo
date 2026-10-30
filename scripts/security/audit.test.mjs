import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { inspectContent, isUnsafePublicName, parseEnvironment, scanArtifacts, scanRepository, scanHistory } from './audit.mjs';

const key = () => ['sk', 'or', 'v1', randomBytes(24).toString('hex')].join('-');
function sandbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'okyo-security-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('credential findings contain only a rule and location, never matched values', () => {
  const secret = key();
  const findings = inspectContent(`line one\n${secret}`, { path: 'bundle.js' });
  assert.equal(findings[0].rule, 'provider-secret');
  assert.equal(findings[0].line, 2);
  assert.ok(!JSON.stringify(findings).includes(secret));
  assert.ok(inspectContent('an-opaque-secret', { secrets: ['an-opaque-secret'] }).some(f => f.rule === 'known-local-secret'));
});

test('private keys, service JWTs and credentialed database URLs fail', () => {
  const pem = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const jwt = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from('{"role":"service_role"}').toString('base64url')}.${'a'.repeat(40)}`;
  for (const contents of [pem, jwt, 'postgresql://' + 'runtime:opaque-password@db.production.com/okyo']) assert.ok(inspectContent(contents).length);
  const anon = `${jwt.split('.')[0]}.${Buffer.from('{"role":"anon"}').toString('base64url')}.${'a'.repeat(40)}`;
  assert.deepEqual(inspectContent(anon), []);
});

test('public SDK keys remain allowed while secret variable names fail', () => {
  for (const name of ['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', 'EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'EXPO_PUBLIC_POSTHOG_KEY']) assert.equal(isUnsafePublicName(name), false);
  for (const name of ['EXPO_PUBLIC_OPENROUTER_API_KEY', 'NEXT_PUBLIC_SECRET', 'VITE_ACCESS_TOKEN', 'PUBLIC_DATABASE_URL', 'EXPO_PUBLIC_OKYO_ADMIN_EMAILS', 'EXPO_PUBLIC_UNREVIEWED_KEY']) assert.equal(isUnsafePublicName(name), true);
});

test('dotenv parsing handles quoted multiline private values without displaying them', () => {
  assert.deepEqual(parseEnvironment('export FIRST="a\nb"\nSECOND=hello # comment\nTHIRD=\' x \'\n'), [['FIRST', 'a\nb'], ['SECOND', 'hello'], ['THIRD', 'x']]);
});

test('empty dotenv values do not consume the next assignment or comment', () => {
  assert.deepEqual(
    parseEnvironment('EXPO_PUBLIC_OKYO_ADMIN_EMAILS=  \r\nNEXT=false\r\nEMPTY=\n# comment\nLAST=ok\n'),
    [['EXPO_PUBLIC_OKYO_ADMIN_EMAILS', ''], ['NEXT', 'false'], ['EMPTY', ''], ['LAST', 'ok']],
  );
});

test('missing, empty, and packaged artifact inputs block release', async t => {
  const root = sandbox(t);
  await assert.rejects(scanArtifacts(['missing'], root));
  mkdirSync(join(root, 'empty'));
  await assert.rejects(scanArtifacts(['empty'], root));
  writeFileSync(join(root, 'release.ipa'), 'zip');
  await assert.rejects(scanArtifacts(['release.ipa'], root));
});

test('artifact scans detect maps, inline maps, private files, and symlinks', async t => {
  const root = sandbox(t);
  mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'dist/app.js'), '//# sourceMappingURL=data:application/json;base64,e30=');
  writeFileSync(join(root, 'dist/app.js.map'), '{}');
  writeFileSync(join(root, 'dist/.env.production'), 'PRIVATE=not-allowed');
  symlinkSync(join(root, 'dist/app.js'), join(root, 'dist/link.js'));
  const result = await scanArtifacts(['dist'], root);
  assert.ok(result.findings.some(f => f.rule === 'public-source-map'));
  assert.ok(result.findings.some(f => f.rule === 'private-file-in-artifact'));
  assert.ok(result.findings.some(f => f.rule === 'artifact-symlink'));
});

test('artifact scans inspect compressed, UTF-16, binary and chunk-boundary secrets', async t => {
  const root = sandbox(t);
  mkdirSync(join(root, 'dist'));
  const secret = key();
  writeFileSync(join(root, 'dist/a.js.gz'), gzipSync(secret));
  writeFileSync(join(root, 'dist/b.js.br'), brotliCompressSync(secret));
  writeFileSync(join(root, 'dist/c.bin'), Buffer.from(secret, 'utf16le'));
  writeFileSync(join(root, 'dist/d.hbc'), Buffer.concat([Buffer.alloc(65520), Buffer.from(secret)]));
  const result = await scanArtifacts(['dist'], root);
  for (const file of ['a.js.gz', 'b.js.br', 'c.bin', 'd.hbc']) assert.ok(result.findings.some(f => f.path.endsWith(file)), file);
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('opaque local secrets are compared to client output, while public identifiers pass', async t => {
  const root = sandbox(t);
  const secret = randomBytes(32).toString('hex');
  writeFileSync(join(root, '.env'), `CUSTOM_SECRET=${secret}`);
  mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'dist/app.js'), secret);
  assert.ok((await scanArtifacts(['dist'], root)).findings.some(f => f.rule === 'known-local-secret'));
  writeFileSync(join(root, 'dist/app.js'), 'pk_live_public_identifier appl_public_sdk_key');
  assert.deepEqual((await scanArtifacts(['dist'], root)).findings, []);
});

test('source and all reachable Git history are scanned even after a credential is removed', async t => {
  const root = sandbox(t);
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  git('init'); git('config', 'user.email', 'audit@example.invalid'); git('config', 'user.name', 'Audit test');
  const secret = key();
  writeFileSync(join(root, 'app.js'), secret);
  git('add', 'app.js'); git('commit', '-m', 'test fixture');
  writeFileSync(join(root, 'app.js'), 'safe');
  git('add', 'app.js'); git('commit', '-m', 'remove fixture');
  assert.deepEqual((await scanRepository(root)).findings, []);
  const result = scanHistory(root);
  assert.ok(result.findings.some(f => f.rule === 'provider-secret'));
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('empty Turbopack maps and required native resources are allowed without skipping their contents', async t => {
  const root = sandbox(t);
  mkdirSync(join(root, 'Okyo.app/assets/node_modules/icons'), { recursive: true });
  writeFileSync(join(root, 'Okyo.app/embedded.mobileprovision'), 'public provisioning profile');
  writeFileSync(join(root, 'Okyo.app/assets/node_modules/icons/icon.png'), 'image');
  writeFileSync(join(root, 'Okyo.app/empty.js.map'), JSON.stringify({ version: 3, sources: [], sections: [] }));
  assert.deepEqual((await scanArtifacts(['Okyo.app'], root)).findings, []);
  writeFileSync(join(root, 'Okyo.app/assets/node_modules/icons/icon.png'), key());
  assert.ok((await scanArtifacts(['Okyo.app'], root)).findings.some(f => f.rule === 'provider-secret'));
  writeFileSync(join(root, 'Okyo.app/empty.js.map'), JSON.stringify({ version: 3, sources: ['secret.ts'], sections: [] }));
  assert.ok((await scanArtifacts(['Okyo.app'], root)).findings.some(f => f.rule === 'private-file-in-artifact'));
});
