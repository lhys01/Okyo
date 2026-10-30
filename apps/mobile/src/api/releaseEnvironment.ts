import { isClerkConfigured } from '../auth/clerkRuntime';
import { isReleaseSafeApiUrl, readConfiguredApiUrl } from './config';
import { analyticsAllowed } from '../analytics/configPolicy';
import { resolveRevenueCatConfiguration } from '../services/revenueCatConfig';
import { areSubscriptionsEnabled } from '../services/subscriptionAvailability';

export function validateReleaseEnvironment(environment: Record<string, string | undefined>): string[] {
  const failures: string[] = [];
  const publicSdkKeys = new Set(['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_POSTHOG_KEY', 'EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'EXPO_PUBLIC_REVENUECAT_TEST_KEY']);
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith('EXPO_PUBLIC_') || !value?.trim()) continue;
    if (/SECRET|PASSWORD|PRIVATE|DATABASE|ADMIN_EMAILS|OPENROUTER|PEXELS|ACCESS_TOKEN|AUTH_TOKEN/.test(name) ||
        (/KEY|TOKEN/.test(name) && !publicSdkKeys.has(name))) {
      failures.push(`${name} must not be included in a public release environment.`);
    }
    if (/sk-or-v1-|sk_(?:live|test)_|sb_secret_|-----BEGIN .*PRIVATE KEY-----|(?:postgres(?:ql)?|mysql|mongodb|redis):\/\//.test(value)) {
      failures.push(`${name} contains a server credential; remove it and rotate the credential if distributed.`);
    }
  }
  const apiUrl = readConfiguredApiUrl(environment)?.trim() ?? '';
  if (!apiUrl) {
    failures.push(environment.SEXPO_PUBLIC_OKYO_API_URL?.trim()
      ? 'EXPO_PUBLIC_OKYO_API_URL is missing; rename SEXPO_PUBLIC_OKYO_API_URL to EXPO_PUBLIC_OKYO_API_URL.'
      : 'EXPO_PUBLIC_OKYO_API_URL is required for a release build. Configure the Production API URL in the Release build environment.');
  } else if (!isReleaseSafeApiUrl(apiUrl)) {
    failures.push('EXPO_PUBLIC_OKYO_API_URL must be a public HTTPS Production endpoint; Development Railway and local/private URLs are not allowed.');
  }

  const clerkKey = environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? '';
  if (clerkKey.startsWith('pk_test_')) {
    failures.push('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is a Development key; configure the Production live publishable key for Release.');
  } else if (!isClerkConfigured(clerkKey, false)) {
    failures.push('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must be configured with a Production live publishable key for Release.');
  }

  if (environment.EXPO_PUBLIC_DEMO_AUTH_ENABLED?.trim().toLowerCase() === 'true') {
    failures.push('EXPO_PUBLIC_DEMO_AUTH_ENABLED must not be enabled in a release build.');
  }
  for (const name of ['EXPO_PUBLIC_MOCK_API', 'EXPO_PUBLIC_DEMO_MODE', 'EXPO_PUBLIC_OKYO_SENTRY_INTERNAL_PROBE', 'EXPO_PUBLIC_SENTRY_INTERNAL_PROBE', 'EXPO_PUBLIC_OKYO_EAT_HEALTHIER_STAGE2_PREVIEW', 'EXPO_PUBLIC_OKYO_HIT_MACROS_STAGE2_PREVIEW', 'EXPO_PUBLIC_OKYO_SAVE_MONEY_STAGE2_PREVIEW']) {
    if (environment[name]?.trim().toLowerCase() === 'true') failures.push(`${name} must be disabled for Release.`);
  }
  if (environment.EXPO_PUBLIC_REVENUECAT_TEST_KEY?.trim()) {
    failures.push('Remove EXPO_PUBLIC_REVENUECAT_TEST_KEY from the Release environment.');
  }
  if (environment.EXPO_PUBLIC_POSTHOG_PROJECT_ID?.trim() === '584818') {
    failures.push('Remove the Development PostHog project from the Release environment, even when analytics is disabled.');
  }
  if (areSubscriptionsEnabled(environment)) {
    const purchases = resolveRevenueCatConfiguration({
      iosKey: environment.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      entitlementId: environment.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID,
      isDevelopment: false,
      platform: 'ios',
    });
    if (!purchases.apiKey?.startsWith('appl_') || !purchases.entitlementId) {
      failures.push('Release subscriptions require a RevenueCat iOS public SDK key (appl_) and the configured entitlement identifier; Test Store or missing configuration cannot ship.');
    }
  }
  const analyticsEnabled = environment.EXPO_PUBLIC_ANALYTICS_ENABLED?.trim();
  if (analyticsEnabled && analyticsEnabled !== 'false') {
    if (!analyticsAllowed({
      posthogKey: environment.EXPO_PUBLIC_POSTHOG_KEY?.trim() ?? '',
      posthogHost: environment.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com',
      projectId: environment.EXPO_PUBLIC_POSTHOG_PROJECT_ID?.trim() ?? '',
      environment: 'production', enabledEnvironment: analyticsEnabled,
    })) failures.push('Analytics must be disabled or explicitly configured for a separate Production PostHog project.');
  }
  if (environment.EXPO_PUBLIC_SENTRY_ENABLED && !['false', 'production'].includes(environment.EXPO_PUBLIC_SENTRY_ENABLED)) {
    failures.push('Sentry must be disabled or explicitly configured for production.');
  }
  if (environment.EXPO_PUBLIC_SENTRY_ENABLED === 'production' && !environment.EXPO_PUBLIC_SENTRY_DSN?.startsWith('https://')) {
    failures.push('Enabled production crash reporting requires its HTTPS Sentry DSN.');
  }
  return failures;
}
