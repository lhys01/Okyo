import { Check } from 'iconoir-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { useReduceMotion } from '../motion/useReduceMotion';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';
import type { OnboardingV4StageLabel } from '../state/onboardingV4Route';

type SelectOption = string | { label: string; value: string };

type Props = {
  stageLabel: OnboardingV4StageLabel | null;
  title: string;
  options: readonly SelectOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  helperText?: string;
};

function optionLabel(option: SelectOption): string {
  return typeof option === 'string' ? option : option.label;
}
function optionValue(option: SelectOption): string {
  return typeof option === 'string' ? option : option.value;
}

/**
 * Generic, data-driven single-select question screen (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 05) — one component for every branch's Q1 and most Q2s, not four
 * bespoke screens. Tap-to-select is the accessible default: tapping an
 * option gives immediate selected-state feedback (highlight + checkmark);
 * advancing always requires an explicit "Continue" tap, never an
 * auto-advance timer, so a screen reader user is never rushed past a choice.
 */
export function BranchQuestionScreen({ stageLabel, title, options, selected, onSelect, onBack, onContinue, canContinue, helperText }: Props) {
  const reduceMotion = useReduceMotion();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
        {stageLabel ? <Text accessibilityRole="text" style={styles.stageLabel}>{stageLabel}</Text> : null}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
        <View style={styles.optionList}>
          {options.map((option) => {
            const value = optionValue(option);
            const isSelected = selected === value;
            return (
              <Pressable
                accessibilityLabel={optionLabel(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, checked: isSelected }}
                key={value}
                onPress={() => onSelect(value)}
                style={[styles.option, isSelected && styles.optionSelected, reduceMotion && styles.optionNoElevation]}
                testID={`branch-question-option-${value}`}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{optionLabel(option)}</Text>
                {isSelected ? <Check color="#FFFFFF" height={20} strokeWidth={3} width={20} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.footer}>
        <OnboardingCTA disabled={!canContinue} label="Continue" onPress={onContinue} testID="branch-question-continue" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  stageLabel: { color: colors.muted, flex: 1, fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.4, marginLeft: 12, textTransform: 'uppercase' },
  content: { flex: 1, justifyContent: 'center', paddingBottom: 22, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING },
  title: { color: colors.charcoal, fontFamily: fontFamilies.personalizedDisplay, fontSize: 32, letterSpacing: -0.5, lineHeight: 38 },
  helper: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 14, marginTop: 10 },
  optionList: { gap: 12, marginTop: 28 },
  option: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 18, paddingVertical: 14 },
  optionSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  optionNoElevation: { elevation: 0, shadowOpacity: 0 },
  optionText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 16 },
  optionTextSelected: { color: '#FFFFFF' },
  footer: { paddingBottom: 8, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 10 },
});
