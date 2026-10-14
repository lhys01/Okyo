import { createHmac } from 'node:crypto';

import { database } from './database.js';

/** Removes only durable state owned by the verified Clerk user. */
export async function deleteRuntimeOwner(userId: string): Promise<void> {
  const key = process.env.QUOTA_SCOPE_HMAC_KEY;
  if (!key || key.length < 32) throw new Error('Secure runtime scope unavailable');
  const owner = createHmac('sha256', key).update(`user:${userId}`).digest('hex');
  await database().query(`WITH deleted_runtime AS (
    DELETE FROM okyo_private.okyo_runtime WHERE owner=$1 RETURNING owner
  )
  DELETE FROM okyo_private.okyo_quota
  WHERE bucket=$2`, [owner, `subject:${owner}`]);
}
