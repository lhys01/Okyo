import { lazy, Suspense, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';

import { isClerkAvailable } from '../../../auth/clerkRuntime';
import { LegalDocumentModal } from '../../../legal/LegalDocumentModal';
import type { LegalDocumentId } from '../../../legal/legalDocuments';
import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { onboardingV3Log } from '../../utils/onboardingV3Log';
import type { ShowcasePageProps } from './types';

const ARTWORK = { height: 1847, width: 852 } as const;
const SignInScreen = lazy(() => Promise.resolve({
  // Keep the module ID in Metro's main registry. The native dev client can
  // otherwise request a stale async chunk while the welcome screen is mounted.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  default: (require('../../../auth/SignInScreen') as typeof import('../../../auth/SignInScreen')).SignInScreen,
}));

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
  const [showSignIn, setShowSignIn] = useState(false);
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

  if (showSignIn) {
    return (
      <Suspense fallback={<View style={styles.signInLoading}><Text style={styles.signInLoadingText}>Loading sign-in…</Text></View>}>
        <SignInScreen allowSkip={false} buttonAction="sign-in" onBack={() => setShowSignIn(false)} onDone={() => setShowSignIn(false)} onSkip={() => setShowSignIn(false)} title="Welcome back" subtitle="Sign in with the option you used when you created your account." />
      </Suspense>
    );
  }

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
          accessibilityHint="Opens email, Apple, and Google sign-in options"
          accessibilityLabel="I already have an account"
          accessibilityRole="button"
          onPress={() => {
            if (!isClerkAvailable()) {
              unavailable('Sign-in isn’t available', 'Please update Okyo or contact support to access your account.', 'showcase_account_sign_in_unavailable');
              return;
            }
            onboardingV3Log('showcase_account_sign_in_opened');
            setShowSignIn(true);
          }}
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
  signInLoading: { alignItems: 'center', backgroundColor: '#FFFFFF', flex: 1, justifyContent: 'center' },
  signInLoadingText: { color: '#666666', fontSize: 15 },
});
