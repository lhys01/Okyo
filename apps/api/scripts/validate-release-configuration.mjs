const failures = [];

if (process.env.NODE_ENV !== 'production') fail('NODE_ENV must be production.');
if (process.env.AI_ENABLED !== 'true') fail('AI_ENABLED must be true for a production release preflight.');
if (process.env.PRODUCTION_AI_ENABLED !== 'true') fail('PRODUCTION_AI_ENABLED must be true for a production release preflight.');

const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
if (!isSafeDatabaseUrl(databaseUrl)) fail('DATABASE_URL must be a valid PostgreSQL connection URL.');

const quotaKey = process.env.QUOTA_SCOPE_HMAC_KEY?.trim() ?? '';
if (quotaKey.length < 32) fail('QUOTA_SCOPE_HMAC_KEY must be at least 32 characters.');
for (const [name, fallback] of [
  ['AI_SUBJECT_DAILY_CALL_CAP', 30],
  ['AI_DAILY_REQUEST_CAP', 500],
  ['FABLE_DAILY_REQUEST_CAP', 10],
]) {
  const configured = process.env[name];
  if (configured !== undefined && configured !== '' && !isPositiveCap(configured)) {
    fail(`${name} must be a positive safe integer no greater than 1000000.`);
  } else if (fallback < 1) {
    fail(`${name} has an invalid fallback.`);
  }
}

const providerKey = process.env.OPENROUTER_API_KEY?.trim() ?? '';
if (!providerKey.startsWith('sk-or-v1-') || providerKey.length <= 'sk-or-v1-'.length) {
  fail('OPENROUTER_API_KEY must have the expected production key shape.');
}

const clerkSecret = process.env.CLERK_SECRET_KEY?.trim() ?? '';
if (!clerkSecret.startsWith('sk_live_') || clerkSecret.length <= 'sk_live_'.length) {
  fail('CLERK_SECRET_KEY must have the expected live-key shape.');
}
const parties = (process.env.CLERK_AUTHORIZED_PARTIES ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
if (parties.length === 0 || !parties.every(isAuthorizedParty)) {
  fail('CLERK_AUTHORIZED_PARTIES must contain only exact, valid authorized parties.');
}

if (failures.length > 0) {
  console.error('Okyo API release preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Okyo API release preflight passed without contacting any provider.');
}

function isSafeDatabaseUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'postgres:' || url.protocol === 'postgresql:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isPositiveCap(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 1_000_000;
}

function isAuthorizedParty(value) {
  if (value.includes('*') || value === 'null' || value.length > 512) return false;
  if (/^https:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname) && url.username === '' &&
        url.password === '' && url.pathname === '/' && url.search === '' && url.hash === '';
    } catch {
      return false;
    }
  }
  return /^okyo:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/i.test(value);
}

function fail(message) {
  failures.push(message);
}
