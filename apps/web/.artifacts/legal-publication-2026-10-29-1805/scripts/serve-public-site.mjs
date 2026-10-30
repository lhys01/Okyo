import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
export function createPublicSiteServer(root = fileURLToPath(new URL('../dist/', import.meta.url))) {
  const base = resolve(root);
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405); response.end(); return; }
    try {
      const url = new URL(request.url ?? '/', 'https://okyoapp.com');
      const hostname = (request.headers.host ?? '').split(':')[0].toLowerCase();
      if (hostname === 'www.okyoapp.com') {
        response.writeHead(308, { Location: `https://okyoapp.com${url.pathname}${url.search}` }); response.end(); return;
      }
      if (url.pathname === '/health') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(request.method === 'HEAD' ? undefined : '{"status":"ok"}'); return; }
      const clean = url.pathname.replace(/\.html$/, '').replace(/\/$/, '');
      if (url.pathname !== '/' && clean !== url.pathname) {
        response.writeHead(308, { Location: `${clean || '/'}${url.search}` }); response.end(); return;
      }
      const pathname = decodeURIComponent(url.pathname);
      // A misplaced build/debug file must never become a public download.
      if (pathname.split('/').some(part => part.startsWith('.')) || !Object.hasOwn(types, extname(pathname) || '.html')) {
        response.writeHead(404); response.end(); return;
      }
      const filename = resolve(base, `.${pathname === '/' ? '/index.html' : extname(pathname) ? pathname : `${pathname}.html`}`);
      if (!filename.startsWith(base + sep)) { response.writeHead(404); response.end(); return; }
      const [actualBase, actualFile] = await Promise.all([realpath(base), realpath(filename)]);
      if (!actualFile.startsWith(actualBase + sep)) { response.writeHead(404); response.end(); return; }
      const bytes = await readFile(filename);
      response.writeHead(200, { 'Content-Type': types[extname(filename)] ?? 'application/octet-stream', 'Cache-Control': filename.includes(`${sep}_astro${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : '<!doctype html><title>Not found · Okyo</title><h1>Page not found</h1><a href="/support">Okyo support</a>');
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createPublicSiteServer(process.env.WEB_ROOT).listen(Number(process.env.PORT || 8080), '0.0.0.0');
}
