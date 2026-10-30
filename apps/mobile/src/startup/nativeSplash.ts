import * as NativeSplash from 'expo-splash-screen';
import { LAUNCH_FADE_MS } from './launchReadiness';

// Imported first by index.ts, before providers or the React root initialize.
void NativeSplash.preventAutoHideAsync().catch(() => undefined);
NativeSplash.setOptions({ duration: LAUNCH_FADE_MS, fade: true });

export async function hideNativeSplash(reduceMotion = false) {
  NativeSplash.setOptions({ duration: reduceMotion ? 0 : LAUNCH_FADE_MS, fade: !reduceMotion });
  await NativeSplash.hideAsync().catch(() => undefined);
}
