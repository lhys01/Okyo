import { createHmac } from 'node:crypto';
import { database } from './database.js';
import { getRequestContext } from '../observability/requestContext.js';

export function ownerScope(): string {
  const key = process.env.QUOTA_SCOPE_HMAC_KEY;
  const owner = getRequestContext()?.ownerKey;
  if (!key || key.length < 32 || !owner) throw new Error('Secure request scope unavailable');
  return createHmac('sha256', key).update(owner).digest('hex');
}

/** Temporary recipe/analysis state never persists uploaded images or credentials. */
export function persistentPayload(value: unknown): any {
  if (Array.isArray(value)) return value.map(persistentPayload);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) =>
      !/^(config|image|imageUri|imageUrl|imageData|dataUrl|base64|authorization|token|apiKey|openRouterApiKey)$/i.test(key)
    ).map(([key, entry]) => [key, persistentPayload(entry)]));
  }
  if (typeof value === 'string' && /^(data:|file:|content:)/i.test(value)) return undefined;
  return value;
}

export async function putRuntime(kind: string, id: string, value: unknown, ttlMs: number): Promise<void> {
  await database().query(`INSERT INTO okyo_private.okyo_runtime(kind,id,owner,payload,expires_at)
    VALUES($1,$2,$3,$4,now()+$5::double precision*interval '1 millisecond')
    ON CONFLICT(kind,id,owner) DO UPDATE SET payload=excluded.payload, expires_at=excluded.expires_at`,
  [kind, id, ownerScope(), JSON.stringify(persistentPayload(value)), ttlMs]);
}
export async function getRuntime<T>(kind: string, id: string): Promise<T | null> {
  const result = await database().query('SELECT payload FROM okyo_private.okyo_runtime WHERE kind=$1 AND id=$2 AND owner=$3 AND expires_at>now()',
    [kind, id, ownerScope()]);
  return result.rows[0]?.payload ?? null;
}
export async function deleteRuntimeOwner(): Promise<void> {
  const owner = ownerScope();
  // One statement removes both kinds of user-scoped durable state. The
  // shared/global quota bucket is deliberately untouched.
  await database().query(`WITH deleted_runtime AS (
    DELETE FROM okyo_private.okyo_runtime WHERE owner=$1 RETURNING owner
  ) DELETE FROM okyo_private.okyo_quota WHERE bucket=$2`, [owner, `subject:${owner}`]);
}
