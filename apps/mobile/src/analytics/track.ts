import { track as clientTrack } from './analyticsClient';
import type { AnalyticsEventName, AnalyticsProperties } from './sanitize';

/** Event names intentionally mirror the privacy-reviewed transport allow-list. */
export const analyticsEvents = {
  APP_OPEN: 'app_opened', SESSION_STARTED: 'session_started', APP_BACKGROUNDED: 'app_backgrounded',
  APP_FOREGROUNDED: 'app_foregrounded', SCREEN_VIEWED: 'screen_viewed',
  ONBOARDING_START: 'onboarding_started', ONBOARDING_SCREEN_VIEWED: 'onboarding_screen_viewed',
  ONBOARDING_ANSWER_SUBMITTED: 'onboarding_answer_submitted', ONBOARDING_GOAL_SELECTED: 'onboarding_goal_selected',
  ONBOARDING_COMPLETE: 'onboarding_completed', ONBOARDING_RESET: 'onboarding_reset', ACCOUNT_CREATED: 'account_created',
  ONBOARDING_V4_STARTED: 'onboarding_started', ONBOARDING_V4_SCREEN_VIEWED: 'onboarding_screen_viewed',
  ONBOARDING_V4_ANSWER_SUBMITTED: 'onboarding_answer_submitted', ONBOARDING_V4_PRIMARY_GOAL_SELECTED: 'primary_goal_selected',
  ONBOARDING_V4_INSIGHT_VIEWED: 'personal_insight_viewed', ONBOARDING_V4_DIETARY_SAVED: 'dietary_preferences_saved',
  ONBOARDING_V4_PLAN_VIEWED: 'personal_plan_viewed', ONBOARDING_V4_SCAN_INPUT_SELECTED: 'first_scan_input_selected',
  ONBOARDING_V4_CAMERA_PERMISSION_PROMPTED: 'camera_permission_prompted', ONBOARDING_V4_CAMERA_PERMISSION_RESULT: 'camera_permission_result',
  ONBOARDING_V4_PHOTO_CONFIRMED: 'photo_confirmed', ONBOARDING_V4_ANALYSIS_STARTED: 'analysis_started',
  ONBOARDING_V4_ANALYSIS_SUCCEEDED: 'analysis_succeeded', ONBOARDING_V4_ANALYSIS_FAILED: 'analysis_failed',
  ONBOARDING_V4_RECIPE_REVEALED: 'first_recipe_revealed', ONBOARDING_V4_ACTION_SELECTED: 'meaningful_action_selected',
  ONBOARDING_V4_PURCHASE_STARTED: 'purchase_started', ONBOARDING_V4_PURCHASE_SUCCEEDED: 'purchase_succeeded',
  ONBOARDING_V4_PURCHASE_FAILED: 'purchase_failed', ONBOARDING_V4_PURCHASE_RESTORED: 'purchase_restored',
  ONBOARDING_V4_COMPLETED: 'onboarding_completed',
  ONBOARDING_EXPERIMENT_STARTED: 'onboarding_experiment_started',
  ONBOARDING_EXPERIMENT_BRANCH_COMPLETED: 'onboarding_experiment_branch_completed',
  ACCOUNT_CREATION_STARTED: 'account_creation_started',
  SAVE_MONEY_STEP_VIEWED: 'save_money_step_viewed', SAVE_MONEY_STEP_COMPLETED: 'save_money_step_completed',
  GOAL_RECOMMENDED: 'onboarding_goal_selected', GOAL_CHANGED: 'onboarding_goal_selected',
  GOAL_SELECTED: 'onboarding_goal_selected', GOAL_CREATED: 'onboarding_goal_selected',
  MACRO_PROBLEM_SELECTED: 'onboarding_answer_submitted', MACRO_BARRIER_SELECTED: 'onboarding_answer_submitted',
  MACRO_TARGET_ENTERED: 'onboarding_answer_submitted', MACRO_PLAN_VIEWED: 'onboarding_screen_viewed',
  PERSONALIZATION_CONTINUE_SELECTED: 'onboarding_answer_submitted', PERSONALIZATION_SKIPPED: 'personalization_skipped',
  PERSONALIZATION_RESUME_CLICKED: 'onboarding_screen_viewed', PERSONALIZATION_COMPLETED: 'personalization_completed',
  SIGN_IN_STARTED: 'sign_in_started', SIGN_IN_SUCCEEDED: 'sign_in_succeeded', SIGN_IN_FAILED: 'sign_in_failed',
  SIGN_IN_SKIPPED: 'sign_in_skipped', SIGN_OUT: 'sign_out',
  SCAN_STARTED: 'scan_started', SCAN_SUCCEEDED: 'scan_succeeded', SCAN_FAILED: 'scan_failed',
  RECIPE_GENERATED: 'recipe_generated', RECIPE_VIEWED: 'recipe_viewed', RECIPE_SAVED: 'recipe_saved',
  RECIPE_UNSAVED: 'recipe_unsaved', RECIPE_CUSTOMIZED: 'recipe_customized',
  CUSTOMIZATION_STARTED: 'customization_started', CUSTOMIZATION_COMPLETED: 'customization_completed',
  GUIDED_TOUR_STARTED: 'guided_tour_started', GUIDED_TOUR_STEP_VIEWED: 'guided_tour_step_viewed',
  GUIDED_TOUR_COMPLETED: 'guided_tour_completed', GUIDED_TOUR_SKIPPED: 'guided_tour_skipped',
  SETTINGS_VIEWED: 'settings_viewed', ACCOUNT_DELETION_STARTED: 'account_deletion_started',
  ACCOUNT_DELETION_SUCCEEDED: 'account_deletion_succeeded', ACCOUNT_DELETION_FAILED: 'account_deletion_failed',
  LOCAL_DATA_CLEARED: 'local_data_cleared', CLIENT_ERROR: 'client_error', PERFORMANCE_TIMING: 'performance_timing',
  GROCERY_LIST_VIEWED: 'grocery_list_viewed', GROCERY_LIST_EXPORTED: 'grocery_list_exported',
  SHARE_CARD_GENERATED: 'share_card_generated', SHARE_COMPLETED: 'share_completed',
  CHALLENGE_STARTED: 'challenge_started', CHALLENGE_COMPLETED: 'challenge_completed',
  ACCURACY_RATING_SUBMITTED: 'accuracy_rating_submitted', BADGE_UNLOCKED: 'badge_unlocked',
  LEADERBOARD_VIEWED: 'leaderboard_viewed', RESTAURANT_PACK_VIEWED: 'restaurant_pack_viewed',
  PAYWALL_VIEWED: 'paywall_viewed', SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_RENEWED: 'subscription_renewed', SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
} as const satisfies Record<string, AnalyticsEventName>;

export type { AnalyticsEventName };
export type AnalyticsEventProperties = AnalyticsProperties;

/** Values are filtered again at the client boundary; raw content never passes through. */
export function track(eventName: AnalyticsEventName, properties: AnalyticsEventProperties = {}): void {
  try {
    clientTrack(eventName, properties);
  } catch {
    // Analytics must never interrupt the app.
  }
}
