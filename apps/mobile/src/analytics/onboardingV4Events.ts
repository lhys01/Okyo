import type { PrimaryGoal } from '../onboarding-v3/state/personalizedOnboarding';

/**
 * Event taxonomy for the V4 onboarding rebuild (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 02). The 22 event names below are the single source of truth and match
 * `analyticsEvents`'s `ONBOARDING_V4_*` entries in `analytics/track.ts`
 * value-for-value (`onboardingV4EventNamesMatchTrackTs` in the test file
 * asserts this by reading track.ts's source text, since track.ts cannot be
 * imported directly from the plain `node:test` runner this repo uses — it
 * statically imports `react-native`, which esbuild/tsx cannot transform
 * outside Metro; confirmed as a pre-existing repo limitation, not introduced
 * here). `trackOnboardingV4` sends through the real `track()` via a dynamic
 * `import('./track')` at call time — one analytics system, not two — so this
 * module stays importable from unit tests while still funneling every event
 * through the existing wrapper at runtime. Per Step 02's scope, nothing calls
 * `trackOnboardingV4` yet; a live screen starts emitting these starting in
 * Step 03.
 */
export const onboardingV4Events = {
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_SCREEN_VIEWED: 'onboarding_screen_viewed',
  ONBOARDING_ANSWER_SUBMITTED: 'onboarding_answer_submitted',
  PRIMARY_GOAL_SELECTED: 'primary_goal_selected',
  PERSONAL_INSIGHT_VIEWED: 'personal_insight_viewed',
  DIETARY_PREFERENCES_SAVED: 'dietary_preferences_saved',
  PERSONAL_PLAN_VIEWED: 'personal_plan_viewed',
  FIRST_SCAN_INPUT_SELECTED: 'first_scan_input_selected',
  CAMERA_PERMISSION_PROMPTED: 'camera_permission_prompted',
  CAMERA_PERMISSION_RESULT: 'camera_permission_result',
  PHOTO_CONFIRMED: 'photo_confirmed',
  ANALYSIS_STARTED: 'analysis_started',
  ANALYSIS_SUCCEEDED: 'analysis_succeeded',
  ANALYSIS_FAILED: 'analysis_failed',
  FIRST_RECIPE_REVEALED: 'first_recipe_revealed',
  MEANINGFUL_ACTION_SELECTED: 'meaningful_action_selected',
  PAYWALL_VIEWED: 'paywall_viewed',
  PURCHASE_STARTED: 'purchase_started',
  PURCHASE_SUCCEEDED: 'purchase_succeeded',
  PURCHASE_FAILED: 'purchase_failed',
  PURCHASE_RESTORED: 'purchase_restored',
  ONBOARDING_COMPLETED: 'onboarding_completed',
} as const;

export type OnboardingV4EventName = (typeof onboardingV4Events)[keyof typeof onboardingV4Events];

/**
 * Closed allow-list of analytics properties. No free-text, identity, dietary,
 * body-measurement, or photo fields are permitted — those must never reach
 * analytics regardless of what a future call site tries to pass. Extend this
 * list deliberately, one named field at a time, never with an index signature.
 */
export type OnboardingV4EventProperties = Partial<{
  screen: string;
  step: string;
  branch: PrimaryGoal | 'not_sure';
  source: string;
  actionType: string;
  permissionResult: 'granted' | 'denied' | 'undetermined';
  errorKind: string;
  durationMs: number;
  isMinor: boolean;
  /** Step 06: how many entries were saved per dietary group — a count, never the group's actual values. */
  allergyCount: number;
  restrictionCount: number;
  dislikeCount: number;
  /** Step 06: whether the user explicitly chose "None of these" — never the underlying selections. */
  selectedNoneOfThese: boolean;
}>;

const ALLOWED_PROPERTY_KEYS: ReadonlySet<string> = new Set<keyof OnboardingV4EventProperties>([
  'screen', 'step', 'branch', 'source', 'actionType', 'permissionResult', 'errorKind', 'durationMs', 'isMinor',
  'allergyCount', 'restrictionCount', 'dislikeCount', 'selectedNoneOfThese',
]);

/**
 * Runtime defense-in-depth alongside the compile-time allow-list type above:
 * a value built dynamically (e.g. via spread) bypasses TypeScript's
 * excess-property check, so any key outside `ALLOWED_PROPERTY_KEYS` — a
 * name, an allergy note, a body measurement, a photo URI, free-text dish
 * description, etc. — is dropped here before anything is sent.
 */
export function sanitizeOnboardingV4EventProperties(
  properties: Record<string, unknown> = {},
): OnboardingV4EventProperties {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (ALLOWED_PROPERTY_KEYS.has(key)) sanitized[key] = value;
  }
  return sanitized as OnboardingV4EventProperties;
}

export async function trackOnboardingV4(eventName: OnboardingV4EventName, properties: OnboardingV4EventProperties = {}) {
  try {
    const { track } = await import('./track');
    track(eventName, sanitizeOnboardingV4EventProperties(properties));
  } catch {
    // Analytics must never interrupt the app.
  }
}
