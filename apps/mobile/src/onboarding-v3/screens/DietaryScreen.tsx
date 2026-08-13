import { Check } from 'iconoir-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { DIETARY_DISLIKES, DIETARY_RESTRICTIONS, type DietarySelection } from '../state/dietary';

export function DietaryScreen({
  dishName,
  initialSelection,
  onBack,
  onContinue,
  // Optional overrides so Settings can reuse this screen as an editor. Defaults
  // reproduce the onboarding copy exactly, so the onboarding flow is unchanged.
  subtitle,
  ctaLabel = 'Continue',
}: {
  dishName: string;
  initialSelection: DietarySelection;
  onBack: () => void;
  onContinue: (selection: DietarySelection) => void;
  subtitle?: string;
  ctaLabel?: string;
}) {
  const [restrictions, setRestrictions] = useState(initialSelection.restrictions);
  const [dislikes, setDislikes] = useState(initialSelection.dislikes);
  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Anything Okyo should work around?</Text>
        <Text style={styles.body}>{subtitle ?? `We'll build your ${dishName} recipe around these.`}</Text>
        <DietarySection
          label="Allergies & restrictions"
          onToggle={(value) => toggle(value, restrictions, setRestrictions)}
          options={DIETARY_RESTRICTIONS}
          selected={restrictions}
        />
        <DietarySection
          label="Rather avoid"
          onToggle={(value) => toggle(value, dislikes, setDislikes)}
          options={DIETARY_DISLIKES}
          selected={dislikes}
        />
      </ScrollView>
      <View style={styles.footer}>
        <OnboardingCTA label={ctaLabel} onPress={() => onContinue({ allergies: initialSelection.allergies, restrictions, avoidances: initialSelection.avoidances, dislikes })} />
      </View>
    </SafeAreaView>
  );
}

function DietarySection({ label, options, selected, onToggle }: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => (
          <DietaryChip checked={selected.includes(option)} key={option} label={option} onPress={() => onToggle(option)} />
        ))}
      </View>
    </View>
  );
}

function DietaryChip({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    progress.value = reduceMotion ? (checked ? 1 : 0) : withTiming(checked ? 1 : 0, {
      duration: motionTokens.dietary.toggleMs,
      easing: Easing.out(Easing.quad),
    });
  }, [checked, progress, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5 ? colors.coralSoft : colors.card,
    borderColor: progress.value > 0.5 ? colors.coral : colors.border,
  }));
  return (
    <Animated.View style={[styles.chip, animatedStyle]}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onPress}
        style={styles.chipPressable}
      >
        {checked ? <Check color={colors.coralDark} height={17} strokeWidth={3} width={17} /> : null}
        <Text style={[styles.chipText, checked && styles.chipTextSelected]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { minHeight: 52, paddingHorizontal: 20 },
  content: { paddingBottom: 24, paddingHorizontal: 24, paddingTop: 10 },
  title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 32, letterSpacing: -0.7, lineHeight: 39 },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, marginTop: 10 },
  section: { marginTop: 30 },
  sectionTitle: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 18, marginBottom: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: { borderRadius: 999, borderWidth: 1 },
  chipPressable: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 46, paddingHorizontal: 15 },
  chipText: { color: colors.body, fontFamily: fontFamilies.semibold, fontSize: 14 },
  chipTextSelected: { color: colors.coralDark },
  footer: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 8, paddingHorizontal: 24, paddingTop: 12 },
});
