export type RevenueCatPlatform = 'ios' | 'android' | 'other';

export type RevenueCatKeySource = 'test-store' | 'ios-production' | 'android-production';

export type RevenueCatConfiguration = {
  apiKey: string | null;
  entitlementId: string | null;
  keySource: RevenueCatKeySource | null;
  reason: string | null;
};

type RevenueCatConfigurationInput = {
  androidKey?: string;
  entitlementId?: string;
  iosKey?: string;
  isDevelopment: boolean;
  platform: RevenueCatPlatform;
  testStoreKey?: string;
};

function normalize(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function isRevenueCatTestStoreKey(value: string | null | undefined): boolean {
  return Boolean(normalize(value ?? undefined)?.startsWith('test_'));
}

/**
 * Resolves the public SDK key without ever crossing the Test Store/production
 * boundary. Development only accepts the explicit Test Store variable;
 * production only accepts the matching platform key and rejects test_ keys.
 */
export function resolveRevenueCatConfiguration(
  input: RevenueCatConfigurationInput,
): RevenueCatConfiguration {
  const entitlementId = normalize(input.entitlementId);

  if (input.isDevelopment) {
    const testStoreKey = normalize(input.testStoreKey);
    if (!testStoreKey) {
      return {
        apiKey: null,
        entitlementId,
        keySource: null,
        reason: 'EXPO_PUBLIC_REVENUECAT_TEST_KEY is not configured for this development build.',
      };
    }
    if (!isRevenueCatTestStoreKey(testStoreKey)) {
      return {
        apiKey: null,
        entitlementId,
        keySource: null,
        reason: 'EXPO_PUBLIC_REVENUECAT_TEST_KEY is not a RevenueCat Test Store public SDK key.',
      };
    }

    return {
      apiKey: testStoreKey,
      entitlementId,
      keySource: 'test-store',
      reason: null,
    };
  }

  const productionKey = input.platform === 'ios'
    ? normalize(input.iosKey)
    : input.platform === 'android'
      ? normalize(input.androidKey)
      : null;
  const keySource = input.platform === 'ios'
    ? 'ios-production'
    : input.platform === 'android'
      ? 'android-production'
      : null;

  if (!productionKey || !keySource) {
    return {
      apiKey: null,
      entitlementId,
      keySource: null,
      reason: input.platform === 'other'
        ? 'RevenueCat purchases are not configured for this platform.'
        : `EXPO_PUBLIC_REVENUECAT_${input.platform.toUpperCase()}_KEY is not configured for this release build.`,
    };
  }

  if (isRevenueCatTestStoreKey(productionKey)) {
    return {
      apiKey: null,
      entitlementId,
      keySource: null,
      reason: 'A RevenueCat Test Store key cannot be used in a release build.',
    };
  }

  return {
    apiKey: productionKey,
    entitlementId,
    keySource,
    reason: null,
  };
}

