/**
 * ============================================================================
 * TEMPORARY DEVELOPMENT PAYWALL BYPASS
 * ============================================================================
 *
 * This exists so the full app can be exercised during development without
 * completing a purchase. It is NOT a product feature and must not ship enabled.
 *
 * HOW TO TURN IT OFF (restore production behaviour):
 *   Set DEV_BYPASS_PAYWALL_ENABLED to false below. That is the only edit
 *   required — nothing else in the app reads a hardcoded `true`.
 *
 * SAFETY:
 *   The exported flag is additionally gated on __DEV__, so even if the constant
 *   below is left as `true`, a release build always evaluates it to `false` and
 *   the real paywall runs. RevenueCat, the entitlement architecture, and the
 *   paywall screen are all left completely intact.
 *
 * WHAT IT DOES WHEN ENABLED:
 *   The onboarding paywall step immediately reports "already entitled", so
 *   onboarding continues into the app. Scan, Take Photo, Upload Photo,
 *   Describe a Dish and recipe generation are not entitlement-gated, so they
 *   work as normal once past that step.
 * ============================================================================
 */

/** Flip to false to restore the real paywall in development. */
const DEV_BYPASS_PAYWALL_ENABLED = true;

/**
 * True only in development builds with the bypass switched on. Always false in
 * production regardless of the constant above.
 */
export const DEV_BYPASS_PAYWALL =
  (typeof __DEV__ !== 'undefined' && __DEV__) && DEV_BYPASS_PAYWALL_ENABLED;

/**
 * Master kill-switch for the V4 onboarding rebuild
 * (Okyo_Onboarding_V4_Implementation_Plan.md). V4's visual design and
 * shortened sequence were rejected after release-candidate QA; the legacy
 * V3 onboarding (OnboardingV3.tsx's LegacyOnboardingV3) is production-visible
 * again. This flag overrides every stored per-install `v4` experiment
 * assignment (see onboardingV4Route.ts's shouldUseOnboardingV4: it is
 * `enabled && assignment === 'v4'`, so `false` here always selects V3
 * regardless of assignment). V4's screens, reducer, and persisted state are
 * fully intact and unreachable while this stays false — flip back to true
 * once V4 is visually redesigned.
 */
export const ONBOARDING_V4_ENABLED = false;
