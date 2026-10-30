import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.argv[2] || fileURLToPath(new URL(`../../mobile/.artifacts/website-publication-${Date.now()}`, import.meta.url)));
await mkdir(output); // Never replace or remove an existing deployment package.
await mkdir(`${output}/dist`);
for (const page of ['privacy', 'terms', 'support', 'delete-account']) {
  const html = await readFile(`${web}dist/${page}.html`, 'utf8');
  if (/coming soon|data-draft="legal"|data-open-waitlist|id="waitlist-dialog"|prototype|sample account|not implemented|test build/i.test(html)) throw new Error(`Publication copy check failed: ${page}`);
  if (page === 'privacy' && html.includes('Website launch waitlist')) throw new Error('Build with PUBLIC_LEGAL_ONLY=true before preparing the legal publication.');
  await copyFile(`${web}dist/${page}.html`, `${output}/dist/${page}.html`);
}
await cp(`${web}dist/_astro`, `${output}/dist/_astro`, { recursive: true });
await copyFile(`${web}dist/okyo-icon.png`, `${output}/dist/okyo-icon.png`);
await writeFile(`${output}/dist/index.html`, '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Okyo · Cooking made easier</title><h1>Okyo</h1><p>Cooking made easier.</p><nav><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/support">Support</a> · <a href="/delete-account">Account deletion</a></nav></html>');
await mkdir(`${output}/scripts`);
await copyFile(`${web}scripts/serve-public-site.mjs`, `${output}/scripts/serve-public-site.mjs`);
await writeFile(`${output}/package.json`, JSON.stringify({ name: 'okyo-public-legal-site', private: true, type: 'module', scripts: { start: 'node scripts/serve-public-site.mjs' } }, null, 2));
await writeFile(`${output}/Dockerfile`, 'FROM node:22-bookworm-slim\nWORKDIR /app\nCOPY dist ./dist\nCOPY scripts ./scripts\nENV NODE_ENV=production\nENV WEB_ROOT=/app/dist\nEXPOSE 8080\nUSER node\nCMD ["node", "scripts/serve-public-site.mjs"]\n');
await writeFile(`${output}/railway.json`, JSON.stringify({ build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' }, deploy: { healthcheckPath: '/health', healthcheckTimeout: 30, restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 3 } }, null, 2));
console.log(`Legal-only publication package prepared: ${output}`);
