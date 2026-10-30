import { Platform } from 'react-native';
import appConfig from '../../app.json';
import { getAnalyticsDistinctId, getAnalyticsDistinctIdSync, getAnalyticsIdentityRevision, resetAnalyticsDistinctId } from './analyticsIdentity';
import { sendToPostHog } from './posthogTransport';
import { sanitizeAnalyticsEvent, type AnalyticsEventName, type AnalyticsProperties } from './sanitize';
import { analyticsConfig } from './analyticsEnv';
import { acceptAnalyticsEvent } from './dedupe';

/** Lifecycle and product metadata only; event values are allow-listed twice. */
export function track(event: AnalyticsEventName, properties: AnalyticsProperties = {}): void {
  try {
    const safeEvent = sanitizeAnalyticsEvent(event, {
      app_version: appConfig.expo.version,
      platform: Platform.OS,
      environment: analyticsConfig.environment,
      ...properties,
    });
    if (!safeEvent || !acceptAnalyticsEvent(safeEvent.event, safeEvent.properties, Date.now())) return;

    const eventIdentity = { event: safeEvent.event, properties: safeEvent.properties };
    const sendWithId = (distinctId: string) => sendToPostHog({ ...eventIdentity, distinctId }).catch(() => false);
    const cachedDistinctId = getAnalyticsDistinctIdSync();
    if (cachedDistinctId) {
      void sendWithId(cachedDistinctId);
      return;
    }
    const revisionAtCapture = getAnalyticsIdentityRevision();
    void getAnalyticsDistinctId().then((distinctId) => {
      if (revisionAtCapture !== getAnalyticsIdentityRevision()) return;
      return sendWithId(distinctId);
    }).catch(() => undefined);
  } catch {
    // Analytics must never affect app behavior.
  }
}

/** Called after confirmed account deletion; rotate analytics identity locally. */
export async function reset(): Promise<void> {
  await resetAnalyticsDistinctId();
}
