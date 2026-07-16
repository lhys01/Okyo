import { getCostControlConfig } from '../config/costControlConfig.js';
import { logCostEvent } from '../middleware/costControls.js';
import { logScanMetric } from '../telemetry/scanTelemetry.js';
import {
  getQuotaRepository,
  type ProviderSpendCompletion,
  type QuotaRepository,
} from './quotaRepository.js';

export type ProviderAttemptReservation = {
  spendEventId: string;
  operation: string;
};

export type ProviderAttemptCompletion = {
  outcome: 'success' | 'failure';
  failureCategory?: string;
  inputTokens?: number;
  outputTokens?: number;
  actualCostUsd?: number;
};

export type ProviderQuota = {
  reserveAttempt(input: { provider: string; model: string; operation: string }): Promise<ProviderAttemptReservation>;
  completeAttempt(reservation: ProviderAttemptReservation, completion: ProviderAttemptCompletion): Promise<void>;
};

export class QuotaDeniedError extends Error {
  constructor() {
    super('Provider capacity was denied.');
    this.name = 'QuotaDeniedError';
  }
}

export class QuotaUnavailableError extends Error {
  constructor() {
    super('Provider capacity is temporarily unavailable.');
    this.name = 'QuotaUnavailableError';
  }
}

export function isQuotaError(error: unknown): error is QuotaDeniedError | QuotaUnavailableError {
  return error instanceof QuotaDeniedError || error instanceof QuotaUnavailableError;
}

export function getQuotaApiError(error: unknown): {
  status: 429 | 503;
  code: 'scan_limit_reached' | 'capacity_unavailable';
  message: string;
} | null {
  if (error instanceof QuotaDeniedError) {
    return {
      status: 429,
      code: 'scan_limit_reached',
      message: 'Your daily scan capacity has been reached. Please try again tomorrow.',
    };
  }
  if (error instanceof QuotaUnavailableError) {
    return {
      status: 503,
      code: 'capacity_unavailable',
      message: 'Scan capacity is temporarily unavailable. Please try again.',
    };
  }
  return null;
}

export function createProviderQuota(options: {
  userId: string;
  requestId: string;
  repository?: QuotaRepository;
}): ProviderQuota {
  const repository = options.repository ?? getQuotaRepository();

  return {
    async reserveAttempt(input) {
      const startedAt = Date.now();
      const config = getCostControlConfig();
      if (config.aiUserDailyRequestCap < 1 || config.aiDailyRequestCap < 1) {
        logScanMetric({
          requestId: options.requestId,
          stage: 'quota_reserve',
          durationMs: Date.now() - startedAt,
          status: 'failure',
          details: { operation: sanitizeLabel(input.operation), reason: 'disabled' },
        });
        throw new QuotaUnavailableError();
      }

      const operation = sanitizeLabel(input.operation);
      let reservation;
      try {
        reservation = await repository.reserve({
          userId: options.userId,
          provider: sanitizeLabel(input.provider),
          model: sanitizeLabel(input.model),
          requestCategory: buildCategory(options.requestId, operation, 'reserved'),
          userDailyCap: config.aiUserDailyRequestCap,
          globalDailyCap: config.aiDailyRequestCap,
        });
      } catch {
        logScanMetric({
          requestId: options.requestId,
          stage: 'quota_reserve',
          durationMs: Date.now() - startedAt,
          status: 'failure',
          details: { operation, reason: 'repository_unavailable' },
        });
        logCostEvent('persistent_quota_unavailable', { operation });
        throw new QuotaUnavailableError();
      }

      if (!reservation.allowed) {
        logScanMetric({
          requestId: options.requestId,
          stage: 'quota_reserve',
          durationMs: Date.now() - startedAt,
          status: 'failure',
          details: { operation, reason: sanitizeReason(reservation.reason) },
        });
        logCostEvent('persistent_quota_denied', { operation, reason: sanitizeReason(reservation.reason) });
        throw new QuotaDeniedError();
      }
      if (!reservation.spendEventId) {
        logScanMetric({
          requestId: options.requestId,
          stage: 'quota_reserve',
          durationMs: Date.now() - startedAt,
          status: 'failure',
          details: { operation, reason: 'invalid_result' },
        });
        logCostEvent('persistent_quota_invalid_result', { operation });
        throw new QuotaUnavailableError();
      }
      logScanMetric({
        requestId: options.requestId,
        stage: 'quota_reserve',
        durationMs: Date.now() - startedAt,
        details: { operation },
      });
      return { spendEventId: reservation.spendEventId, operation };
    },

    async completeAttempt(reservation, completion) {
      const startedAt = Date.now();
      const spend: ProviderSpendCompletion = {
        requestCategory: buildCategory(
          options.requestId,
          reservation.operation,
          completion.outcome === 'success' ? 'success' : sanitizeLabel(completion.failureCategory ?? 'failure'),
        ),
        inputTokens: sanitizeCount(completion.inputTokens),
        outputTokens: sanitizeCount(completion.outputTokens),
        // OpenRouter's response-level usage.cost is actual provider-reported cost.
        // When absent or invalid, leave cost null rather than fabricate an estimate.
        estimatedCostUsd: sanitizeCost(completion.actualCostUsd),
      };
      try {
        await repository.complete({
          userId: options.userId,
          spendEventId: reservation.spendEventId,
          spend,
        });
        logScanMetric({
          requestId: options.requestId,
          stage: 'quota_complete',
          durationMs: Date.now() - startedAt,
          details: { operation: reservation.operation, outcome: completion.outcome },
        });
      } catch {
        logScanMetric({
          requestId: options.requestId,
          stage: 'quota_complete',
          durationMs: Date.now() - startedAt,
          status: 'failure',
          details: { operation: reservation.operation, outcome: completion.outcome },
        });
        // The provider must never be called twice because telemetry finalization
        // failed. The RPC-created reservation row remains as durable evidence.
        logCostEvent('provider_spend_finalize_failed', { operation: reservation.operation });
      }
    },
  };
}

function buildCategory(requestId: string, operation: string, outcome: string): string {
  return `${sanitizeLabel(requestId)}:${operation}:${sanitizeLabel(outcome)}`.slice(0, 240);
}

function sanitizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._:/-]+/g, '_').slice(0, 120) || 'unknown';
}

function sanitizeReason(value: string | null): string {
  return value === 'user_daily_cap' || value === 'global_daily_cap' ? value : 'denied';
}

function sanitizeCount(value: number | undefined): number | undefined {
  return Number.isSafeInteger(value) && (value ?? -1) >= 0 ? value : undefined;
}

function sanitizeCost(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
