import { randomUUID } from 'node:crypto';

import { estimateCostUsd } from './aiPricing.js';
import { getRequestContext } from './requestContext.js';
import { isApprovedOpenRouterModel } from '../config/modelAllowlist.js';

/**
 * Backend product analytics → PostHog, over the public /capture/ REST endpoint
 * (no SDK). Best-effort and fire-and-forget: a failed send is swallowed and
 * never affects a response. Disabled unless a PostHog key is configured, or if
 * ANALYTICS_ENABLED=off (mirrors the other backend analytics loggers).
 */

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

const posthogKey = readEnv('POSTHOG_PROJECT_API_KEY') ?? readEnv('POSTHOG_API_KEY');
const posthogHost = (readEnv('POSTHOG_HOST') ?? 'https://us.i.posthog.com').replace(/\/+$/, '');
const MAX_ANALYTICS_QUEUE = 500;
const MAX_ANALYTICS_BATCH = 50;
const ANALYTICS_FLUSH_DELAY_MS = 500;
const ANALYTICS_TIMEOUT_MS = 2_000;
const ALLOWED_AI_ANALYTICS_PROPERTIES = new Set([
  '$ai_trace_id', '$ai_span_id', '$ai_span_name', '$ai_model', '$ai_provider', '$ai_latency',
  '$ai_input_tokens', '$ai_output_tokens', '$ai_is_error', '$ai_total_cost_usd', '$ai_error',
  '$process_person_profile', 'request_id', 'request_type', 'prompt_version', 'total_tokens',
  'cost_estimated', 'time_to_first_token_ms', 'failure_category', 'retry_count', 'fallback_used',
  'fallback_model', 'confidence_bucket', 'environment',
]);
const AI_REQUEST_TYPES = new Set<AiRequestType>(['vision', 'recipe', 'correction', 'epicure', 'ask', 'unknown']);
const pendingEvents: CaptureInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;
let dropWarned = false;

export function isAnalyticsEnabled(): boolean {
  return Boolean(posthogKey) && ['development', 'production'].includes(process.env.NODE_ENV ?? '') &&
    process.env.ANALYTICS_ENABLED === process.env.NODE_ENV &&
    ['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(posthogHost);
}

type CaptureInput = {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
};

export function captureEvent(input: CaptureInput): void {
  if (!isAnalyticsEnabled()) return;
  if (input.event !== '$ai_generation') return;
  if (pendingEvents.length >= MAX_ANALYTICS_QUEUE) {
    if (!dropWarned) {
      dropWarned = true;
      console.warn('analytics_queue_full: dropping noncritical analytics events');
    }
    return;
  }
  pendingEvents.push({
    event: '$ai_generation',
    distinctId: randomUUID(),
    properties: sanitizeAiAnalyticsProperties(input.properties ?? {}),
  });
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer || flushing) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushAnalytics();
  }, ANALYTICS_FLUSH_DELAY_MS);
  // Do not keep a process alive solely to send telemetry during shutdown.
  flushTimer.unref?.();
}

