import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { motionTokens } from '../../motion/motionTokens';
import { useReduceMotion } from '../../motion/useReduceMotion';
import { showcaseContent } from '../showcaseContent';
import { ShowcasePageFrame, ShowcasePageShell } from './ShowcasePageShell';
import type { ShowcasePageProps } from './types';

export function MeetKikoPage(props: ShowcasePageProps) {
  const reduceMotion = useReduceMotion();
  const idleY = useSharedValue<number>(0);
  const idleRotation = useSharedValue<number>(-0.4);
  const entryOpacity = useSharedValue<number>(0);

  useEffect(() => {
    if (!props.settled) {
      entryOpacity.value = 0;
      idleY.value = 0;
      idleRotation.value = -0.4;
      return;
    }
    entryOpacity.value = withTiming(1, {
      duration: reduceMotion ? motionTokens.settle.reduceMotionMs : motionTokens.meetKiko.entryMs,
      easing: Easing.out(Easing.quad),
    });
    if (!reduceMotion) {
      idleY.value = withDelay(motionTokens.meetKiko.idleDelayMs, withRepeat(withTiming(-2, {
        duration: motionTokens.meetKiko.idleTranslateLegMs,
        easing: Easing.inOut(Easing.quad),
      }), -1, true));
      idleRotation.value = withDelay(motionTokens.meetKiko.idleDelayMs, withRepeat(withTiming(0.4, {
        duration: motionTokens.meetKiko.idleRotateLegMs,
        easing: Easing.inOut(Easing.quad),
      }), -1, true));
    } else {
      idleY.value = 0;
      idleRotation.value = 0;
    }
  }, [entryOpacity, idleRotation, idleY, props.settled, reduceMotion]);
  const heroStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [
      { translateY: reduceMotion ? 0 : (1 - entryOpacity.value) * 10 + idleY.value },
      { scale: reduceMotion ? 1 : 0.97 + entryOpacity.value * 0.03 },
      { rotate: `${reduceMotion ? 0 : idleRotation.value}deg` },
    ],
  }));
  return (
    <ShowcasePageShell {...props}>
      <ShowcasePageFrame artworkContent={
        <Animated.View accessibilityLabel="Kiko, the Okyo fox" accessibilityRole="image" style={[styles.hero, heroStyle]}>
            <Image accessible={false} contentFit="contain" source={onboardingV3Assets.welcomeArtwork} style={StyleSheet.absoluteFill} />
        </Animated.View>
      } body="" title={showcaseContent.meetKiko.title} />
    </ShowcasePageShell>
  );
}

const styles = StyleSheet.create({
  hero: { height: '100%', width: '100%' },
});
