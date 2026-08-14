import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { KikoOnboardingArtwork } from '../components/KikoOnboardingArtwork';
import { ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { OnboardingCTA } from '../components/OnboardingCTA';

type Props = {
  onContinue: () => void;
  onRestore: () => void;
  isRestoring?: boolean;
};

/**
 * The mechanism-led first V4 screen (Okyo_Onboarding_V4_Implementation_Plan.md
 * Step 03): replaces the 6-page showcase carousel's *purpose* for a V4 user —
 * Step 11 later removed the superseded carousel after V4 activation.
 * Reuses `KikoOnboardingArtwork`, `OnboardingCTA`, and `onboardingLayout.ts`'s
 * shared numbers rather than inventing new styling primitives.
 */
export function PromiseScreen({ onContinue, onRestore, isRestoring = false }: Props) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.content}>
        <KikoOnboardingArtwork assetId="kikoMagicRecipeBook" sizeRole="hero" style={styles.artwork} />
        <Text style={styles.headline}>See a dish you love. Get the recipe to make it yourself.</Text>
        <Text style={styles.subline}>Okyo turns any meal you scan into a recipe you can actually cook — and shows what you'll save doing it.</Text>
      </View>
      <View style={styles.footer}>
        <OnboardingCTA label="Get started" onPress={onContinue} testID="promise-continue" />
        <Pressable
          accessibilityLabel={isRestoring ? 'Restoring your purchase' : 'Already subscribed? Restore your purchase'}
          accessibilityRole="button"
          accessibilityState={{ disabled: isRestoring }}
          disabled={isRestoring}
          hitSlop={8}
          onPress={onRestore}
          style={styles.restoreLink}
        >
          <Text style={[styles.restoreLinkText, isRestoring && styles.restoreLinkTextBusy]}>
            {isRestoring ? 'Restoring…' : 'Already subscribed? Restore'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING },
  artwork: { marginBottom: 28 },
  headline: {
    color: colors.charcoal,
    fontFamily: fontFamilies.personalizedDisplay,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    textAlign: 'center',
  },
  subline: {
    color: colors.body,
    fontFamily: fontFamilies.medium,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 16,
    textAlign: 'center',
  },
  footer: { paddingBottom: 8, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: 10 },
  restoreLink: { alignItems: 'center', marginTop: 16, minHeight: 44, paddingVertical: 10 },
  restoreLinkText: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 13, textAlign: 'center' },
  restoreLinkTextBusy: { opacity: 0.6 },
});