async function flushAnalytics(): Promise<void> {
  if (flushing || !isAnalyticsEnabled()) return;
  flushing = true;
  const batch = pendingEvents.splice(0, MAX_ANALYTICS_BATCH);
  try {
    await fetch(`${posthogHost}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: posthogKey,
        batch: batch.map((input) => ({
          event: input.event,
          properties: { ...(input.properties ?? {}), distinct_id: input.distinctId, $lib: 'okyo-api' },
          timestamp: new Date().toISOString(),
        })),
      }),
      signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
    });
  } catch {
    // Noncritical telemetry is intentionally dropped on a failed batch. Retrying
    // here would turn a PostHog outage into a retry queue and socket leak.
  } finally {
    flushing = false;
    if (pendingEvents.length > 0) scheduleFlush();
  }
}

export type AiRequestType = 'vision' | 'recipe' | 'correction' | 'epicure' | 'ask' | 'unknown';

export function sanitizeAiAnalyticsProperties(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_AI_ANALYTICS_PROPERTIES.has(key)) continue;
    if (key === '$ai_model' || key === 'fallback_model') {
      if (value === 'unknown' || isApprovedOpenRouterModel(value)) output[key] = value;
      continue;
    }
    if (key === 'request_type') {
      if (typeof value === 'string' && AI_REQUEST_TYPES.has(value as AiRequestType)) output[key] = value;
      continue;
    }
    if (key === '$ai_provider') {
      if (value === 'openrouter') output[key] = value;
      continue;
    }
    if (key === '$ai_span_name') {
      if (typeof value === 'string' && /^ai_(vision|recipe|correction|epicure|ask|unknown)$/.test(value)) output[key] = value;
      continue;
    }
    if (key === 'environment') {
      if (typeof value === 'string' && ['development', 'test', 'staging', 'production'].includes(value)) output[key] = value;
      continue;
    }
    if (key === 'confidence_bucket') {
      if (['high', 'medium', 'low'].includes(String(value))) output[key] = value;
      continue;
    }
    if (key === 'failure_category' || key === '$ai_error' || key === 'prompt_version') {
      if (typeof value === 'string' && value.length <= 80 && /^[A-Za-z0-9_.-]*$/.test(value)) output[key] = value;
      continue;
    }
    if (key === '$ai_trace_id' || key === '$ai_span_id' || key === 'request_id') {
      if (typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value)) output[key] = value;
      continue;
    }
    if (typeof value === 'boolean') {
      output[key] = value;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000) {
      output[key] = value;
    }
  }
  if ('$process_person_profile' in output) output.$process_person_profile = false;
  return output;
}

export type AiGenerationEvent = {
  requestType: AiRequestType;
  provider?: string;
  model?: string;
  promptVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  timeToFirstTokenMs?: number | null;
  success: boolean;
  failureCategory?: string;
  retryCount?: number;
  fallbackUsed?: boolean;
  fallbackModel?: string;
  confidenceBucket?: 'high' | 'medium' | 'low';
};

/**
 * Emits one PostHog `$ai_generation` event (LLM analytics schema, `$ai_*`
 * properties) so OpenRouter calls show up in PostHog's LLM analytics product
 * — cost, latency, model comparison, failure rate.
 *
 * We do NOT use PostHog's OpenAI SDK wrapper: Okyo calls OpenRouter over raw
 * fetch, so this hand-builds the same event. Safe metadata only — `$ai_input`
 * and `$ai_output_choices` (prompts / model output) are deliberately omitted
 * because they can contain user content. Cost comes from the central pricing
 * table; an unpriced model omits `$ai_total_cost_usd` and PostHog prices it
 * from `$ai_model` + token counts where it can.
 */
export function emitAiGeneration(event: AiGenerationEvent): void {
  if (!isAnalyticsEnabled()) return;
  const ctx = getRequestContext();
  const cost = estimateCostUsd(event.model, event.inputTokens, event.outputTokens);
  const traceId = ctx?.requestId ?? randomUUID();
  // Do not turn the caller-controlled x-okyo-anon-id into a persistent
  // analytics identity or PostHog person profile.
  const distinctId = randomUUID();

  const properties: Record<string, unknown> = {
    // ── PostHog LLM analytics canonical schema ──
    $ai_trace_id: traceId,
    $ai_span_id: randomUUID(),
    $ai_span_name: `ai_${event.requestType}`,
    $ai_model: event.model ?? 'unknown',
    $ai_provider: event.provider ?? 'openrouter',
    $ai_latency: typeof event.latencyMs === 'number' ? event.latencyMs / 1000 : null, // seconds
    $ai_input_tokens: event.inputTokens ?? null,
    $ai_output_tokens: event.outputTokens ?? null,
    $ai_is_error: !event.success,
    // omit $ai_input / $ai_output_choices on purpose (may contain user content)

    // ── Okyo-specific extras (kept alongside the canonical props) ──
    request_id: traceId,
    request_type: event.requestType,
    prompt_version: event.promptVersion ?? null,
    total_tokens: event.totalTokens ?? null,
    cost_estimated: cost.estimated,
    time_to_first_token_ms: event.timeToFirstTokenMs ?? null, // null: provider is non-streaming
    failure_category: event.failureCategory ?? null,
    retry_count: event.retryCount ?? 0,
    fallback_used: event.fallbackUsed ?? false,
    fallback_model: event.fallbackModel ?? null,
    confidence_bucket: event.confidenceBucket ?? null,
    environment: process.env.NODE_ENV ?? 'development',
  };

  if (typeof cost.costUsd === 'number') properties.$ai_total_cost_usd = cost.costUsd;
  if (!event.success && event.failureCategory) properties.$ai_error = event.failureCategory;
  properties.$process_person_profile = false;

  captureEvent({ event: '$ai_generation', distinctId, properties });
}
