import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, onboardingFontFamilies as fonts, radius, spacing } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { BRANCH_Q2_TITLE, SAVINGS_Q2_HELPER } from './onboardingV4BranchCopy';
import type { OnboardingV4StageLabel } from '../state/onboardingV4Route';
import { FitText } from '../../components/FitText';

type Props = {
  stageLabel: OnboardingV4StageLabel | null;
  value: number | null;
  replacementsPerWeek?: number;
  onBack: () => void;
  onConfirm: (cost: number, replacementsPerWeek: number) => void;
  onSkip: () => void;
};

/** Local suggested values become answers only after explicit confirmation. */
export function SavingsSpendQuestionScreen({ value, replacementsPerWeek, onBack, onConfirm, onSkip }: Props) {
  const [cost, setCost] = useState(value ?? 18);
  const [meals, setMeals] = useState(replacementsPerWeek ?? 1);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>{BRANCH_Q2_TITLE.save_money}</Text>
        <Text style={styles.helper}>{SAVINGS_Q2_HELPER} This part is optional.</Text>
        <Stepper label="Typical meal" value={cost} display={'$' + cost} min={1} max={200} onChange={setCost} />
        <Stepper label="Meals you'd replace each week" value={meals} display={String(meals)} min={1} max={14} onChange={setMeals} />
        {value === null ? <Text style={styles.note}>These are starting values. Change them or confirm them below.</Text> : null}
        <Text style={styles.note}>This is only a comparison. Actual savings are tracked after you cook.</Text>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable accessibilityLabel="Use this comparison" accessibilityRole="button" onPress={() => onConfirm(cost, meals)} style={({ pressed }) => [styles.primary, pressed && styles.pressed]} testID="savings-spend-continue"><Text style={styles.primaryText}>Use this comparison</Text></Pressable>
        <Pressable accessibilityLabel="Skip this comparison" accessibilityRole="button" onPress={onSkip} style={styles.skip}><Text style={styles.skipText}>Skip this</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

function Stepper({ label, value, display, min, max, onChange }: { label: string; value: number; display: string; min: number; max: number; onChange: (value: number) => void }) {
  const change = (amount: number) => {
    const next = Math.min(max, Math.max(min, value + amount));
    if (next === value) return;
    onChange(next);
    void Haptics.selectionAsync().catch(() => undefined);
  };
  return <View style={styles.stepper}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.numberRow}>
      <Pressable accessibilityLabel={'Decrease ' + label.toLowerCase()} accessibilityRole="button" accessibilityState={{ disabled: value <= min }} disabled={value <= min} onPress={() => change(-1)} style={[styles.control, value <= min && styles.disabled]}><Text style={styles.controlText}>−</Text></Pressable>
      <FitText accessibilityLabel={label + ': ' + display} accessibilityLiveRegion="polite" minimumFontScale={0.68} style={styles.number}>{display}</FitText>
      <Pressable accessibilityLabel={'Increase ' + label.toLowerCase()} accessibilityRole="button" accessibilityState={{ disabled: value >= max }} disabled={value >= max} onPress={() => change(1)} style={[styles.control, value >= max && styles.disabled]}><Text style={styles.controlText}>+</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: { minHeight: 48, paddingHorizontal: spacing.xl },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  title: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 36, lineHeight: 42, letterSpacing: -1 },
  helper: { color: colors.body, fontFamily: fonts.body, fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  stepper: { marginTop: spacing.xxl },
  label: { color: colors.body, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  number: { color: colors.savings, flex: 1, fontFamily: fonts.extraBold, fontSize: 56, lineHeight: 70, textAlign: 'center', letterSpacing: -1.5 },
  control: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.savingsSoft },
  controlText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 26 },
  note: { color: colors.body, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, marginTop: spacing.lg },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  primary: { minHeight: 58, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.coral },
  primaryText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  skip: { minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  skipText: { color: colors.body, fontFamily: fonts.semibold, fontSize: 14 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
