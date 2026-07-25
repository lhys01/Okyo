// Single source of truth for whether a real in-app-purchase provider is wired
// up in this build. Today no provider is connected, so purchases are
// unavailable and onboarding must offer an honest, non-blocking continuation
// instead of a purchase button that only shows a trapped alert.
//
// When a real provider (RevenueCat, StoreKit, etc.) is integrated, this
// becomes the single flip that turns the real purchase UI back on — the
// paywall UI already branches cleanly on this value.
export function isPurchaseProviderAvailable(): boolean {
  return false;
}

// The number of free-trial days actually configured with the connected
// purchase provider, or null when no trial is configured. Never hardcode a
// trial length in UI copy unless it comes from here — the app must not claim
// a trial that isn't real.
export function getConfiguredFreeTrialDays(): number | null {
  return null;
}

export type SubscriptionPlan = 'annual' | 'weekly';

export type SubscriptionPricing = {
  primary: string;
  secondary: string;
};

const PRICING_BY_PLAN: Record<SubscriptionPlan, SubscriptionPricing> = {
  annual: { primary: '$0.96 / week', secondary: 'Billed as $49.99/year' },
  weekly: { primary: '$4.99 / week', secondary: 'Billed weekly' },
};

// Annual is priced per-week against the weekly plan (its actual competing
// option), never against a per-month figure — that keeps one consistent
// pricing hierarchy across both cards.
export function getSubscriptionPricing(plan: SubscriptionPlan): SubscriptionPricing {
  return PRICING_BY_PLAN[plan];
}
