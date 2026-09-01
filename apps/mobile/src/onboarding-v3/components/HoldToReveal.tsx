import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, onboardingFontFamilies as fontFamilies, onboardingTitleFont } from '../../theme/okyoTheme';
import { useReduceMotion } from '../motion/useReduceMotion';

export const HOLD_TO_REVEAL_DURATION_MS = 1000;

export function HoldToReveal({ prompt, onComplete, showMacrosArtwork = false }: { prompt: string; onComplete: () => void; showMacrosArtwork?: boolean }) {
  const progress = useSharedValue(0);
  const completed = useRef(false);
  const midpointCue = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReduceMotion();

  const clearMidpointCue = () => {
    if (midpointCue.current) clearTimeout(midpointCue.current);
    midpointCue.current = null;
  };

  useEffect(() => clearMidpointCue, []);

  const finish = () => {
    if (completed.current) return;
    clearMidpointCue();
    completed.current = true;
    Vibration.vibrate(20);
    onComplete();
  };

  const start = () => {
    clearMidpointCue();
    completed.current = false;
    Vibration.vibrate(8);
    midpointCue.current = setTimeout(() => Vibration.vibrate(8), HOLD_TO_REVEAL_DURATION_MS / 2);
    progress.value = withTiming(1, {
      duration: HOLD_TO_REVEAL_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
    }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  };

  const release = () => {
    clearMidpointCue();
    if (completed.current) return;
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: reduceMotion ? 0 : 160 });
  };

  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.round(progress.value * 100)}%` }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : progress.value * 0.28,
    transform: [{ scale: reduceMotion ? 1 : 1 + progress.value * 0.035 }],
  }));

  return (
    <View style={styles.wrap}>
      {showMacrosArtwork ? (
        <View accessibilityElementsHidden style={styles.macrosArtWrap}>
          <Image contentFit="contain" source={require('../../../assets/onboarding-v3/stickers/fox-waving-alt.png')} style={styles.macrosArt} />
          <View style={styles.meterTile}><Text style={styles.meterTileText}>MACROS</Text></View>
        </View>
      ) : null}
      <Text style={styles.prompt}>{prompt}</Text>
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
      <Pressable
        accessibilityActions={[{ name: 'activate', label: 'Reveal result' }]}
        accessibilityHint="Hold for one second, or use the activate accessibility action."
        accessibilityLabel="Hold to reveal"
        accessibilityRole="button"
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') finish();
        }}
        onPressIn={start}
        onPressOut={release}
        style={styles.button}
      >
        <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} />
        <Text style={styles.label}>Hold to reveal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', flex: 1, justifyContent: 'center', position: 'relative', width: '100%' },
  prompt: { ...onboardingTitleFont, color: colors.charcoal, fontSize: 31, letterSpacing: -0.8, lineHeight: 38, marginBottom: 34, maxWidth: 350, textAlign: 'center' },
  macrosArtWrap: { height: 224, marginBottom: 8, position: 'relative', width: '100%' },
  macrosArt: { height: 210, position: 'absolute', right: 18, top: 0, width: 190 },
  meterTile: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, bottom: 22, justifyContent: 'center', left: 32, minHeight: 58, paddingHorizontal: 14, position: 'absolute', transform: [{ rotate: '-10deg' }] },
  meterTileText: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 0.7 },
  glow: { backgroundColor: colors.coral, borderRadius: 999, height: '140%', position: 'absolute', width: '140%' },
  button: { alignItems: 'center', backgroundColor: '#FFA8C2', borderColor: '#FFA8C2', borderRadius: 999, borderWidth: 2, height: 68, justifyContent: 'center', maxWidth: 340, overflow: 'hidden', width: '90%' },
  fill: { backgroundColor: '#FFA8C2', bottom: 0, left: 0, position: 'absolute', top: 0 },
  label: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 17, fontWeight: '700' },
});
