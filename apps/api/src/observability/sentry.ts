import * as Sentry from '@sentry/node';
import { sanitizeCrashEvent } from './sentryPrivacy.js';
export function initializeCrashReporting(): void {
  if (!process.env.SENTRY_DSN || process.env.SENTRY_ENABLED !== process.env.NODE_ENV) return;
  try {
    Sentry.init({dsn:process.env.SENTRY_DSN,environment:process.env.NODE_ENV,release:process.env.SENTRY_RELEASE,
      dataCollection:{userInfo:false,cookies:false,httpHeaders:false,httpBodies:[],urlQueryParams:false,genAI:{inputs:false,outputs:false},databaseQueryData:false,queues:false},defaultIntegrations:false,tracesSampleRate:0,includeServerName:false,
      integrations:[Sentry.onUncaughtExceptionIntegration(),Sentry.onUnhandledRejectionIntegration()],
      beforeBreadcrumb:()=>null,beforeSend:event=>sanitizeCrashEvent(event),
    });
  } catch { /* crash reporting is noncritical */ }
}
export function captureServerException(error: unknown): void { Sentry.captureException(error); }
export async function captureInternalCrashProbe(): Promise<boolean> {
  if (process.env.SENTRY_INTERNAL_PROBE !== 'true') return false;
  Sentry.captureException(new Error('Okyo internal crash probe'));
  return Sentry.flush(2000);
}
