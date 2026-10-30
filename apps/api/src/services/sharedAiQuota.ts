/**
 * Contract for a durable, cross-instance quota backend. No implementation is
 * configured in this repository, so production reservations fail closed.
 * Implementations must make reserveGlobalDaily atomic across all API replicas.
 * Reservations are intentionally not released after provider invocation starts
 * or when its outcome is ambiguous.
 */
export type SharedAiQuotaStore = {
  reserveGlobalDaily(input: { key: string; limit: number; now: Date; model?: string }): Promise<{ reservationId: string } | null>;
};

export class SharedAiQuotaUnavailableError extends Error {
  constructor() {
    super('Shared AI quota storage is not configured or unavailable.');
    this.name = 'SharedAiQuotaUnavailableError';
  }
}

export class SharedAiQuotaLimitExceededError extends Error {
  constructor() {
    super('Shared AI quota has been exhausted.');
    this.name = 'SharedAiQuotaLimitExceededError';
  }
}

let sharedAiQuotaStore: SharedAiQuotaStore | null = null;

export function configureSharedAiQuotaStore(store: SharedAiQuotaStore | null): void {
  sharedAiQuotaStore = store;
}

export function isSharedAiQuotaStoreConfigured(): boolean {
  return sharedAiQuotaStore !== null;
}

export async function reserveSharedGlobalAiQuota(input: {
  key: string;
  limit: number;
  now?: Date;
  model?: string;
}): Promise<{ reservationId: string }> {
  const store = sharedAiQuotaStore;
  if (!store) throw new SharedAiQuotaUnavailableError();

  try {
    const reservation = await store.reserveGlobalDaily({ ...input, now: input.now ?? new Date() });
    if (!reservation) throw new SharedAiQuotaLimitExceededError();
    return reservation;
  } catch (error) {
    if (error instanceof SharedAiQuotaLimitExceededError) throw error;
    throw new SharedAiQuotaUnavailableError();
  }
}

export function resetSharedAiQuotaStoreForTests(): void {
  sharedAiQuotaStore = null;
}
