import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { hideNativeSplash } from './nativeSplash';
import { isLaunchReady, LAUNCH_FADE_MS, LAUNCH_TIMEOUT_MS, type LaunchReadiness } from './launchReadiness';

export const LAUNCH_BACKGROUND = '#1BE390';
export const launchArtwork = require('../../assets/splash/okyo-loading.png');

const noop: () => void = () => {};
const LaunchContext = createContext({
  finished: true,
  setResourcesReady: (_ready: boolean) => {},
  markNavigationReady: noop,
  markDestinationReady: (_standalone?: boolean) => {},
});

export function useLaunchStartup() { return useContext(LaunchContext); }

/** Signals after the chosen screen commits, without making any routing decision. */
export function useLaunchDestinationReady(ready: boolean, standalone = false) {
  const { markDestinationReady } = useLaunchStartup();
  useEffect(() => {
    if (!ready) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => markDestinationReady(standalone));
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [ready, standalone, markDestinationReady]);
}

export function LaunchArtwork() {
  return <Image accessibilityIgnoresInvertColors contentFit="cover" contentPosition="center" source={launchArtwork} style={StyleSheet.absoluteFill} />;
}

export function LaunchBoundary({ children, onRetry }: { children: ReactNode; onRetry: () => void }) {
  const [state, setState] = useState<LaunchReadiness>({ resources: false, navigation: false, destination: false, image: false, layout: false });
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const ready = isLaunchReady(state);
  const setResourcesReady = useCallback((resources: boolean) => setState((old) => old.resources === resources ? old : { ...old, resources }), []);
  const markNavigationReady = useCallback(() => setState((old) => old.navigation ? old : { ...old, navigation: true }), []);
  const markDestinationReady = useCallback((standalone = false) => setState((old) => ({ ...old, destination: true, navigation: old.navigation || standalone })), []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (ready || finished || failed) return;
    const timeout = setTimeout(() => setFailed(true), LAUNCH_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [ready, finished, failed]);

  useEffect(() => {
    if ((!ready && !failed) || finished) return;
    // The destination (or recovery UI) is committed underneath before native dismissal.
    const frame = requestAnimationFrame(() => {
      void hideNativeSplash(reduceMotion);
      if (failed) return;
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : LAUNCH_FADE_MS, useNativeDriver: true })
        .start(({ finished: completed }) => { if (completed) setFinished(true); });
    });
    return () => { cancelAnimationFrame(frame); opacity.stopAnimation(); };
  }, [ready, failed, finished, reduceMotion, opacity]);

  return (
    <LaunchContext.Provider value={{ finished, setResourcesReady, markNavigationReady, markDestinationReady }}>
      <View style={styles.root} onLayout={() => setState((old) => old.layout ? old : { ...old, layout: true })}>
        {children}
        {failed ? (
          <View accessibilityRole="alert" style={[StyleSheet.absoluteFill, styles.recovery]}>
            <StatusBar hidden />
            <Text style={styles.message}>Okyo couldn’t finish opening.</Text>
            <Text style={styles.detail}>Please try again in a moment.</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        ) : !finished ? (
          <Animated.View pointerEvents="auto" accessibilityLabel="Opening Okyo" style={[StyleSheet.absoluteFill, styles.root, { opacity }]}>
            <StatusBar hidden />
            <Image accessibilityIgnoresInvertColors contentFit="cover" contentPosition="center" source={launchArtwork} style={StyleSheet.absoluteFill}
              onLoad={() => setState((old) => old.image ? old : { ...old, image: true })} onError={() => setFailed(true)} />
          </Animated.View>
        ) : null}
      </View>
    </LaunchContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: LAUNCH_BACKGROUND, flex: 1 },
  recovery: { backgroundColor: LAUNCH_BACKGROUND, alignItems: 'center', justifyContent: 'center', padding: 28 },
  message: { color: '#10271e', fontSize: 21, fontWeight: '700', textAlign: 'center' },
  detail: { color: '#10271e', fontSize: 16, marginTop: 12, textAlign: 'center' },
  retry: { backgroundColor: '#fff', borderRadius: 24, marginTop: 24, paddingHorizontal: 28, paddingVertical: 14 },
  retryText: { color: '#10271e', fontSize: 17, fontWeight: '600' },
});
