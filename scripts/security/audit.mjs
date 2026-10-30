import { createReadStream, existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, basename, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createGunzip, createBrotliDecompress } from 'node:zlib';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const publicKeys = new Set(['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_POSTHOG_KEY', 'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'EXPO_PUBLIC_REVENUECAT_TEST_KEY']);
const secretName = /(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN|DATABASE_URL|ADMIN_TOKEN|HMAC_KEY|OPENROUTER_API_KEY|PEXELS_API_KEY|SENTRY_AUTH_TOKEN)/i;
const privateFiles = /^(?:\.env(?:\..+)?|\.npmrc|\.netrc|credentials(?:\.json)?|id_rsa|id_ed25519)$/i;
const privateExtensions = new Set(['.pem', '.key', '.p8', '.p12', '.pfx', '.jks', '.keystore', '.mobileprovision', '.sqlite', '.sqlite3']);
const patterns = [
  ['provider-secret', /\b(?:sk-or-v1-[A-Za-z0-9_-]{24,}|sk_(?:live|test)_[A-Za-z0-9]{24,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|sb_secret_[A-Za-z0-9_-]{20,})/g],
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g],
  ['credential-connection-string', /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?):\/\/[^\s:/"'`]+:[^\s@"'`]+@[^\s"'`]+/g],
  ['session-token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{16,}/g],
  ['hardcoded-credential', /(?:["']?\b(?:api[_-]?key|client[_-]?secret|password|access[_-]?token|auth[_-]?token|admin[_-]?token|secret[_-]?key)["']?)\s*[:=]\s*["']([A-Za-z0-9_+/.=-]{20,})["']/gi],
];

export function isUnsafePublicName(name) {
  return /^(?:EXPO_PUBLIC_|NEXT_PUBLIC_|PUBLIC_|VITE_)/.test(name) &&
    (secretName.test(name) || /ADMIN_EMAILS/i.test(name) || (/(?:KEY|TOKEN)/i.test(name) && !publicKeys.has(name)));
}

export function parseEnvironment(contents) {
  return [...contents.matchAll(/^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(?:"([\s\S]*?)"|'([\s\S]*?)'|([^\r\n]*))/gm)]
    .map(match => [match[1], (match[2] ?? match[3] ?? match[4]).replace(/\s+#.*$/, '').trim()]);
}

/** Only identifiers and locations leave this module. Never print matched values. */
export function inspectContent(contents, { path = 'input', secrets = [], artifact = false } = {}) {
  const findings = [];
  const add = (rule, index = 0) => findings.push({ path, line: contents.slice(0, index).split('\n').length, rule });
  for (const [rule, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of contents.matchAll(pattern)) {
      if (rule === 'hardcoded-credential' && /fixture|example|placeholder|replace|your[-_]|mock|test|^[A-Z_]+$/.test(match[1])) continue;
      // Explicit documentation/fixture URLs are inert; real credential URLs fail.
      if (rule === 'credential-connection-string' && /@(?:localhost|127\.0\.0\.1|[^/]*\.(?:invalid|example|test)(?:[:/]|$)|<[^>]+>)/.test(match[0])) continue;
      // Supabase anon/publishable tokens are public only when their decoded role is anon.
      if (rule === 'session-token') {
        try { if (JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url')).role === 'anon') continue; } catch { /* fail closed */ }
      }
      add(rule, match.index);
    }
  }
  for (const secret of secrets) {
    const index = contents.indexOf(secret);
    if (index >= 0) add('known-local-secret', index);
  }
  if (artifact && /(?:[#@]\s*sourceMappingURL\s*=|"sourcesContent"\s*:)/.test(contents)) add('public-source-map');
  return findings;
}

function git(root, args) { return execFileSync('git', ['-C', root, ...args], { maxBuffer: 128 * 1024 * 1024 }); }

export function readLocalSecrets(root, environment = process.env) {
  const secrets = new Set();
  const files = [];
  for (const dir of ['', 'apps/api', 'apps/mobile', 'apps/web', 'apps/waitlist', 'app-store-screenshots']) {
    const directory = resolve(root, dir);
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory)) {
      if (/^\.env(?:\..+)?$/.test(name) && name !== '.env.example') files.push(resolve(directory, name));
    }
  }
  const entries = [...Object.entries(environment), ...files.flatMap(file => parseEnvironment(readFileSync(file, 'utf8')))];
  for (const [name, value] of entries) {
    if (!value) continue;
    if (isUnsafePublicName(name) || secretName.test(name)) {
      // Do not match empty, short, or obvious example values throughout a bundle.
      if (value.length >= 12 && !/^(?:your[-_]|replace[-_]|example|placeholder|<)/i.test(value)) {
        secrets.add(value);
        secrets.add(JSON.stringify(value).slice(1, -1));
      }
    }
  }
  return { secrets: [...secrets], files };
}

function deduplicate(findings) {
  return [...new Map(findings.map(finding => [JSON.stringify(finding), finding])).values()];
}

export async function scanRepository(root = repositoryRoot) {
  const { secrets, files: envFiles } = readLocalSecrets(root);
  const files = git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean);
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    const full = resolve(root, file);
    if (!existsSync(full)) continue;
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) { findings.push({ path: file, rule: 'source-symlink-requires-review' }); continue; }
    if (!stat.isFile()) continue;
    if ((privateFiles.test(basename(file)) && basename(file) !== '.env.example') || privateExtensions.has(extname(file))) {
      findings.push({ path: file, rule: 'private-file-in-source' });
    }
    findings.push(...await scanFile(full, { path: file, secrets }));
    scanned++;
    if (!/\.(?:[cm]?[jt]sx?|astro|json|ya?ml|sh|mjs)$/.test(file)) continue;
    const content = readFileSync(full, 'utf8');
    if (/^(?:apps\/(?:mobile|web)\/|app-store-screenshots\/)/.test(file)) {
      for (const match of content.matchAll(/\b(?:EXPO_PUBLIC_|NEXT_PUBLIC_|PUBLIC_|VITE_)[A-Z0-9_]+/g)) {
        // Definitions of the release policy and its tests can mention rejected names.
        if (isUnsafePublicName(match[0]) && !/(?:releaseEnvironment|\.test\.|validate-release)/.test(file)) {
          findings.push({ path: file, rule: 'unsafe-public-variable-name' });
        }
      }
    }
    if (/^(?:apps\/mobile\/(?:src\/|App\.tsx|index\.ts)|apps\/web\/src\/|app-store-screenshots\/src\/)/.test(file) && !/\.test\./.test(file)) {
      if (/process\.env\.(?:OPENROUTER_API_KEY|CLERK_SECRET_KEY|DATABASE_URL|SENTRY_AUTH_TOKEN|REVENUECAT_SECRET_API_KEY)/.test(content) ||
        /(?:from\s*|import\s*\(|require\s*\()\s*['"][^'"]*(?:apps\/api\/|\.\.\/api\/src\/)/.test(content)) {
        findings.push({ path: file, rule: 'server-secret-or-import-in-client' });
      }
    }
  }
  for (const file of envFiles) {
    for (const [name, value] of parseEnvironment(readFileSync(file, 'utf8'))) {
      if (value && isUnsafePublicName(name)) findings.push({ path: relative(root, file), rule: 'unsafe-public-environment' });
    }
  }
  for (const [name, value] of Object.entries(process.env)) {
    if (value && isUnsafePublicName(name)) findings.push({ path: 'build-environment', rule: 'unsafe-public-environment' });
  }
  return { scanned, findings: deduplicate(findings) };
}

async function scanFile(full, options) {
  let stream = createReadStream(full);
  if (full.endsWith('.gz')) stream = stream.pipe(createGunzip());
  if (full.endsWith('.br')) stream = stream.pipe(createBrotliDecompress());
  const findings = [];
  let tail = '';
  const overlap = Math.max(8192, ...options.secrets.map(value => value.length * 2));
  for await (const chunk of stream) {
    const text = tail + chunk.toString('latin1');
    findings.push(...inspectContent(text, options).map(({ line, ...finding }) => finding));
    // UTF-16 resources can also contain credentials.
    findings.push(...inspectContent(Buffer.from(text, 'latin1').toString('utf16le'), options).map(({ line, ...finding }) => finding));
    tail = text.slice(-overlap);
  }
  return deduplicate(findings);
}

export async function scanArtifacts(paths, root = repositoryRoot) {
  const { secrets } = readLocalSecrets(root);
  const findings = [];
  let scanned = 0;
  async function visit(full) {
    const path = relative(root, full);
    if (!existsSync(full)) throw new Error('Required artifact is missing');
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) { findings.push({ path, rule: 'artifact-symlink' }); return; }
    if (stat.isDirectory()) {
      // React Native copies dependency fonts/icons under assets/node_modules.
      // They are shipped resources; inspect their contents like every file.
      const nativeAssets = /[/\\]assets[/\\]node_modules$/.test(full);
      if (basename(full) === '.git' || (basename(full) === 'node_modules' && !nativeAssets)) findings.push({ path, rule: 'private-directory-in-artifact' });
      for (const entry of readdirSync(full)) await visit(resolve(full, entry));
    } else if (stat.isFile()) {
      scanned++;
      // Turbopack emits an empty map container even with browser maps disabled.
      // Permit only that exact empty structure, never source-bearing maps.
      let emptyMap = false;
      if (/\.map$/i.test(full) && stat.size < 1024) {
        try {
          const map = JSON.parse(readFileSync(full, 'utf8'));
          emptyMap = map.version === 3 && Array.isArray(map.sources) && map.sources.length === 0 &&
            Array.isArray(map.sections) && map.sections.length === 0 &&
            Object.keys(map).every(key => ['version', 'sources', 'sections'].includes(key));
        } catch { /* non-JSON maps fail closed */ }
      }
      // Apple's public distribution profile is required inside a signed app.
      // The signing private key/keychain is never part of that profile.
      const embeddedProfile = /\.app[/\\]embedded\.mobileprovision$/.test(full);
      if (privateFiles.test(basename(full)) || (privateExtensions.has(extname(full)) && !embeddedProfile) || (/\.map$/i.test(full) && !emptyMap)) {
        findings.push({ path, rule: 'private-file-in-artifact' });
      }
      if (/\.(?:zip|ipa|apk|aab|tgz|tar)$/i.test(full)) throw new Error('Extract packaged artifacts before scanning');
      findings.push(...await scanFile(full, { path, secrets, artifact: true }));
    }
  }
  for (const path of paths) {
    const before = scanned;
    await visit(resolve(root, path));
    if (scanned === before) throw new Error('Required artifact has no files');
  }
  return { scanned, findings: deduplicate(findings) };
}

export function scanHistory(root = repositoryRoot) {
  const objects = git(root, ['rev-list', '--objects', '--all']).toString().trim().split('\n');
  const findings = [];
  const { secrets } = readLocalSecrets(root);
  let scanned = 0;
  for (const object of objects) {
    const [sha, ...parts] = object.split(' ');
    const path = parts.join(' ');
    if (!path) continue;
    if (git(root, ['cat-file', '-t', sha]).toString().trim() !== 'blob') continue;
    const contents = git(root, ['cat-file', 'blob', sha]).toString('latin1');
    scanned++;
    // Return object IDs, never historic content or credentials.
    findings.push(...inspectContent(contents, { path: `git-object:${sha}`, secrets }));
    if ((privateFiles.test(basename(path)) && basename(path) !== '.env.example') || privateExtensions.has(extname(path))) {
      findings.push({ path: `git-object:${sha}`, rule: 'historic-private-file' });
    }
  }
  return { scanned, findings: deduplicate(findings) };
}

async function main() {
  const args = process.argv.slice(2);
  let result;
  if (args.length === 0) result = await scanRepository();
  else if (args.length === 1 && args[0] === '--history') result = scanHistory();
  else if (args[0] === '--artifacts' && args.length > 1) result = await scanArtifacts(args.slice(1).map(path => resolve(path)));
  else throw new Error('Usage: audit.mjs [--history | --artifacts path ...]');
  console.log(JSON.stringify({ scope: args[0] ?? 'source-and-environment', ...result }, null, 2));
  if (result.findings.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Security audit could not complete; release blocked. Check artifact paths and scanner inputs.'); process.exitCode = 1; });
}
