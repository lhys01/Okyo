import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { StatsUpSquare } from 'iconoir-react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, onboardingFontFamilies as fontFamilies } from '../../../theme/okyoTheme';
import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { motionTokens } from '../../motion/motionTokens';
import { useReduceMotion } from '../../motion/useReduceMotion';
import { showcaseContent } from '../showcaseContent';
import { ShowcasePageShell } from './ShowcasePageShell';
import type { ShowcasePageProps } from './types';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const LINE_LENGTH = 360;

export function SavingsPage(props: ShowcasePageProps) {
  const reduceMotion = useReduceMotion();
  const okyoProgress = useSharedValue(reduceMotion ? 1 : 0);
  const takeoutProgress = useSharedValue(reduceMotion ? 1 : 0);
  const endpointProgress = useSharedValue(reduceMotion ? 1 : 0);
  const calloutProgress = useSharedValue(reduceMotion ? 1 : 0);
  const cardProgress = useSharedValue(reduceMotion ? 0 : 1);

  useEffect(() => {
    if (!props.settled || reduceMotion) {
      okyoProgress.value = reduceMotion ? 1 : 0;
      takeoutProgress.value = reduceMotion ? 1 : 0;
      endpointProgress.value = reduceMotion ? 1 : 0;
      calloutProgress.value = reduceMotion ? 1 : 0;
      cardProgress.value = props.settled && reduceMotion
        ? withTiming(1, { duration: motionTokens.settle.reduceMotionMs, easing: Easing.linear })
        : reduceMotion ? 0 : 1;
      return;
    }
    cardProgress.value = 1;
    okyoProgress.value = withDelay(motionTokens.graph.textLeadMs, withTiming(1, { duration: motionTokens.graph.lineMs, easing: Easing.out(Easing.quad) }));
    takeoutProgress.value = withDelay(motionTokens.graph.takeoutDelayMs, withTiming(1, { duration: motionTokens.graph.lineMs, easing: Easing.out(Easing.quad) }));
    endpointProgress.value = withDelay(motionTokens.graph.endpointDelayMs, withTiming(1, { duration: motionTokens.graph.endpointMs, easing: Easing.out(Easing.quad) }));
    calloutProgress.value = withDelay(motionTokens.graph.footnoteDelayMs, withTiming(1, { duration: motionTokens.graph.footnoteMs, easing: Easing.out(Easing.quad) }));
  }, [calloutProgress, cardProgress, endpointProgress, okyoProgress, props.settled, reduceMotion, takeoutProgress]);

  const okyoProps = useAnimatedProps(() => ({ strokeDashoffset: LINE_LENGTH * (1 - okyoProgress.value) }));
  const takeoutProps = useAnimatedProps(() => ({ strokeDashoffset: LINE_LENGTH * (1 - takeoutProgress.value) }));
  const endpointProps = useAnimatedProps(() => ({ opacity: endpointProgress.value, r: 7 * (0.8 + endpointProgress.value * 0.2) }));
  const graphStyle = useAnimatedStyle(() => ({ opacity: cardProgress.value }));
  const calloutStyle = useAnimatedStyle(() => ({
    opacity: calloutProgress.value * cardProgress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - calloutProgress.value) * 6 }],
  }));

  return (
    <ShowcasePageShell {...props}>
      <View style={styles.content}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>{showcaseContent.savings.title}</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.body}>{showcaseContent.savings.body}</Text>
        <Animated.View accessibilityLabel="Illustrative graph comparing increasing takeout spending with lower home-cooking spending using Okyo." accessibilityRole="image" style={[styles.graph, graphStyle]}>
          <Image accessible={false} contentFit="fill" source={onboardingV3Assets.savingsGraphFrame} style={StyleSheet.absoluteFill} />
          <View accessible={false} style={styles.graphInterior} />
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendLine, styles.takeoutLegend]} /><Text style={styles.legendText}>Takeout spending</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendLine, styles.okyoLegend]} /><Text style={styles.legendText}>With Okyo</Text></View>
          </View>
          <Text maxFontSizeMultiplier={1.1} style={[styles.axisLabel, styles.mealLabel]}>Estimated spending</Text>
          <Text maxFontSizeMultiplier={1.1} style={[styles.axisLabel, styles.timeLabel]}>Time</Text>
          <Svg preserveAspectRatio="xMidYMid meet" style={styles.svg} viewBox="0 0 400 250" width="100%">
            <Path d="M30 8 V225 H370" fill="none" stroke="#E4C9B7" strokeLinecap="round" strokeWidth="2" />
            <AnimatedPath animatedProps={okyoProps} d="M30 98 C105 94 135 123 205 151 S292 187 370 194" fill="none" stroke={colors.green} strokeDasharray={LINE_LENGTH} strokeLinecap="round" strokeWidth="7" />
            <AnimatedPath animatedProps={takeoutProps} d="M30 98 C95 79 151 78 213 52 S303 39 370 18" fill="none" stroke="#F26C55" strokeDasharray={`${LINE_LENGTH} 10`} strokeLinecap="round" strokeWidth="5" />
            <AnimatedCircle animatedProps={endpointProps} cx="30" cy="98" fill="#FFFFFF" stroke={colors.green} strokeWidth="5" />
            <AnimatedCircle animatedProps={endpointProps} cx="370" cy="194" fill="#FFFFFF" stroke={colors.green} strokeWidth="5" />
            <AnimatedCircle animatedProps={endpointProps} cx="370" cy="18" fill="#F26C55" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.callout, calloutStyle]}>
          <View style={styles.calloutIcon}><StatsUpSquare color={colors.green} height={24} strokeWidth={2.5} width={24} /></View>
          <View style={styles.calloutCopy}>
            <Text maxFontSizeMultiplier={1.1} style={styles.exampleLabel}>{showcaseContent.savings.exampleLabel}</Text>
            <Text maxFontSizeMultiplier={1.1} style={styles.exampleAmount}>{showcaseContent.savings.exampleAmount}</Text>
          </View>
        </Animated.View>
      </View>
    </ShowcasePageShell>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  title: { alignSelf: 'stretch', color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 29, fontWeight: '900', letterSpacing: -0.8, lineHeight: 34, textAlign: 'center' },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, fontWeight: '500', lineHeight: 19, marginTop: 6, maxWidth: 330, textAlign: 'center' },
  graph: { aspectRatio: 1.25, backgroundColor: '#FEFCFA', borderRadius: 28, marginTop: 12, maxHeight: '52%', overflow: 'hidden', position: 'relative', width: '100%' },
  graphInterior: { backgroundColor: '#FEFCFA', borderRadius: 20, bottom: '6%', left: '5%', position: 'absolute', right: '5%', top: '5%' },
  legend: { flexDirection: 'row', gap: 12, left: '8%', position: 'absolute', top: '7%', zIndex: 2 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  legendLine: { borderRadius: 3, height: 4, width: 16 },
  takeoutLegend: { backgroundColor: '#F26C55' },
  okyoLegend: { backgroundColor: colors.green },
  legendText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 9.5, fontWeight: '700' },
  svg: { bottom: '12%', height: '68%', left: '8%', position: 'absolute', width: '84%' },
  axisLabel: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 9.5, fontWeight: '500', position: 'absolute' },
  mealLabel: { left: '8%', top: '18%' },
  timeLabel: { bottom: '4%', left: '9%' },
  callout: { alignItems: 'center', backgroundColor: '#EEF6E6', borderColor: '#D9EACD', borderRadius: 20, borderWidth: 1, flexDirection: 'row', marginTop: 10, maxWidth: 360, paddingHorizontal: 13, paddingVertical: 10, width: '100%' },
  calloutIcon: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 17, height: 38, justifyContent: 'center', width: 38 },
  calloutCopy: { flex: 1, marginLeft: 10 },
  exampleLabel: { color: colors.green, fontFamily: fontFamilies.bold, fontSize: 9, fontWeight: '700', letterSpacing: 0.45, textTransform: 'uppercase' },
  exampleAmount: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 14, fontWeight: '700', marginTop: 1 },
});
