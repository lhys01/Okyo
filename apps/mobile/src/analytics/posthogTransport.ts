import { analyticsConfig, isAnalyticsConfigured } from './analyticsEnv';
import { sanitizeAnalyticsEvent, type AnalyticsEventName } from './sanitize';

type SendInput = {
  event: AnalyticsEventName;
  distinctId: string;
  /** Untrusted at the network boundary; sanitization always runs before serialization. */
  properties?: Record<string, unknown>;
  timestamp?: string;
};

type TransportConfig = Pick<typeof analyticsConfig, 'posthogKey' | 'posthogHost'>;
type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok'>>;
type TransportOptions = {
  config?: TransportConfig;
  enabled?: boolean;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

const ANALYTICS_TIMEOUT_MS = 2_000;

/** Explicit PostHog capture only. No SDK, autocapture, replay, or screen capture. */
export async function sendToPostHog(input: SendInput, options: TransportOptions = {}): Promise<boolean> {
  const config = options.config ?? analyticsConfig;
  const enabled = options.enabled ?? isAnalyticsConfigured();
  if (!enabled) return false;

  const safeEvent = sanitizeAnalyticsEvent(input.event, input.properties ?? {});
  if (!safeEvent || !/^[0-9a-f-]{36}$/i.test(input.distinctId)) return false;

  const body = JSON.stringify({
    api_key: config.posthogKey,
    event: safeEvent.event,
    properties: {
      ...safeEvent.properties,
      distinct_id: input.distinctId,
      $process_person_profile: false,
      $ip: 0,
    },
    timestamp: input.timestamp ?? new Date().toISOString(),
  });

  const fetchImpl = options.fetchImpl ?? fetch;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? ANALYTICS_TIMEOUT_MS);
    const response = await fetchImpl(`${config.posthogHost}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    // Network errors, airplane mode, aborts, and fetch implementation errors are dropped.
    return false;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
