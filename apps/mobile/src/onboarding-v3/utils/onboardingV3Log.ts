export function onboardingV3Log(event: string, details: Record<string, unknown> = {}) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.log(`onboarding_v3_${event}`, details);
}
