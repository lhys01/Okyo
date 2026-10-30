import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies, onboardingTitleFont } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { OnboardingCTA } from '../components/OnboardingCTA';
import type { AgeEligibility } from '../state/personalizedOnboarding';

const MIN_AGE = 13;
const MAX_AGE = 100;
const THUMB_SIZE = 30;
const TRACK_INSET = THUMB_SIZE / 2;

type Props = {
  age: number | null;
  selected: AgeEligibility | null;
  onBack: () => void;
  onContinue: () => void;
  onSelect: (value: AgeEligibility) => void;
  onAgeChange: (value: number) => void;
};

export function AgeEligibilityScreen({ age, selected, onBack, onContinue, onSelect, onAgeChange }: Props) {
  const [width, setWidth] = useState(0);
  const ageRef = useRef(age);
  const widthRef = useRef(width);
  ageRef.current = age;
  widthRef.current = width;

  const setAgeFromX = (x: number) => {
    const currentWidth = widthRef.current;
    const usableWidth = Math.max(0, currentWidth - TRACK_INSET * 2);
    if (usableWidth <= 0 || !Number.isFinite(x)) return;
    const ratio = Math.max(0, Math.min(1, (x - TRACK_INSET) / usableWidth));
    const nextAge = Math.round(MIN_AGE + ratio * (MAX_AGE - MIN_AGE));
    if (nextAge !== ageRef.current) {
      ageRef.current = nextAge;
      onAgeChange(nextAge);
    }
  };
  const dragStartX = useRef(0);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      dragStartX.current = event.nativeEvent.locationX;
      setAgeFromX(dragStartX.current);
    },
    // Move relative to the initial touch; locationX can stay attached to a child target.
    onPanResponderMove: (_event, gesture) => setAgeFromX(dragStartX.current + gesture.dx),
    onPanResponderTerminationRequest: () => false,
  }), []);
  const onTrackLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    widthRef.current = nextWidth;
    setWidth(nextWidth);
  };
  const progress = age === null ? 0 : (age - MIN_AGE) / (MAX_AGE - MIN_AGE);
  const usableWidth = Math.max(0, width - TRACK_INSET * 2);
  const thumbLeft = Math.max(0, Math.min(width - THUMB_SIZE, TRACK_INSET + progress * usableWidth - THUMB_SIZE / 2));
  const hasChoice = age !== null || selected !== null;
  const changeAgeBy = (delta: number) => onAgeChange(Math.max(MIN_AGE, Math.min(MAX_AGE, (age ?? MIN_AGE) + delta)));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
      </View>
      <View accessibilityLabel="Onboarding progress" accessibilityRole="progressbar" accessibilityValue={{ max: 100, min: 0, now: 12 }} style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>How old are you?</Text>
        <Text style={styles.supporting}>This helps us keep Okyo’s experience appropriate for you.</Text>

        <View style={styles.ageReadout}>
          <Text accessibilityLiveRegion="polite" style={styles.ageValue}>{age !== null ? age : selected === 'under_18' ? 'Under 18' : selected === '18_plus' ? '18 or older' : 'Choose your age'}</Text>
          {age !== null ? <Text style={styles.ageUnit}>years old</Text> : null}
        </View>

        <View
        accessible
          accessibilityActions={[{ name: 'increment', label: 'Increase age by one year' }, { name: 'decrement', label: 'Decrease age by one year' }]}
          accessibilityLabel="Age"
          accessibilityRole="adjustable"
          accessibilityValue={{ min: MIN_AGE, max: MAX_AGE, now: age ?? MIN_AGE, text: age === null ? 'No age selected' : `${age} years old` }}
          onAccessibilityAction={(event) => changeAgeBy(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
          onLayout={onTrackLayout}
          style={styles.touchTrack}
          testID="age-slider"
          {...panResponder.panHandlers}
        >
          <View style={styles.track}>
            {age !== null ? <View style={[styles.trackFill, { width: `${progress * 100}%` }]} /> : null}
          </View>
          <View pointerEvents="none" style={[styles.thumb, { left: thumbLeft }]} />
        </View>
        <View style={styles.rangeLabels}>
          <Text style={styles.rangeLabel}>13 · Under 18</Text>
          <Text style={styles.rangeLabel}>18 or older · 100</Text>
        </View>

        <Pressable
          accessibilityLabel="Prefer not to say your age"
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === 'prefer_not_to_say' }}
          onPress={() => onSelect('prefer_not_to_say')}
          style={({ pressed }) => [styles.secondaryChoice, selected === 'prefer_not_to_say' && styles.secondaryChoiceSelected, pressed && styles.pressed]}
        >
          <Text style={[styles.secondaryText, selected === 'prefer_not_to_say' && styles.secondaryTextSelected]}>Prefer not to say</Text>
          <View style={[styles.radio, selected === 'prefer_not_to_say' && styles.radioSelected]}>
            {selected === 'prefer_not_to_say' ? <View style={styles.radioDot} /> : null}
          </View>
        </Pressable>
      </View>
      <View style={styles.footer}>
        <OnboardingCTA disabled={!hasChoice} label="Continue" onPress={onContinue} variant="questionnaire" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { height: 58, justifyContent: 'center', paddingHorizontal: 20 },
  progressTrack: { backgroundColor: colors.border, borderRadius: 5, height: 6, marginHorizontal: 24, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.coral, borderRadius: 5, height: '100%', width: '12%' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 58 },
  title: { ...onboardingTitleFont, color: colors.charcoal, fontSize: 34, lineHeight: 40 },
  supporting: { color: colors.muted, fontFamily: onboardingFontFamilies.medium, fontSize: 16, lineHeight: 23, marginTop: 14, maxWidth: 330 },
  ageReadout: { alignItems: 'center', marginTop: 44, minHeight: 58 },
  ageValue: { color: colors.charcoal, fontFamily: onboardingFontFamilies.bold, fontSize: 34, lineHeight: 40 },
  ageUnit: { color: colors.muted, fontFamily: onboardingFontFamilies.medium, fontSize: 14, marginTop: 1 },
  touchTrack: { height: 54, justifyContent: 'center', marginTop: 12 },
  track: { backgroundColor: colors.border, borderRadius: 99, height: 8, overflow: 'hidden' },
  trackFill: { backgroundColor: colors.coral, borderRadius: 99, height: '100%' },
  thumb: { backgroundColor: colors.coral, borderColor: colors.surface, borderRadius: THUMB_SIZE / 2, borderWidth: 4, height: THUMB_SIZE, position: 'absolute', shadowColor: '#C74870', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5, width: THUMB_SIZE },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rangeLabel: { color: colors.muted, flexShrink: 1, fontFamily: onboardingFontFamilies.semibold, fontSize: 12 },
  secondaryChoice: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 34, minHeight: 58, paddingHorizontal: 16 },
  secondaryChoiceSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  secondaryText: { color: colors.muted, fontFamily: onboardingFontFamilies.medium, fontSize: 15 },
  secondaryTextSelected: { color: colors.coralDark },
  radio: { alignItems: 'center', borderColor: colors.muted, borderRadius: 12, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  radioSelected: { borderColor: colors.coral },
  radioDot: { backgroundColor: colors.coral, borderRadius: 6, height: 12, width: 12 },
  pressed: { opacity: 0.82 },
  footer: { paddingHorizontal: 24, paddingBottom: 10 },
});
