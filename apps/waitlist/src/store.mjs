import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const CONSENT_VERSION = 'launch-notification-v1';

export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS waitlist (
      email TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      consent_version TEXT NOT NULL
    );
  `);
  const insert = db.prepare('INSERT INTO waitlist (email, first_name, joined_at, consent_version) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING');
  return {
    add({ email, firstName }) { insert.run(email, firstName, new Date().toISOString(), CONSENT_VERSION); },
    all() { return db.prepare('SELECT first_name, email, joined_at, consent_version FROM waitlist ORDER BY joined_at, email').all(); },
    remove(email) { return db.prepare('DELETE FROM waitlist WHERE email = ?').run(email); },
    healthy() { db.prepare('SELECT 1 FROM waitlist LIMIT 1').all(); return true; },
    close() { db.close(); },
  };
}

function csvCell(value) {
  // Spreadsheet programs must treat names/emails as text, never formulas.
  let text = String(value);
  if (/^\s*[=+@-]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportCsv(rows) {
  const header = ['first_name', 'email', 'joined_at', 'consent_version'];
  return [header, ...rows.map((row) => header.map((key) => row[key]))]
    .map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
