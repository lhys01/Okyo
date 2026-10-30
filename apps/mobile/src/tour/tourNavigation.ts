import type { NavigatorScreenParams } from '@react-navigation/native';

import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import type { TourStepScreen } from './tourSteps';

/**
 * TourOverlay is rendered beside the tab navigator, so its navigation context
 * is the root stack. Tab routes must always be addressed through MainTabs.
 */
export function getTourNavigationTarget(screen: TourStepScreen): { name: 'MainTabs'; params: NavigatorScreenParams<MainTabParamList> } | null {
  if (!screen) return null;
  return { name: 'MainTabs', params: { screen } };
}

export function navigateToTourScreen(
  navigate: <Name extends keyof RootStackParamList>(name: Name, params?: RootStackParamList[Name]) => void,
  screen: TourStepScreen,
): void {
  const target = getTourNavigationTarget(screen);
  if (target) navigate(target.name, target.params);
}
