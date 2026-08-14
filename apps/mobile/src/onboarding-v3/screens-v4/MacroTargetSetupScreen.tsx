import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import type { BiologicalSexForEstimate, ActivityLevel } from '../state/nutritionTargets';
import type { KnownMacroTargets, MacroCalculatorInputs } from '../state/branchContracts';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';
import type { OnboardingV4StageLabel } from '../state/onboardingV4Route';

type Props = {
  stageLabel: OnboardingV4StageLabel | null;
  targetPath: 'known' | 'estimate';
  knownTargets: KnownMacroTargets;
  calculatorInputs: MacroCalculatorInputs;
  onKnownTargetsChange: (value: KnownMacroTargets) => void;
  onCalculatorInputsChange: (value: MacroCalculatorInputs) => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
};

/**
 * The macros branch's one compact grouped form (`macroDetails`, decision
 * #10) — the only place any branch may ask for more than its two questions.
 * Two variants sharing one shell: `'known'` (calories/protein/carbs/fat,
 * partial allowed) and `'estimate'` (age/height/weight/sex/activity/training
 * days, with a one-line rationale before the fields, per decision #10's
 * "explain why" requirement) — never a long demographic questionnaire.
 */
export function MacroTargetSetupScreen(props: Props) {
  const { stageLabel, targetPath, onBack, onContinue, canContinue } = props;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
        {stageLabel ? <Text accessibilityRole="text" style={styles.stageLabel}>{stageLabel}</Text> : null}
      </View>
      <View style={styles.content}>
        {targetPath === 'known' ? (
          <KnownTargetsForm knownTargets={props.knownTargets} onChange={props.onKnownTargetsChange} />
        ) : (
          <CalculatorInputsForm calculatorInputs={props.calculatorInputs} onChange={props.onCalculatorInputsChange} />
        )}
      </View>
      <View style={styles.footer}>
        <OnboardingCTA disabled={!canContinue} label="Continue" onPress={onContinue} testID="macro-target-setup-continue" />
      </View>
    </SafeAreaView>
  );
}

function toNumberOrUndefined(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function KnownTargetsForm({ knownTargets, onChange }: { knownTargets: KnownMacroTargets; onChange: (value: KnownMacroTargets) => void }) {
  const set = (key: keyof KnownMacroTargets) => (text: string) => onChange({ ...knownTargets, [key]: toNumberOrUndefined(text) });
  return (
    <>
      <Text style={styles.title}>Enter your daily targets</Text>
      <Text style={styles.helper}>Fill in as many as you know — partial is fine.</Text>
      <View style={styles.fieldGrid}>
        <NumberField accessibilityLabel="Daily calorie target" keyboardHint="calories" label="Calories" onChangeText={set('calories')} value={knownTargets.calories} />
        <NumberField accessibilityLabel="Daily protein target in grams" keyboardHint="protein grams" label="Protein (g)" onChangeText={set('proteinGrams')} value={knownTargets.proteinGrams} />
        <NumberField accessibilityLabel="Daily carbohydrate target in grams" keyboardHint="carb grams" label="Carbs (g)" onChangeText={set('carbsGrams')} value={knownTargets.carbsGrams} />
        <NumberField accessibilityLabel="Daily fat target in grams" keyboardHint="fat grams" label="Fat (g)" onChangeText={set('fatGrams')} value={knownTargets.fatGrams} />
      </View>
    </>
  );
}

const BIOLOGICAL_SEX_OPTIONS: readonly { label: string; value: BiologicalSexForEstimate }[] = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];
const ACTIVITY_LEVEL_OPTIONS: readonly { label: string; value: ActivityLevel }[] = [
  { label: 'Mostly sitting', value: 'mostly_sitting' },
  { label: 'Lightly active', value: 'lightly_active' },
  { label: 'Active', value: 'active' },
  { label: 'Very active', value: 'very_active' },
];

