export const REVENUECAT_TEST_STORE_SIMULATED_FAILURE_LOG =
  '[RevenueCat] [Test Store] Purchase failure simulated successfully in Test Store.';

/**
 * RevenueCat intentionally logs a simulated Test Store failure at error level.
 * React Native turns that one expected development event into a LogBox screen,
 * even though the purchase promise is caught and shown in Okyo's recovery UI.
 * No production or unrelated RevenueCat messages are suppressed.
 */
export function getRevenueCatDevelopmentLogBoxIgnores(isDevelopment: boolean): string[] {
  return isDevelopment ? [REVENUECAT_TEST_STORE_SIMULATED_FAILURE_LOG] : [];
}

