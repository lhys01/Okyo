import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';

/**
 * Shown right after the fox gets a name. Deliberately small — a single card,
 * not another full onboarding screen — since there is nothing left to
 * justify more than a yes/no here.
 */
export function PersonalizationChoiceScreen({
  mascotName,
  onBack,
  onContinue,
  onSkip,
}: {
  mascotName: string;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Nice to meet you, {mascotName}!</Text>
          <Text accessibilityRole="header" style={styles.title}>Want to personalize Okyo a little more?</Text>
          <Text style={styles.body}>Answer a few more questions for better recommendations, or start using Okyo now — you can always finish this later.</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <OnboardingCTA label="Continue personalizing" onPress={onContinue} tone="pastelPink" />
        <OnboardingCTA label="Skip for now" onPress={onSkip} variant="secondary" style={styles.skipButton} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  card: { gap: 12 },
  eyebrow: { color: colors.coral, fontFamily: fontFamilies.bold, fontSize: 15, fontWeight: '700' },
  title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 28, fontWeight: '800', lineHeight: 34 },
  body: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 22 },
  footer: { gap: 10, paddingBottom: 10, paddingHorizontal: 24, paddingTop: 12 },
  skipButton: { marginTop: 2 },
});
