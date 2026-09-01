import { useState } from 'react';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';

import { LegalDocumentModal } from '../../../legal/LegalDocumentModal';
import type { LegalDocumentId } from '../../../legal/legalDocuments';
import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { onboardingV3Log } from '../../utils/onboardingV3Log';
import type { ShowcasePageProps } from './types';

const ARTWORK = { height: 1847, width: 852 } as const;

const unavailable = (title: string, message: string, event: string) => {
  onboardingV3Log(event, { reason: 'route_unavailable' });
  Alert.alert(title, message);
};

export function HeroPage(props: ShowcasePageProps) {
  // The Terms and Privacy Notice must be readable before onboarding starts —
  // a first-run screen that says "by continuing you accept our Terms" while the
  // Terms are unreachable is a false statement, and App Store review treats it
  // as one. Presented as a modal so onboarding routing is untouched.
  const [legalDocumentId, setLegalDocumentId] = useState<LegalDocumentId | null>(null);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const scale = Math.min(windowWidth / ARTWORK.width, windowHeight / ARTWORK.height);
  const artworkWidth = ARTWORK.width * scale;
  const artworkHeight = ARTWORK.height * scale;
  const artworkFrame = {
    height: artworkHeight,
    left: (windowWidth - artworkWidth) / 2,
    top: (windowHeight - artworkHeight) / 2,
    width: artworkWidth,
  };

  return (
    <View style={styles.screen}>
      <StatusBar animated={false} hidden style="dark" />
      <Image accessible={false} contentFit="contain" source={onboardingV3Assets.approvedHeroArtwork} style={[styles.artwork, artworkFrame]} />
      <View style={[styles.hitTargets, artworkFrame]}>
        <Pressable
          accessibilityLabel="Get started"
          accessibilityRole="button"
          onPress={props.onNext}
          style={styles.getStartedHitTarget}
        />
        <Pressable
          accessibilityHint="Account sign-in is not available in this build"
          accessibilityLabel="I already have an account"
          accessibilityRole="button"
          onPress={() => unavailable('Okyo has no accounts', 'Okyo does not use accounts or sign-in. Everything you make is saved on this device, and you can delete it any time from Settings.', 'showcase_account_unavailable')}
          style={styles.accountHitTarget}
        />
        <Pressable
          accessibilityHint="Opens Okyo's Terms of Service"
          accessibilityLabel="Terms of Use"
          accessibilityRole="link"
          onPress={() => { onboardingV3Log('showcase_terms_opened', { documentId: 'terms-of-service' }); setLegalDocumentId('terms-of-service'); }}
          style={styles.termsHitTarget}
        />
        <Pressable
          accessibilityHint="Opens Okyo's Privacy Policy"
          accessibilityLabel="Privacy Notice"
          accessibilityRole="link"
          onPress={() => { onboardingV3Log('showcase_privacy_opened', { documentId: 'privacy-policy' }); setLegalDocumentId('privacy-policy'); }}
          style={styles.privacyHitTarget}
        />
      </View>
      <LegalDocumentModal documentId={legalDocumentId} onClose={() => setLegalDocumentId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#D6E8F7', flex: 1 },
  artwork: { position: 'absolute' },
  hitTargets: { position: 'absolute' },
  getStartedHitTarget: { height: '5.6%', left: '24.5%', position: 'absolute', top: '83.7%', width: '51%' },
  accountHitTarget: { height: '4.1%', left: '19%', position: 'absolute', top: '89.1%', width: '62%' },
  termsHitTarget: { height: '3.5%', left: '28%', position: 'absolute', top: '92.1%', width: '22%' },
  privacyHitTarget: { height: '3.5%', left: '50%', position: 'absolute', top: '92.1%', width: '26%' },
});
