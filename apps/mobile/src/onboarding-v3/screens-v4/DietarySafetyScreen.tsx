import { Check } from 'iconoir-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import {
  DIETARY_ALLERGY_OPTIONS,
  DIETARY_CUSTOM_ENTRY_MAX_LENGTH,
  DIETARY_RESTRICTION_OPTIONS,
  isDietarySafetyAnswered,
  type DietarySafetyAnswers,
} from '../state/dietaryContracts';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';
type DietarySafetyMode = 'full' | 'allergies';

type Props = {
  stageLabel: string | null;
  mode?: DietarySafetyMode;
  title?: string;
  saveLabel?: string;
  answers: DietarySafetyAnswers;
  onToggleAllergy: (value: string) => void;
  onToggleRestriction: (value: string) => void;
  onDislikesChange: (values: string[]) => void;
  onToggleNoneOfThese: () => void;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
  errorMessage: string | null;
};

const SAFETY_COPY = 'Okyo can flag and adapt recipes, but AI and ingredient labels can be wrong. Always verify ingredients for serious allergies.';

/**
 * The V4 dietary safety screen (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 06) — every Step 05 branch's personal insight routes here via the
 * canonical `dietarySafety` step (already declared in onboardingV4Route.ts
 * since Step 02). Three groups + one explicit "None of these" global option,
 * mutually exclusive with all groups by construction (dietaryContracts.ts's
 * setters), not left to this component to keep consistent.
 */
export function DietarySafetyScreen({ stageLabel, mode = 'full', title = 'Anything every recipe should avoid?', saveLabel = 'Save my preferences', answers, onToggleAllergy, onToggleRestriction, onDislikesChange, onToggleNoneOfThese, onBack, onSave, isSaving, errorMessage }: Props) {
  // The branch variant starts with an explicit “None of these” answer. Its
  // empty allergy list is intentional, so it must not be treated as an
  // unanswered full dietary-preferences draft.
  const canSave = mode === 'allergies' || isDietarySafetyAnswered(answers);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
        {stageLabel ? <Text accessibilityRole="text" style={styles.stageLabel}>{stageLabel}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title}</Text>

        <Pressable
          accessibilityLabel="None of these"
          accessibilityHint="Selects no listed allergies"
          accessibilityRole="button"
          accessibilityState={{ selected: answers.noneOfThese, disabled: isSaving }}
          disabled={isSaving}
          onPress={onToggleNoneOfThese}
          style={({ pressed }) => [styles.noneRow, answers.noneOfThese && styles.noneRowSelected, pressed && styles.pressed]}
          testID="dietary-none-of-these"
        >
          <Text style={[styles.noneRowText, answers.noneOfThese && styles.noneRowTextSelected]}>None of these</Text>
          {answers.noneOfThese ? <Check color="#FFFFFF" height={18} strokeWidth={3} width={18} /> : null}
        </Pressable>

        <ChipGroup disabled={isSaving} label="Allergies" onToggle={onToggleAllergy} options={DIETARY_ALLERGY_OPTIONS} selected={answers.allergies} />
        {mode === 'full' ? <ChipGroup disabled={isSaving} label="Restrictions" onToggle={onToggleRestriction} options={DIETARY_RESTRICTION_OPTIONS} selected={answers.restrictions} /> : null}
        {mode === 'full' ? <DislikesEditor disabled={isSaving} onChange={onDislikesChange} values={answers.dislikes} /> : null}

        <Text style={styles.safetyCopy}>{SAFETY_COPY}</Text>
        {errorMessage ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <OnboardingCTA disabled={!canSave || isSaving} label={isSaving ? 'Saving…' : saveLabel} onPress={onSave} testID="dietary-safety-save" />
      </View>
    </SafeAreaView>
  );
}

