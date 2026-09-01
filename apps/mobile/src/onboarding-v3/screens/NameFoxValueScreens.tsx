import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Leaf, Sparks } from 'iconoir-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, homeRecipeCardShadow, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { OnboardingCTA } from '../components/OnboardingCTA';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const GRAPH_LENGTH = 820;

export function NameFoxValueScreen({ page, onBack, onNext }: { page: 0 | 1; onBack: () => void; onNext: () => void }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      {page === 0 ? <SavingsExplainer onBack={onBack} onNext={onNext} /> : <ApproachExplainer onBack={onBack} onNext={onNext} />}
    </SafeAreaView>
  );
}

function SavingsExplainer({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { height, width } = useWindowDimensions();
  const compactLayout = height < 740 || width < 380;
  const graphHeight = compactLayout ? 220 : 250;
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: reduceMotion ? 0 : motionTokens.graphDraw.durationMs, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: GRAPH_LENGTH * (1 - progress.value) }));
  const dashedProps = useAnimatedProps(() => ({ strokeDashoffset: GRAPH_LENGTH * progress.value }));

  return (
    <View style={[styles.screen, styles.savingsScreen]}>
      <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
      <View style={[styles.savingsContent, compactLayout && styles.savingsContentCompact]}>
        <View style={[styles.titleRow, compactLayout && styles.titleRowCompact]}>
          <Sparks color={colors.savings} height={26} strokeWidth={2.5} width={26} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.15} style={[styles.title, compactLayout && styles.savingsTitleCompact]}>Okyo helps{`\n`}habits stick<Text style={styles.titleDot}>.</Text></Text>
          <Sparks color={colors.savings} height={22} strokeWidth={2.5} width={22} />
        </View>
        <View style={styles.graphWrap}>
          <View accessibilityLabel="Money spent trend. Horizontal axis: Time. Green line endpoint: Okyo. Coral dashed line endpoint: Takeout." accessibilityRole="image" style={[styles.graphCard, compactLayout && styles.graphCardCompact]}>
            <Text style={[styles.graphLabel, compactLayout && styles.graphLabelCompact]}>Money spent</Text>
            <Svg height={graphHeight} viewBox="0 0 320 240" width="100%">
              <Path d="M24 28 V184" stroke={colors.border} strokeWidth={1.5} />
              <Path d="M24 184 H300" stroke={colors.border} strokeWidth={1.5} />
              <AnimatedPath animatedProps={lineProps} d="M24 52 C80 50 88 98 140 118 S218 186 292 170" fill="none" stroke={colors.savings} strokeDasharray={GRAPH_LENGTH} strokeLinecap="round" strokeWidth={6} />
              <AnimatedPath animatedProps={dashedProps} d="M24 52 C68 190 138 206 176 120 S232 28 292 40" fill="none" stroke={colors.health} strokeDasharray="14 12" strokeLinecap="round" strokeWidth={5} />
              <Circle cx="292" cy="170" fill={colors.savings} r="9" />
              <Circle cx="292" cy="40" fill={colors.health} r="9" />
              <SvgText fill={colors.ink} fontFamily={fontFamilies.bold} fontSize="14" textAnchor="end" x="278" y="20">Takeout</SvgText>
              <SvgText fill={colors.ink} fontFamily={fontFamilies.bold} fontSize="14" textAnchor="end" x="278" y="164">Okyo</SvgText>
            </Svg>
            <Text accessibilityLabel="Horizontal axis: Time" style={[styles.axisLabel, compactLayout && styles.axisLabelCompact]}>Time</Text>
            <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.saveMoneyGraphSparkle} style={styles.graphSparkle} />
          </View>
          <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.saveMoneyIntro} style={[styles.graphChef, compactLayout && styles.graphChefCompact]} />
        </View>
        <PopInsight delay={120}>
          <View style={[styles.insightCard, homeRecipeCardShadow]}>
          <Leaf color={colors.savings} height={26} strokeWidth={2} width={26} />
          <Text maxFontSizeMultiplier={1.2} style={styles.insightText}>Small cooking habits lead to <Text style={styles.insightAccent}>steady savings</Text> over time.</Text>
          <Sparks color={colors.savings} height={22} strokeWidth={2} width={22} />
          </View>
        </PopInsight>
      </View>
      <OnboardingCTA accessibilityLabel="Continue to the next Okyo introduction" label="Next" onPress={onNext} tone="pastelPink" />
    </View>
  );
}

