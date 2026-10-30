import { createHash } from 'node:crypto';
import { database } from './database.js';
import { ownerScope, persistentPayload } from './runtimeStore.js';

export class DurableRequestPendingError extends Error {
  constructor() { super('This request is already processing or its outcome is uncertain.'); this.name = 'DurableRequestPendingError'; }
}
export class DurableRequestConflictError extends Error {
  constructor() { super('Request key already used for different input.'); this.name = 'DurableRequestConflictError'; }
}

/** No automatic lease takeover: a dead worker may have already spent provider tokens. */
export async function executeDurableRequest<T>(input: { key: string; fingerprintSource: unknown; operation: () => Promise<T> }): Promise<T> {
  const fingerprint = createHash('sha256').update(JSON.stringify(input.fingerprintSource)).digest('hex');
  const owner = ownerScope();
  const claim = await database().query(`INSERT INTO okyo_private.okyo_runtime(kind,id,owner,payload,expires_at)
    VALUES('request',$1,$2,$3,now()+interval '1 day') ON CONFLICT DO NOTHING RETURNING id`,
  [input.key, owner, JSON.stringify({ fingerprint, state: 'pending' })]);
  if (!claim.rows.length) {
    const found = await database().query("SELECT payload FROM okyo_private.okyo_runtime WHERE kind='request' AND id=$1 AND owner=$2", [input.key, owner]);
    const value = found.rows[0]?.payload;
    if (value?.fingerprint !== fingerprint) throw new DurableRequestConflictError();
    if (value?.state !== 'complete') throw new DurableRequestPendingError();
    return value.result as T;
  }
  // Failure keeps the claim. A user-initiated retry needs a new key, and every
  // new provider attempt still consumes shared quota. Never retry automatically.
  const result = await input.operation();
  await database().query("UPDATE okyo_private.okyo_runtime SET payload=$3 WHERE kind='request' AND id=$1 AND owner=$2",
    [input.key, owner, JSON.stringify({ fingerprint, state: 'complete', result: persistentPayload(result) })]);
  return result;
}