function ChipGroup({ disabled, label, options, selected, onToggle }: { disabled: boolean; label: string; options: readonly string[]; selected: readonly string[]; onToggle: (value: string) => void }) {
  const [addingOther, setAddingOther] = useState(false);
  const [otherText, setOtherText] = useState('');
  const customSelected = selected.filter((value) => !options.includes(value));

  const submitOther = () => {
    if (disabled) return;
    const trimmed = otherText.trim();
    if (trimmed) onToggle(trimmed);
    setOtherText('');
    setAddingOther(false);
  };

  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Pressable
              accessibilityLabel={option}
              accessibilityHint="Toggles this allergy"
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              key={option}
              onPress={() => onToggle(option)}
              style={({ pressed }) => [styles.chip, isSelected && styles.chipSelected, pressed && styles.pressed]}
              testID={`dietary-chip-${label.toLowerCase()}-${option}`}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
        {customSelected.map((value) => (
          <Pressable
            accessibilityLabel={`${value} (custom, tap to remove)`}
            accessibilityHint="Removes this custom allergy"
            accessibilityRole="button"
            accessibilityState={{ selected: true, disabled }}
            disabled={disabled}
            key={value}
            onPress={() => onToggle(value)}
            style={({ pressed }) => [styles.chip, styles.chipSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.chipText, styles.chipTextSelected]}>{value}</Text>
          </Pressable>
        ))}
        <Pressable disabled={disabled} accessibilityState={{ disabled }} accessibilityLabel={`Add other ${label.toLowerCase()}`} accessibilityRole="button" onPress={() => setAddingOther(true)} style={styles.chip}>
          <Text style={styles.chipText}>Other</Text>
        </Pressable>
      </View>
      {addingOther ? (
        <TextInput
          accessibilityLabel={`Custom ${label.toLowerCase()} entry`}
          editable={!disabled}
          autoFocus
          maxLength={DIETARY_CUSTOM_ENTRY_MAX_LENGTH}
          onChangeText={setOtherText}
          onSubmitEditing={submitOther}
          placeholder="Type and press done"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          style={styles.otherInput}
          value={otherText}
        />
      ) : null}
    </View>
  );
}

function DislikesEditor({ disabled, values, onChange }: { disabled: boolean; values: readonly string[]; onChange: (values: string[]) => void }) {
  const [text, setText] = useState('');
  const submit = () => {
    if (disabled) return;
    const trimmed = text.trim();
    if (trimmed) onChange([...values, trimmed]);
    setText('');
  };
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>Dislikes</Text>
      <View style={styles.chipWrap}>
        {values.map((value) => (
          <Pressable
            accessibilityLabel={`${value} (tap to remove)`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            accessibilityRole="button"
            key={value}
            onPress={() => onChange(values.filter((item) => item !== value))}
            style={[styles.chip, styles.chipSelected]}
          >
            <Text style={[styles.chipText, styles.chipTextSelected]}>{value}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.dislikeRow}>
        <TextInput
          accessibilityLabel="Add a food dislike"
          editable={!disabled}
          maxLength={DIETARY_CUSTOM_ENTRY_MAX_LENGTH}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="Add a dislike"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          style={styles.dislikeInput}
          value={text}
        />
        <Pressable disabled={disabled} accessibilityState={{ disabled }} accessibilityLabel="Add dislike" accessibilityRole="button" onPress={submit} style={styles.addButton}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  stageLabel: { color: colors.muted, flex: 1, fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.4, marginLeft: 12, textTransform: 'uppercase' },
  content: { paddingBottom: 32, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 8 },
  title: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 30, letterSpacing: -0.5, lineHeight: 36 },
  noneRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, minHeight: 52, paddingHorizontal: 16 },
  noneRowSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  pressed: { opacity: 0.78 },
  noneRowText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 15 },
  noneRowTextSelected: { color: '#FFFFFF' },
  group: { marginTop: 24 },
  groupLabel: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 14, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  chipSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  chipText: { color: colors.charcoal, fontFamily: fontFamilies.medium, fontSize: 14 },
  chipTextSelected: { color: '#FFFFFF' },
  otherInput: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.charcoal, fontFamily: fontFamilies.medium, fontSize: 15, marginTop: 10, minHeight: 46, paddingHorizontal: 14 },
  dislikeRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  dislikeInput: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.charcoal, flex: 1, fontFamily: fontFamilies.medium, fontSize: 15, minHeight: 46, paddingHorizontal: 14 },
  addButton: { alignItems: 'center', backgroundColor: colors.charcoal, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 18 },
  addButtonText: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 14 },
  safetyCopy: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 12.5, lineHeight: 18, marginTop: 28 },
  errorText: { color: colors.danger, fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 19, marginTop: 14 },
  footer: { paddingBottom: 8, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 10 },
});
