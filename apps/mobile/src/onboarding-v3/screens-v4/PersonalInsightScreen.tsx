import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies, radius, spacing } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { useReduceMotion } from '../motion/useReduceMotion';
import type { OnboardingV4Draft } from '../state/onboardingV4Draft';
import type { OnboardingV4StageLabel } from '../state/onboardingV4Route';
import { buildOnboardingReveal, MACRO_TEACHING_EXAMPLE } from './onboardingRevealContent';

type Props = {
  stageLabel: OnboardingV4StageLabel | null;
  draft: OnboardingV4Draft;
  onBack: () => void;
  onContinue: () => void;
  onRevealed?: () => void;
};

const dish = require('../../../assets/food/recipes/teriyaki-chicken-bowl.png');

/** The payoff is visible on arrival. No extra tap, hold, or disabled CTA gate. */
export function PersonalInsightScreen({ draft, onBack, onContinue, onRevealed }: Props) {
  const content = buildOnboardingReveal(draft);
  const reduceMotion = useReduceMotion();
  const { height } = useWindowDimensions();
  const notified = useRef(false);
  useEffect(() => {
    if (notified.current) return;
    notified.current = true;
    onRevealed?.();
  }, [onRevealed]);
  const money = content.kind === 'money';
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>{content.title}</Text>
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(320)}>
          {money ? (
            <View style={styles.comparison}>
              <Text style={styles.label}>Eating out</Text>
              <Text style={styles.price}>{content.eatingOut}</Text>
              <Text accessible={false} style={styles.arrow}>↓</Text>
              <Text style={styles.label}>At home</Text>
              <Text style={styles.homePrice}>{content.home}</Text>
              <Image accessible={false} contentFit="contain" source={onboardingV3Assets.saveMoneyReveal} style={styles.receiptKiko} />
            </View>
          ) : (
            <View style={styles.foodScene}>
              <Image accessibilityLabel="Example chicken and rice bowl, not your generated recipe" accessibilityRole="image" contentFit="cover" source={dish} style={[styles.food, { height: Math.max(230, Math.min(350, height * 0.36)) }]} />
              <Text style={styles.exampleLabel}>Example dish</Text>
              {content.kind === 'health' ? <Image accessible={false} contentFit="contain" source={onboardingV3Assets.healthReveal} style={styles.foodKiko} /> : null}
            </View>
          )}
          {content.kind === 'macros' ? (
            <View style={styles.metrics}>
              <Text style={styles.label}>Illustrative nutrition example</Text>
              {content.metric === 'balanced' ? <Text style={styles.macroStrip}>38g protein · 65g carbs · 22g fat</Text> : (
                <View style={styles.heroMetric}>
                  <Text style={styles.metricNumber}>{content.metric === 'protein' ? MACRO_TEACHING_EXAMPLE.proteinGrams + 'g' : MACRO_TEACHING_EXAMPLE.calories}</Text>
                  <Text style={styles.metricUnit}>{content.metric}</Text>
                </View>
              )}
              {content.metric !== 'balanced' ? <Text style={styles.metricDetail}>{content.metric === 'protein' ? '610 calories · 65g carbs · 22g fat' : '38g protein · 65g carbs · 22g fat'}</Text> : null}
              {content.ownTargets.length ? <View style={styles.targets}><Text style={styles.label}>Your own daily reference</Text><Text style={styles.targetValues}>{content.ownTargets.join(' · ')}</Text><Text style={styles.note}>Your numbers, not targets recommended by Okyo.</Text></View> : null}
            </View>
          ) : null}
          {content.kind === 'health' ? <Text style={styles.suggestion}>{content.suggestion}</Text> : null}
          <Text style={styles.summary}>{content.summary}</Text>
          {content.kind === 'money' && content.replacementNote ? <Text style={styles.label}>{content.replacementNote}</Text> : null}
          {'note' in content ? <Text style={styles.note}>{content.note}</Text> : null}
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable accessibilityLabel="Try it on a dish" accessibilityRole="button" onPress={onContinue} style={({ pressed }) => [styles.primary, pressed && styles.pressed]} testID="personal-insight-continue"><Text style={styles.primaryLabel}>Try it on a dish</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: { minHeight: 48, paddingHorizontal: spacing.xl },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 },
  foodScene: { marginTop: spacing.xl, marginBottom: spacing.lg },
  food: { width: '100%', borderRadius: radius.hero, backgroundColor: colors.creamDeep },
  exampleLabel: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  foodKiko: { position: 'absolute', right: -8, bottom: -8, width: 100, height: 120 },
  comparison: { marginTop: spacing.xxl, paddingRight: spacing.xxl, paddingBottom: 112 },
  label: { color: colors.body, fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 21 },
  price: { color: colors.savings, fontFamily: fontFamilies.extraBold, fontSize: 64, lineHeight: 76, letterSpacing: -2 },
  arrow: { color: colors.savings, fontSize: 36, marginVertical: spacing.md },
  homePrice: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 28, lineHeight: 35, marginTop: spacing.sm },
  receiptKiko: { position: 'absolute', bottom: 0, right: 0, width: 90, height: 104 },
  metrics: { marginTop: spacing.sm },
  heroMetric: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.md },
  metricNumber: { color: colors.macros, fontFamily: fontFamilies.extraBold, fontSize: 64, lineHeight: 76, letterSpacing: -2 },
  metricUnit: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 22, lineHeight: 30 },
  macroStrip: { color: colors.macros, fontFamily: fontFamilies.bold, fontSize: 24, lineHeight: 34, marginTop: spacing.sm },
  metricDetail: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 15, lineHeight: 23 },
  targets: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.lg, marginTop: spacing.lg },
  targetValues: { color: colors.ink, fontFamily: fontFamilies.semibold, fontSize: 16, lineHeight: 24, marginTop: spacing.xs },
  suggestion: { color: colors.savings, fontFamily: fontFamilies.bold, fontSize: 22, lineHeight: 30, marginTop: spacing.sm },
  summary: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 17, lineHeight: 25, marginTop: spacing.lg },
  note: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 20, marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  primary: { backgroundColor: colors.coral, minHeight: 58, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  primaryLabel: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  pressed: { opacity: 0.8 },
});