function CalculatorInputsForm({ calculatorInputs, onChange }: { calculatorInputs: MacroCalculatorInputs; onChange: (value: MacroCalculatorInputs) => void }) {
  const setNumber = (key: 'ageYears' | 'heightCm' | 'weightKg' | 'trainingDaysPerWeek') => (text: string) =>
    onChange({ ...calculatorInputs, [key]: toNumberOrUndefined(text) ?? null });

  return (
    <>
      <Text style={styles.title}>We use this only for a starting estimate</Text>
      <Text style={styles.helper}>Age, height, weight, and activity level help estimate a safe starting range — you can change it anytime.</Text>
      <View style={styles.fieldGrid}>
        <NumberField accessibilityLabel="Age in years" keyboardHint="age" label="Age" onChangeText={setNumber('ageYears')} value={calculatorInputs.ageYears ?? undefined} />
        <NumberField accessibilityLabel="Height in centimeters" keyboardHint="height" label="Height (cm)" onChangeText={setNumber('heightCm')} value={calculatorInputs.heightCm ?? undefined} />
        <NumberField accessibilityLabel="Weight in kilograms" keyboardHint="weight" label="Weight (kg)" onChangeText={setNumber('weightKg')} value={calculatorInputs.weightKg ?? undefined} />
        <NumberField accessibilityLabel="Training days per week" keyboardHint="training days" label="Training days/wk" onChangeText={setNumber('trainingDaysPerWeek')} value={calculatorInputs.trainingDaysPerWeek ?? undefined} />
      </View>
      <ChoiceRow
        accessibilityLabelPrefix="Biological sex for the calorie estimate"
        onSelect={(value) => onChange({ ...calculatorInputs, biologicalSex: value as BiologicalSexForEstimate })}
        options={BIOLOGICAL_SEX_OPTIONS}
        selected={calculatorInputs.biologicalSex}
        title="For the calorie estimate"
      />
      <ChoiceRow
        accessibilityLabelPrefix="Activity level"
        onSelect={(value) => onChange({ ...calculatorInputs, activityLevel: value as ActivityLevel })}
        options={ACTIVITY_LEVEL_OPTIONS}
        selected={calculatorInputs.activityLevel}
        title="How active is your typical week?"
      />
    </>
  );
}

function NumberField({ label, value, onChangeText, accessibilityLabel, keyboardHint }: { label: string; value: number | undefined; onChangeText: (text: string) => void; accessibilityLabel: string; keyboardHint: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        keyboardType="numeric"
        onChangeText={onChangeText}
        placeholder={keyboardHint}
        placeholderTextColor={colors.muted}
        style={styles.fieldInput}
        value={value === undefined ? '' : String(value)}
      />
    </View>
  );
}

function ChoiceRow<T extends string>({ title, options, selected, onSelect, accessibilityLabelPrefix }: { title: string; options: readonly { label: string; value: T }[]; selected: T | null; onSelect: (value: T) => void; accessibilityLabelPrefix: string }) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.fieldLabel}>{title}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <Pressable
              accessibilityLabel={`${accessibilityLabelPrefix}: ${option.label}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, checked: isSelected }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[styles.choiceChip, isSelected && styles.choiceChipSelected]}
            >
              <Text style={[styles.choiceChipText, isSelected && styles.choiceChipTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  stageLabel: { color: colors.muted, flex: 1, fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.4, marginLeft: 12, textTransform: 'uppercase' },
  content: { flex: 1, justifyContent: 'center', paddingBottom: 22, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING },
  title: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 28, letterSpacing: -0.4, lineHeight: 34 },
  helper: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 14, marginTop: 10 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  field: { width: '47%' },
  fieldLabel: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 13, marginBottom: 6 },
  fieldInput: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.charcoal, fontFamily: fontFamilies.medium, fontSize: 16, minHeight: 48, paddingHorizontal: 14 },
  choiceGroup: { marginTop: 22 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  choiceChip: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  choiceChipSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  choiceChipText: { color: colors.charcoal, fontFamily: fontFamilies.medium, fontSize: 13 },
  choiceChipTextSelected: { color: '#FFFFFF' },
  footer: { paddingBottom: 8, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 10 },
});
