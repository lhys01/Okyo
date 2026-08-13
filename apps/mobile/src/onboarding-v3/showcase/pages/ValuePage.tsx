import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, onboardingFontFamilies as fontFamilies } from '../../../theme/okyoTheme';
import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { motionTokens } from '../../motion/motionTokens';
import { useReduceMotion } from '../../motion/useReduceMotion';
import { showcaseContent } from '../showcaseContent';
import { ShowcasePageShell } from './ShowcasePageShell';
import type { ShowcasePageProps } from './types';

export function ValuePage(props: ShowcasePageProps) {
  const { height } = useWindowDimensions();
  const heroHeight = Math.min(375, Math.max(255, height * 0.44));
  return (
    <ShowcasePageShell ctaLabel="Let's go" {...props}>
      <View style={styles.content}>
        <ValueHero active={props.settled} style={[styles.hero, { height: heroHeight }]}>
          <View style={styles.halo} />
          <Image accessible={false} contentFit="contain" source={onboardingV3Assets.valuePastaBowl} style={styles.bowl} />
          <Image accessible={false} contentFit="contain" source={onboardingV3Assets.valueBrackets} style={styles.brackets} />
          <Image accessible={false} contentFit="contain" source={onboardingV3Assets.valueLeafTile} style={[styles.tile, styles.leaf]} />
          <Image accessible={false} contentFit="contain" source={onboardingV3Assets.valueChartTile} style={[styles.tile, styles.chart]} />
          <Image accessible={false} contentFit="contain" source={onboardingV3Assets.valueChefTile} style={[styles.tile, styles.chef]} />
          <Image accessible={false} contentFit="contain" source={onboardingV3Assets.valueClockTile} style={[styles.tile, styles.clock]} />
          <Image accessible={false} contentFit="contain" source={onboardingV3Assets.valueSparkles} style={styles.sparkles} />
        </ValueHero>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>{showcaseContent.value.title}</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.fact}>{showcaseContent.value.fact}</Text>
      </View>
    </ShowcasePageShell>
  );
}

function ValueHero({ active, children, style }: { active: boolean; children: ReactNode; style: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    if (active) {
      progress.value = withTiming(1, {
        duration: reduceMotion ? motionTokens.settle.reduceMotionMs : motionTokens.value.bowlMs,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [active, progress, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: reduceMotion ? 1 : 0.97 + progress.value * 0.03 }],
  }));
  return <Animated.View accessibilityLabel="A prepared pasta dish with nutrition, chart, chef, and time symbols" accessibilityRole="image" style={[style, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  hero: { maxHeight: '56%', position: 'relative', width: '100%' },
  halo: { backgroundColor: '#FFF0DE', borderRadius: 180, height: '78%', left: '11%', position: 'absolute', top: '9%', width: '78%' },
  bowl: { height: '60%', left: '13%', position: 'absolute', top: '20%', width: '74%' },
  brackets: { height: '49%', left: '25%', position: 'absolute', top: '25%', width: '50%' },
  tile: { height: '22%', position: 'absolute', width: '22%' },
  leaf: { left: '3%', top: '9%' },
  chart: { right: '3%', top: '12%' },
  chef: { bottom: '7%', left: '3%' },
  clock: { bottom: '5%', right: '3%' },
  sparkles: { height: '42%', left: '24%', position: 'absolute', top: '10%', width: '58%' },
  title: { alignSelf: 'stretch', color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 30, fontWeight: '900', letterSpacing: -0.9, lineHeight: 35, marginTop: 4, textAlign: 'center' },
  fact: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 15, fontWeight: '500', lineHeight: 22, marginTop: 10, maxWidth: 330, textAlign: 'center' },
});
