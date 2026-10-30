import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openStore, exportCsv } from './store.mjs';

const WINDOW_MS = 15 * 60 * 1000;
const adminHtml = readFileSync(new URL('./admin.html', import.meta.url));
const adminJs = readFileSync(new URL('./admin.js', import.meta.url));

function validSignup(value) {
  if (!value || typeof value !== 'object') return null;
  const { email, firstName, consent } = value;
  if (consent !== true || typeof email !== 'string' || typeof firstName !== 'string') return null;
  const normalized = { email: email.trim().toLowerCase(), firstName: firstName.trim() };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized.email) || normalized.email.length > 254) return null;
  if (!normalized.firstName || normalized.firstName.length > 80 || /[\u0000-\u001f\u007f]/u.test(normalized.firstName)) return null;
  return normalized;
}

function authorized(request, token) {
  if (!token || token.length < 32) return false;
  const hash = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(request.headers.authorization || ''), hash(`Bearer ${token}`));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 2048) throw new Error('Body too large');
  }
  return JSON.parse(body);
}

export function createWaitlistServer({ store, origins, adminToken, trustProxy = false, now = Date.now }) {
  const limits = new Map();
  function rateLimited(request) {
    const address = trustProxy
      ? String(request.headers['x-forwarded-for'] || request.socket.remoteAddress).split(',').at(-1).trim()
      : request.socket.remoteAddress;
    const time = now();
    for (const [key, item] of limits) if (time >= item.reset) limits.delete(key);
    if (!limits.has(address) && limits.size >= 10000) return true;
    const entry = limits.get(address) || { count: 0, reset: time + WINDOW_MS };
    entry.count += 1;
    limits.set(address, entry);
    return entry.count > 10;
  }

  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    const json = (code, body) => {
      response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(body));
    };
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      if (request.method === 'GET' && path === '/health') {
        store.healthy();
        return json(200, { ok: true });
      }
      if (request.method === 'GET' && (path === '/admin' || path === '/admin.js')) {
        response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        response.writeHead(200, { 'Content-Type': path === '/admin' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' });
        return response.end(path === '/admin' ? adminHtml : adminJs);
      }
      if (path.startsWith('/admin/')) {
        if (rateLimited(request)) return json(429, { error: 'Try again later.' });
        if (!authorized(request, adminToken)) return json(401, { error: 'Export key required.' });
        if (request.method === 'GET' && path === '/admin/waitlist.csv') {
          response.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="okyo-waitlist.csv"',
          });
          return response.end(exportCsv(store.all()));
        }
        if (request.method === 'POST' && path === '/admin/delete') {
          const body = await readBody(request);
          if (typeof body.email !== 'string' || body.email.length > 254) return json(400, { error: 'Email required.' });
          store.remove(body.email.trim().toLowerCase());
          return json(200, { ok: true });
        }
      }
      if (path !== '/api/waitlist') return json(404, { error: 'Not found.' });
      const origin = request.headers.origin;
      if (origin && !origins.includes(origin)) return json(403, { error: 'This website is not allowed.' });
      if (origin) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
      }
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600',
        });
        return response.end();
      }
      if (request.method !== 'POST') return json(405, { error: 'Use POST.' });
      if (rateLimited(request)) {
        response.setHeader('Retry-After', '900');
        return json(429, { error: 'Please wait a little and try again.' });
      }
      if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) return json(415, { error: 'Use JSON.' });
      let body;
      try { body = await readBody(request); }
      catch { return json(400, { error: 'Check your name and email and try again.' }); }
      // Honeypot: bots get the same response, but nothing is stored.
      if (typeof body?.website === 'string' && body.website) return json(201, { ok: true });
      const signup = validSignup(body);
      if (!signup) return json(400, { error: 'Add your first name, a valid email, and permission to email you.' });
      store.add(signup);
      // Do not reveal whether an address was already on the list.
      return json(201, { ok: true });
    } catch {
      return json(503, { error: 'The waitlist is taking a break. Please try again shortly.' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.env.WAITLIST_DATABASE_PATH || './data/waitlist.sqlite';
  if (process.env.NODE_ENV === 'production' && (!process.env.WAITLIST_ADMIN_TOKEN || process.env.WAITLIST_ADMIN_TOKEN.length < 32 || !process.env.WAITLIST_DATABASE_PATH?.startsWith('/data/'))) {
    throw new Error('Configure WAITLIST_ADMIN_TOKEN and a persistent /data database before starting.');
  }
  const store = openStore(path);
  const origins = (process.env.WAITLIST_ALLOWED_ORIGINS || 'http://localhost:4391,http://127.0.0.1:4391,http://localhost:4321,http://127.0.0.1:4321,http://localhost:4387,http://127.0.0.1:4387').split(',').map((value) => value.trim());
  const server = createWaitlistServer({ store, origins, adminToken: process.env.WAITLIST_ADMIN_TOKEN, trustProxy: process.env.TRUST_PROXY === '1' });
  server.listen(Number(process.env.PORT || 4392), '0.0.0.0', () => console.log('Okyo waitlist is ready.'));
  const stop = () => server.close(() => { store.close(); process.exit(0); });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
