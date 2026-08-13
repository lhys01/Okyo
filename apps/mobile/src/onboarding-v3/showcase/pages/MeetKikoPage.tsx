import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, onboardingFontFamilies as fontFamilies } from '../../../theme/okyoTheme';
import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { motionTokens } from '../../motion/motionTokens';
import { useReduceMotion } from '../../motion/useReduceMotion';
import { showcaseContent } from '../showcaseContent';
import { ShowcasePageShell } from './ShowcasePageShell';
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
      <View style={styles.content}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>{showcaseContent.meetKiko.title}</Text>
        <View style={styles.heroArea}>
          <Animated.View accessibilityLabel="Kiko, the Okyo fox" accessibilityRole="image" style={[styles.hero, heroStyle]}>
            <Image accessible={false} contentFit="contain" source={onboardingV3Assets.meetKikoHeroUpdated} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </View>
    </ShowcasePageShell>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  title: { alignSelf: 'stretch', color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 31, fontWeight: '900', letterSpacing: -1, lineHeight: 36, textAlign: 'center', transform: [{ translateY: -18 }] },
  heroArea: { aspectRatio: 1, maxHeight: '70%', position: 'relative', width: '125%' },
  hero: { bottom: '-1%', left: '4%', position: 'absolute', top: '0%', width: '92%' },
});
