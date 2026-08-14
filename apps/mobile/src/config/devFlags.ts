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
 * Gate for the V4 onboarding rebuild (Okyo_Onboarding_V4_Implementation_Plan.md).
 * Defaults to false and is unreferenced by any live screen as of Step 02 —
 * Step 03 is the first step that reads it, to gate the new V4 screens behind
 * a flag before they're wired into OnboardingV3.tsx's render switch.
 */
export const ONBOARDING_V4_ENABLED = true;
