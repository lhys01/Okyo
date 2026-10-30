import { Check } from 'iconoir-react-native';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
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
  const { height } = useWindowDimensions();
  const compact = height < 760 || options.length >= 6;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
        {stageLabel ? <Text accessibilityRole="text" style={styles.stageLabel}>{stageLabel}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
        {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
        <View accessibilityRole="radiogroup" style={[styles.optionList, compact && styles.optionListCompact]}>
          {options.map((option) => {
            const value = optionValue(option);
            const isSelected = selected === value;
            return (
              <Animated.View key={value} layout={LinearTransition.duration(reduceMotion ? 0 : 220)} style={styles.optionWrapper}>
              <Pressable
                accessibilityLabel={optionLabel(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, checked: isSelected }}
                onPress={() => { if (selected === value) return; onSelect(value); void Haptics.selectionAsync().catch(() => undefined); }}
                style={({ pressed }) => [styles.option, compact && styles.optionCompact, isSelected && styles.optionSelected, pressed && styles.pressed]}
                testID={`branch-question-option-${value}`}
              >
                <Text style={styles.optionText}>{optionLabel(option)}</Text>
                <View style={[styles.indicator, isSelected && styles.indicatorSelected]}>{isSelected ? <Check color={colors.surfaceMuted} height={18} strokeWidth={3} width={18} /> : null}</View>
              </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <OnboardingCTA disabled={!canContinue} label="Continue" onPress={onContinue} testID="branch-question-continue" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surfaceMuted, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  stageLabel: { color: colors.body, flex: 1, fontFamily: fontFamilies.medium, fontSize: 13, marginLeft: 12 },
  content: { flexGrow: 1, paddingTop: 16, paddingBottom: 16, paddingHorizontal: 16 },
  contentCompact: { paddingTop: 8, paddingBottom: 8 },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 28, letterSpacing: -0.7, lineHeight: 34 },
  titleCompact: { fontSize: 25, lineHeight: 30 },
  helper: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 14, marginTop: 10 },
  optionList: { flexGrow: 1, gap: 6, marginTop: 8, width: '100%' },
  optionListCompact: { marginTop: 6 },
  optionWrapper: { flexGrow: 1, width: '100%' },
  option: { alignItems: 'center', borderBottomColor: colors.border, borderRadius: 16, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', flexGrow: 1, minHeight: 64, paddingHorizontal: 16, paddingVertical: 11, gap: 12, width: '100%' },
  optionCompact: { minHeight: 54, paddingVertical: 7 },
  optionSelected: { backgroundColor: colors.creamDeep },
  optionText: { color: colors.ink, fontFamily: fontFamilies.semibold, fontSize: 17, lineHeight: 23, flex: 1 },
  indicator: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.body, alignItems: 'center', justifyContent: 'center' },
  indicatorSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  pressed: { opacity: 0.8 },
  footer: { paddingBottom: 8, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 10 },
});
