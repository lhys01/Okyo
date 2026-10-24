// Launch gate. Exits non-zero while anything that must be resolved before a
// public launch is still in the built site. Expected to FAIL today:
//   - draft legal pages (D5)          - pending deletion-process text (D16)
//   - legal entity placeholder (D10)  - screenshot placeholders (D14)
// Run after `npm run build`: npm run check:launch
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

const BLOCKERS = [
  { pattern: /data-draft="legal"/, reason: 'Legal page is still an unapproved draft (D5)' },
  { pattern: /name="robots" content="noindex/, reason: 'Page is marked noindex', allow: ['404.html'] },
  { pattern: /Legal entity — pending legal review/, reason: 'Legal entity placeholder in footer (D10)' },
  { pattern: /data-placeholder="screenshot"/, reason: 'Screenshot placeholder (D14)' },
  { pattern: /data-waitlist-unconfigured="true"/, reason: 'Waitlist storage URL is not configured' },
  { pattern: /data-pending="legal-review"/, reason: 'Text pending legal review (D16)' },
];

function findBlockers(files) {
  return files.flatMap(({ name, html }) =>
    BLOCKERS.filter((b) => !b.allow?.includes(name) && b.pattern.test(html)).map((b) => `${name}: ${b.reason}`),
  );
}

const EXPECTED_PAGES = 6; // index, privacy, terms, support, delete-account, 404

if (!existsSync(DIST)) {
  console.error('No dist/ folder. Run `npm run build` first.');
  process.exit(1);
}

// Not checked here, needs a human: D11 mascot/icon ownership, D9 hosting choice.
const files = readdirSync(DIST)
  .filter((name) => name.endsWith('.html'))
  .map((name) => ({ name, html: readFileSync(DIST + name, 'utf8') }));
if (files.length < EXPECTED_PAGES) {
  console.error(`Expected ${EXPECTED_PAGES} pages in dist/, found ${files.length}. Rebuild and retry.`);
  process.exit(1);
}
const problems = findBlockers(files);

if (problems.length) {
  console.error(`NOT READY TO LAUNCH (${problems.length} blocker(s)):\n- ${problems.join('\n- ')}`);
  console.error('\nAlso confirm by hand: mascot/app icon ownership (D11) and hosting plan (D9).');
  process.exit(1);
}
console.log('No automated launch blockers found. Still confirm D9 and D11 by hand.');
