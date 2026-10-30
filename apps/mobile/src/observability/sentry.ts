import * as Sentry from '@sentry/react-native';
import appConfig from '../../app.json';
import { sanitizeCrashEvent } from './sentryPrivacy';

const environment = typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production';
export function initializeCrashReporting(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || process.env.EXPO_PUBLIC_SENTRY_ENABLED !== environment) return;
  try {
    Sentry.init({dsn,environment,release:`com.rober.okyo@${appConfig.expo.version}`,dist:appConfig.expo.ios.buildNumber,
      sendDefaultPii:false, enableNative:false, enableAutoSessionTracking:false,
      enableLogs:false, tracesSampleRate:0, replaysSessionSampleRate:0, replaysOnErrorSampleRate:0,
      beforeBreadcrumb:()=>null, beforeSend:event=>sanitizeCrashEvent(event),
      integrations:defaults=>defaults.filter(item=>['ReactNativeErrorHandlers','InboundFilters','Dedupe'].includes(item.name)),
    });
  } catch { /* Missing SDK configuration cannot block app startup. */ }
}
export function captureAppError(error: unknown): void { Sentry.captureException(error); }
/** Invoke from a debugger/internal QA script only. No production UI control. */
export function captureInternalCrashProbe(): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_SENTRY_INTERNAL_PROBE === 'true') Sentry.captureException(new Error('Okyo internal crash probe'));
}
