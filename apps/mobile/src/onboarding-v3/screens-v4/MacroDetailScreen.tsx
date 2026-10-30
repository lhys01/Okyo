import * as Haptics from 'expo-haptics';
import { Check } from 'iconoir-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, onboardingFontFamilies as fonts, spacing, radius } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { useReduceMotion } from '../motion/useReduceMotion';
import type { MacroBranchAnswers, KnownMacroTargets } from '../state/branchContracts';
import { normalizeOwnDailyReferences, type MacroDetailPreference } from '../state/macroPreferences';

const choices = [
  { value: 'simple', label: 'Keep it simple' },
  { value: 'all', label: 'Show all macros' },
  { value: 'own', label: 'I use my own targets' },
] as const;

type Props = {
  answers: MacroBranchAnswers;
  onSelect: (value: MacroDetailPreference) => void;
  onTargetsChange: (value: KnownMacroTargets) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function MacroDetailScreen({ answers, onSelect, onTargetsChange, onBack, onContinue }: Props) {
  const reduceMotion = useReduceMotion();
  const [protein, setProtein] = useState(answers.knownTargets.proteinGrams?.toString() ?? '');
  const [calories, setCalories] = useState(answers.knownTargets.calories?.toString() ?? '');
  const [touched, setTouched] = useState(false);
  const own = answers.detailPreference === 'own';
  const numeric = (text: string) => /^\d+(\.\d+)?$/.test(text.trim()) ? Number(text) : NaN;
  const validate = (proteinText: string, calorieText: string) => normalizeOwnDailyReferences({ proteinGrams: numeric(proteinText), calories: numeric(calorieText) });
  const valid = validate(protein, calories);
  const hasError = own && (valid.proteinGrams === undefined || (calories.trim() !== '' && valid.calories === undefined));
  const enabled = Boolean(answers.detailPreference) && !hasError;
  const update = (proteinText: string, calorieText: string) => {
    setProtein(proteinText);
    setCalories(calorieText);
    onTargetsChange(validate(proteinText, calorieText));
  };
  return <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>How much detail do you want?</Text>
        <Text style={styles.subtitle}>Start simple. You can always look closer.</Text>
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {choices.map((choice) => <Pressable key={choice.value} accessibilityLabel={choice.label} accessibilityRole="radio" accessibilityState={{ checked: answers.detailPreference === choice.value }} onPress={() => {
            if (answers.detailPreference === choice.value) return;
            if (!(choice.value === 'own' && answers.targetPath === 'known')) { setProtein(''); setCalories(''); }
            setTouched(false);
            onSelect(choice.value);
            void Haptics.selectionAsync().catch(() => undefined);
          }} style={({ pressed }) => [styles.row, answers.detailPreference === choice.value && styles.selected, pressed && styles.pressed]} testID={'macro-detail-' + choice.value}>
            <Text style={styles.rowLabel}>{choice.label}</Text>
            <View style={[styles.indicator, answers.detailPreference === choice.value && styles.checked]}>{answers.detailPreference === choice.value ? <Check color={colors.surfaceMuted} width={18} height={18} strokeWidth={3} /> : null}</View>
          </Pressable>)}
        </View>
        <Animated.View layout={LinearTransition.duration(reduceMotion ? 0 : 240)}>
          {own ? <View style={styles.form}>
            <Text style={styles.label}>Protein / day</Text>
            <TextInput accessibilityLabel="Your protein target in grams per day" keyboardType="decimal-pad" value={protein} onChangeText={(text) => update(text, calories)} onBlur={() => setTouched(true)} maxLength={6} placeholder="Grams" placeholderTextColor={colors.body} style={styles.input} testID="macro-own-protein" />
            <Text style={styles.label}>Calories / day · optional</Text>
            <TextInput accessibilityLabel="Your daily calories, optional" keyboardType="number-pad" value={calories} onChangeText={(text) => update(protein, text)} onBlur={() => setTouched(true)} maxLength={6} placeholder="Calories" placeholderTextColor={colors.body} style={styles.input} testID="macro-own-calories" />
            <Text style={styles.note}>These are your numbers. Okyo is not recommending targets.</Text>
            {touched && hasError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>Enter protein above 0 and up to 400g. If adding calories, enter 800–6,000, or leave it blank.</Text> : null}
          </View> : null}
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}><Pressable accessibilityLabel="See my recipe preview" accessibilityRole="button" accessibilityState={{ disabled: !enabled }} disabled={!enabled} onPress={onContinue} style={({ pressed }) => [styles.primary, !enabled && styles.disabled, pressed && styles.pressed]} testID="macro-detail-continue"><Text style={styles.primaryLabel}>See my preview</Text></Pressable></View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceMuted }, flex: { flex: 1 },
  header: { minHeight: 48, paddingHorizontal: spacing.xl },
  content: { paddingHorizontal: 16, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  title: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 36, lineHeight: 42, letterSpacing: -1 },
  subtitle: { color: colors.body, fontFamily: fonts.body, fontSize: 17, lineHeight: 25, marginTop: spacing.md },
  choices: { marginTop: 10, gap: spacing.xs, width: '100%' },
  row: { minHeight: 72, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderRadius: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md, width: '100%' },
  selected: { backgroundColor: colors.macrosSoft },
  rowLabel: { flex: 1, color: colors.ink, fontFamily: fonts.semibold, fontSize: 19, lineHeight: 27 },
  indicator: { width: 28, height: 28, borderRadius: 14, borderColor: colors.body, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.macros, borderColor: colors.macros },
  form: { marginTop: spacing.lg },
  label: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, marginTop: spacing.lg },
  input: { minHeight: 56, backgroundColor: colors.surface, borderBottomColor: colors.macros, borderBottomWidth: 1, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.ink, fontFamily: fonts.medium, fontSize: 22, marginTop: spacing.sm },
  note: { color: colors.body, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginTop: spacing.lg },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  primary: { minHeight: 58, borderRadius: radius.button, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  primaryLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.8 },
});
