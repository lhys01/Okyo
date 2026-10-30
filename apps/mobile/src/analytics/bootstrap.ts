import { AppState, type AppStateStatus } from 'react-native';

import { track } from './analyticsClient';
import { analyticsScreenForRoute } from './sanitize';

/**
 * One-time analytics wiring, called from App.tsx. Resolves the anonymous id,
 * keeps primary_goal context in sync with the store, and emits session /
 * background / foreground lifecycle events. Never throws.
 */

let started = false;
let lastAppState: AppStateStatus = AppState.currentState;

export function bootstrapAnalytics(): void {
  if (started) return;
  started = true;

  track('session_started');

  AppState.addEventListener('change', (next) => {
    const wasActive = lastAppState === 'active';
    const isActive = next === 'active';
    lastAppState = next;

    if (!isActive && wasActive) {
      track('app_backgrounded');
      return;
    }
    if (isActive && !wasActive) {
      track('app_foregrounded');
    }
  });
}

/** Emits a static route category only; route params and typed content are ignored. */
export function trackScreenViewed(routeName: string | undefined): void {
  const screen = analyticsScreenForRoute(routeName);
  if (screen) track('screen_viewed', { screen });
}
