import { Platform } from 'react-native';

import { analyticsConfig } from './analyticsEnv';
import { sanitizeProperties, type AnalyticsProperties } from './sanitize';

export {
  ALLOWED_ANALYTICS_EVENTS,
  ALLOWED_PROPERTY_KEYS,
  sanitizeAnalyticsEvent,
  sanitizeProperties,
  type AnalyticsProperties,
} from './sanitize';

export type BaseContextInput = {
  sessionId: string;
  primaryGoal?: string | null;
  subscriptionStatus?: string | null;
};

/** Build metadata only; user, screen, recipe and health fields are excluded. */
export function buildBaseContext(_input: BaseContextInput): AnalyticsProperties {
  return sanitizeProperties({
    app_version: analyticsConfig.appVersion,
    platform: Platform.OS,
    environment: analyticsConfig.environment,
  });
}
