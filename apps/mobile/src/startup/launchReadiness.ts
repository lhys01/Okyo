export const LAUNCH_TIMEOUT_MS = 15000;
export const LAUNCH_FADE_MS = 180;

export type LaunchReadiness = {
  resources: boolean;
  navigation: boolean;
  destination: boolean;
  image: boolean;
  layout: boolean;
};

export function isLaunchReady(state: LaunchReadiness): boolean {
  return state.resources && state.navigation && state.destination && state.image && state.layout;
}
