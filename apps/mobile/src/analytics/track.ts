import { Platform } from 'react-native';

import appConfig from '../../app.json';
import type { RecipeMode } from '../mocks';
import type { ShareCardType } from '../navigation/types';

export const analyticsEvents = {
  APP_OPEN: 'app_open',
  ONBOARDING_START: 'onboarding_start',
  ONBOARDING_GOAL_SELECTED: 'onboarding_goal_selected',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  SCAN_STARTED: 'scan_started',
  PHOTO_UPLOADED: 'photo_uploaded',
  DISH_DETECTED: 'dish_detected',
  RECIPE_GENERATED: 'recipe_generated',
  RESULT_VIEWED: 'result_viewed',
  RESULT_ERROR: 'result_error',
  MODE_SELECTED: 'mode_selected',
  RECIPE_SAVED: 'recipe_saved',
  GROCERY_LIST_VIEWED: 'grocery_list_viewed',
  GROCERY_LIST_EXPORTED: 'grocery_list_exported',
  SHARE_CARD_GENERATED: 'share_card_generated',
  SHARE_TAPPED: 'share_tapped',
  SHARE_COMPLETED: 'share_completed',
  CHALLENGE_STARTED: 'challenge_started',
  CHALLENGE_COMPLETED: 'challenge_completed',
  ACCURACY_RATING_SUBMITTED: 'accuracy_rating_submitted',
  XP_EVENT_RECORDED: 'xp_event_recorded',
  BADGE_UNLOCKED: 'badge_unlocked',
  LEADERBOARD_VIEWED: 'leaderboard_viewed',
  RESTAURANT_PACK_VIEWED: 'restaurant_pack_viewed',
  PAYWALL_VIEWED: 'paywall_viewed',
  SETTINGS_VIEWED: 'settings_viewed',
  ONBOARDING_RESET: 'onboarding_reset',
  LOCAL_DATA_CLEARED: 'local_data_cleared',

  // V4 onboarding rebuild (Okyo_Onboarding_V4_Implementation_Plan.md Step 02).
  // Distinct event names from the V3 keys above by design — V4 is a parallel,
  // inert flow until Step 11, and must not conflate its funnel with V3's.
  // Not called from any real screen yet; see analytics/onboardingV4Events.ts.
  ONBOARDING_V4_STARTED: 'onboarding_started',
  ONBOARDING_V4_SCREEN_VIEWED: 'onboarding_screen_viewed',
  ONBOARDING_V4_ANSWER_SUBMITTED: 'onboarding_answer_submitted',
  ONBOARDING_V4_PRIMARY_GOAL_SELECTED: 'primary_goal_selected',
  ONBOARDING_V4_INSIGHT_VIEWED: 'personal_insight_viewed',
  ONBOARDING_V4_DIETARY_SAVED: 'dietary_preferences_saved',
  ONBOARDING_V4_PLAN_VIEWED: 'personal_plan_viewed',
  ONBOARDING_V4_SCAN_INPUT_SELECTED: 'first_scan_input_selected',
  ONBOARDING_V4_CAMERA_PERMISSION_PROMPTED: 'camera_permission_prompted',
  ONBOARDING_V4_CAMERA_PERMISSION_RESULT: 'camera_permission_result',
  ONBOARDING_V4_PHOTO_CONFIRMED: 'photo_confirmed',
  ONBOARDING_V4_ANALYSIS_STARTED: 'analysis_started',
  ONBOARDING_V4_ANALYSIS_SUCCEEDED: 'analysis_succeeded',
  ONBOARDING_V4_ANALYSIS_FAILED: 'analysis_failed',
  ONBOARDING_V4_RECIPE_REVEALED: 'first_recipe_revealed',
  ONBOARDING_V4_MEANINGFUL_ACTION_SELECTED: 'meaningful_action_selected',
  ONBOARDING_V4_PURCHASE_STARTED: 'purchase_started',
  ONBOARDING_V4_PURCHASE_SUCCEEDED: 'purchase_succeeded',
  ONBOARDING_V4_PURCHASE_FAILED: 'purchase_failed',
  ONBOARDING_V4_PURCHASE_RESTORED: 'purchase_restored',
  ONBOARDING_V4_COMPLETED: 'onboarding_completed',
} as const;

export type AnalyticsEventName = (typeof analyticsEvents)[keyof typeof analyticsEvents];

type BaseProperties = {
  badgeName?: string;
  cardType?: ShareCardType;
  dishName?: string;
  errorMessage?: string;
  mode?: RecipeMode | string;
  packName?: string;
  rating?: string;
  savings?: number;
  screen?: string;
  source?: string;
  xpAmount?: number;
};

export type AnalyticsEventProperties = BaseProperties & Record<string, string | number | boolean | null | undefined>;

const appContext = {
  appName: appConfig.expo.name,
  appVersion: appConfig.expo.version,
  platform: Platform.OS,
};

const shouldLogAnalytics = false;

export function track(eventName: AnalyticsEventName, properties: AnalyticsEventProperties = {}) {
  try {
    if (!shouldLogAnalytics) {
      return;
    }

    console.log('[Okyo analytics]', {
      eventName,
      properties,
      context: appContext,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Analytics must never interrupt the app.
  }
}
