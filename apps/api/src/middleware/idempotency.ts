import { createHash } from 'node:crypto';

import { getRuntimeSafetyConfig } from '../config/runtimeSafety.js';
import { metrics } from '../observability/metrics.js';
import { getRequestContext } from '../observability/requestContext.js';

type Outcome<T> = { fingerprint: string; expiresAt: number; promise: Promise<T> };

const entries = new Map<string, Outcome<unknown>>();

export class IdempotencyConflictError extends Error {
  constructor() {
    super('An idempotency key was reused for a different request.');
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Coalesces an ambiguous mobile retry with its original operation. This is a
 * bounded process-local safety net. Production must replace it with the shared
 * idempotency table described in the performance architecture document.
 */
export async function executeIdempotent<T>(input: {
  key: string | undefined;
  scope: string;
  fingerprintSource: unknown;
  operation: () => Promise<T>;
}): Promise<T> {
  if (!input.key || !isValidKey(input.key)) return input.operation();
  const config = getRuntimeSafetyConfig();
  const now = Date.now();
  prune(now, config.idempotencyMaxEntries);
  const scopedKey = `${input.scope}:${input.key}`;
  const fingerprint = fingerprintRequest(input.fingerprintSource);
  const existing = entries.get(scopedKey) as Outcome<T> | undefined;
  if (existing && existing.expiresAt > now) {
    if (existing.fingerprint !== fingerprint) throw new IdempotencyConflictError();
    metrics.increment('okyo_idempotency_replay_total', { state: 'hit' });
    return existing.promise;
  }

  const promise = input.operation();
  entries.set(scopedKey, {
    fingerprint,
    expiresAt: now + config.idempotencyTtlMs,
    promise,
  });
  metrics.increment('okyo_idempotency_replay_total', { state: 'miss' });
  try {
    return await promise;
  } catch (error) {
    // A brief failure entry avoids a network retry immediately buying the same
    // provider call twice. It is still evicted well before the normal TTL.
    const entry = entries.get(scopedKey);
    if (entry) entry.expiresAt = Math.min(entry.expiresAt, Date.now() + 15_000);
    throw error;
  }
}

export function idempotencyScope(anonId: string | null, clientIp: string): string {
  const ownerKey = getRequestContext()?.ownerKey;
  if (ownerKey?.startsWith('user:')) {
    return `user:${createHash('sha256').update(ownerKey).digest('hex')}`;
  }
  return anonId ? `anon:${anonId}` : `ip:${clientIp}`;
}

export function clearUserIdempotencyCache(userId: string): void {
  const prefix = `user:${createHash('sha256').update(`user:${userId}`).digest('hex')}:`;
  const failures: unknown[] = [];
  for (const key of entries.keys()) {
    if (!key.startsWith(prefix)) continue;
    try { entries.delete(key); } catch (error) { failures.push(error); }
  }
  if (failures.length > 0) throw new Error('User request cache cleanup did not fully complete.');
}

function fingerprintRequest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isValidKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

function prune(now: number, maxEntries: number): void {
  for (const [key, value] of entries) {
    if (value.expiresAt <= now) entries.delete(key);
  }
  while (entries.size >= maxEntries) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

export function resetIdempotencyForTests(): void {
  entries.clear();
}
