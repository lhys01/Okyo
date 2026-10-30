import { randomUUID } from 'node:crypto';
import { database } from '../persistence/database.js';
import { ownerScope } from '../persistence/runtimeStore.js';
import type { SharedAiQuotaStore } from './sharedAiQuota.js';

export function positiveLimit(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 1_000_000) throw new Error('Invalid quota limit');
  return number;
}

export const postgresAiQuota: SharedAiQuotaStore = {
  async reserveGlobalDaily({ key, limit, model }) {
    const limits: Array<[string, number]> = [
      [key, limit],
      [`subject:${ownerScope()}`, positiveLimit(process.env.AI_SUBJECT_DAILY_CALL_CAP, 30)],
    ];
    if (model === 'anthropic/claude-fable-5') limits.push(['model:fable', positiveLimit(process.env.FABLE_DAILY_REQUEST_CAP, 10)]);
    limits.sort(([a], [b]) => a.localeCompare(b));
    const result = await database().query('SELECT okyo_private.okyo_reserve_quota($1::text[],$2::integer[]) AS reserved',
      [limits.map(([bucket]) => bucket), limits.map(([, cap]) => cap)]);
    return result.rows[0]?.reserved === true ? { reservationId: randomUUID() } : null;
  },
};
