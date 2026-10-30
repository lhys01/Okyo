/**
 * Subscriptions are an explicit launch capability. A build without the flag
 * must not initialize RevenueCat or expose purchase configuration requirements.
 */
export function areSubscriptionsEnabled(environment: Record<string, string | undefined> = process.env): boolean {
  return environment.EXPO_PUBLIC_OKYO_SUBSCRIPTIONS_ENABLED?.trim().toLowerCase() === 'true';
}