function ApproachExplainer({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { height, width } = useWindowDimensions();
  const compactLayout = height < 740 || width < 380;

  return (
    <View style={styles.screen}>
      <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
      <View style={[styles.approachContent, compactLayout && styles.approachContentCompact]}>
        <View style={styles.titleRow}>
          <Sparks color={colors.skyBlue} height={24} strokeWidth={2.5} width={24} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.15} style={[styles.title, compactLayout && styles.approachTitleCompact]}>Why Okyo’s{`\n`}approach works</Text>
        </View>
        <Text maxFontSizeMultiplier={1.2} style={[styles.approachSupport, compactLayout && styles.approachSupportCompact]}>Scan a dish, get the details, and make it yours.</Text>
        <PopInsight delay={0}>
          <View style={styles.approachFeatureShadow}>
            <View accessibilityLabel="Okyo approach: scan a dish, get its recipe and details, then customize it with Kiko" accessibilityRole="image" style={[styles.approachFeature, compactLayout && styles.approachFeatureCompact]} testID="okyo-approach-feature">
              <View style={[styles.approachHeroStage, compactLayout && styles.approachHeroStageCompact]}>
                <Image accessibilityIgnoresInvertColors accessible={false} contentFit="contain" source={onboardingV3Assets.approachHeroSticker} style={styles.approachHeroSticker} />
              </View>
              <View style={styles.approachSteps}>
                <View style={styles.approachStep}>
                  <View style={styles.approachStepNumber}><Text style={styles.approachStepNumberText}>1</Text></View>
                  <Text maxFontSizeMultiplier={1.2} style={styles.approachStepText}>Scan any dish</Text>
                </View>
                <View style={styles.approachStep}>
                  <View style={styles.approachStepNumber}><Text style={styles.approachStepNumberText}>2</Text></View>
                  <Text maxFontSizeMultiplier={1.2} style={styles.approachStepText}>Get the recipe and useful details</Text>
                </View>
                <View style={styles.approachStep}>
                  <View style={styles.approachStepNumber}><Text style={styles.approachStepNumberText}>3</Text></View>
                  <Text maxFontSizeMultiplier={1.2} style={styles.approachStepText}>Customize it with Kiko</Text>
                </View>
              </View>
            </View>
          </View>
        </PopInsight>
      </View>
      <OnboardingCTA accessibilityLabel="Continue to name" label="Let’s go" onPress={onNext} tone="pastelPink" />
    </View>
  );
}

function PopInsight({ children, delay }: { children: ReactNode; delay: number }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: reduceMotion ? 0 : motionTokens.enter.durationMs, easing: Easing.out(Easing.back(1.1)) }));
  }, [delay, progress, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 18 },
      { scale: 0.94 + progress.value * 0.06 },
    ],
  }));
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  screen: { backgroundColor: colors.background, flex: 1, paddingBottom: 18, paddingHorizontal: 24 },
  savingsScreen: { backgroundColor: colors.background },
  header: { paddingTop: 18 },
  savingsContent: { flex: 1, gap: 12, justifyContent: 'center', paddingBottom: 10, paddingTop: 4 },
  savingsContentCompact: { gap: 8, paddingTop: 0 },
  approachContent: { flex: 1, justifyContent: 'center', paddingBottom: 12, paddingTop: 8 },
  approachContentCompact: { paddingTop: 2 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center' },
  titleRowCompact: { gap: 6 },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 42, letterSpacing: -1.3, lineHeight: 44, textAlign: 'center' },
  savingsTitleCompact: { fontSize: 34, lineHeight: 36, letterSpacing: -0.9 },
  approachTitleCompact: { fontSize: 29, lineHeight: 31 },
  titleDot: { color: colors.health, fontFamily: fontFamilies.extraBold, fontSize: 40 },
  graphWrap: { position: 'relative' },
  graphCard: { ...homeRecipeCardShadow, backgroundColor: colors.surface, borderRadius: 28, gap: 4, minHeight: 356, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18 },
  graphCardCompact: { minHeight: 316, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  graphLabel: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 20 },
  graphLabelCompact: { fontSize: 17 },
  axisLabel: { color: colors.ink, fontFamily: fontFamilies.semibold, fontSize: 18, marginTop: 0, textAlign: 'center' },
  axisLabelCompact: { fontSize: 16 },
  graphSparkle: { height: 26, position: 'absolute', right: 10, top: 34, width: 20, zIndex: 1 },
  graphChef: { bottom: -14, height: 96, left: 6, position: 'absolute', width: 86, zIndex: 2 },
  graphChefCompact: { bottom: -10, height: 74, left: 2, width: 66 },
  insightCard: { alignItems: 'center', backgroundColor: '#F0F9E9', borderColor: '#DDECCE', borderRadius: 24, flexDirection: 'row', gap: 12, minHeight: 86, paddingHorizontal: 16, paddingVertical: 12 },
  insightText: { color: colors.ink, flex: 1, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 23 },
  insightAccent: { color: colors.savings, fontFamily: fontFamilies.bold },
  legendText2: { color: colors.muted },
  approachSupport: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 22, marginBottom: 16, marginTop: 10, textAlign: 'center' },
  approachSupportCompact: { fontSize: 14, lineHeight: 19, marginBottom: 10, marginTop: 6 },
  approachFeatureShadow: { ...homeRecipeCardShadow, alignSelf: 'center', maxWidth: 440, width: '100%' },
  approachFeature: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 28, borderWidth: 1, overflow: 'hidden', width: '100%' },
  approachFeatureCompact: { borderRadius: 24 },
  approachHeroStage: { alignItems: 'center', backgroundColor: colors.coralSoft, height: 190, justifyContent: 'center', margin: 10, borderRadius: 22 },
  approachHeroStageCompact: { height: 148, margin: 8 },
  approachHeroSticker: { height: '92%', width: '82%' },
  approachSteps: { paddingHorizontal: 18, paddingBottom: 12 },
  approachStep: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: 12, minHeight: 48 },
  approachStepNumber: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: 999, height: 26, justifyContent: 'center', width: 26 },
  approachStepNumberText: { color: colors.surface, fontFamily: fontFamilies.bold, fontSize: 14 },
  approachStepText: { color: colors.ink, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 },
});
