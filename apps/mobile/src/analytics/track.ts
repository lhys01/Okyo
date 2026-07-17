import { Platform } from 'react-native';

import appConfig from '../../app.json';
import type { RecipeMode } from '../mocks';

export const analyticsEvents = {
  APP_OPEN: 'app_open',
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
  SETTINGS_VIEWED: 'settings_viewed',
  LOCAL_DATA_CLEARED: 'local_data_cleared',
} as const;

export type AnalyticsEventName = (typeof analyticsEvents)[keyof typeof analyticsEvents];

type BaseProperties = {
  dishName?: string;
  errorMessage?: string;
  mode?: RecipeMode | string;
  screen?: string;
  source?: string;
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
