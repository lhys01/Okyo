import appConfig from '../../app.json';
import { analyticsAllowed } from './configPolicy';

// Static property accesses are required for Expo to inline public build values.
const environment = typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production';
export const analyticsConfig = {
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() ?? '',
  posthogHost: (process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com').replace(/\/+$/, ''),
  projectId: process.env.EXPO_PUBLIC_POSTHOG_PROJECT_ID?.trim() ?? '',
  environment,
  appVersion: appConfig.expo.version,
  enabledEnvironment: process.env.EXPO_PUBLIC_ANALYTICS_ENABLED,
} as const;
export function isAnalyticsConfigured(): boolean {
  return analyticsAllowed(analyticsConfig);
}
