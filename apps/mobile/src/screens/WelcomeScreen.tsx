import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { analyticsEvents, track } from '../analytics/track';
import { PrimaryButton, ScreenContainer, colors, sharedStyles } from '../components/OkyoUI';
import type { RootStackParamList } from '../navigation/types';
import { useOkyoStore } from '../state/useOkyoStore';
import { uiLog } from '../utils/uiDebug';

const onboardingSteps = [
  {
    title: 'Scan restaurant food',
    body: 'Snap or upload a dish you want to recreate at home.',
  },
  {
    title: 'Get a homemade dupe',
    body: 'Okyo gives you an inspired-by recipe with estimated homemade cost and savings.',
  },
  {
    title: 'Save, cook, share',
    body: 'Build your library, take the Dupe Challenge, earn badges, and share your wins.',
  },
];

type WelcomeNavigation = NativeStackNavigationProp<RootStackParamList, 'WelcomeScreen'>;

export function WelcomeScreen() {
  const navigation = useNavigation<WelcomeNavigation>();
  const [stepIndex, setStepIndex] = useState(0);
  const completeOnboarding = useOkyoStore((state) => state.completeOnboarding);
  const didTrackStart = useRef(false);
  const currentStep = onboardingSteps[stepIndex];
  const isLastStep = stepIndex === onboardingSteps.length - 1;

  useEffect(() => {
    if (didTrackStart.current) {
      return;
    }
    uiLog('WelcomeScreen', 'enter');

    didTrackStart.current = true;
    track(analyticsEvents.ONBOARDING_START, { screen: 'WelcomeScreen' });
  }, []);

  const continueOnboarding = () => {
    if (isLastStep) {
      uiLog('WelcomeScreen', 'start_scanning_pressed', { stepIndex });
      uiLog('WelcomeScreen', 'complete_onboarding');
      track(analyticsEvents.ONBOARDING_COMPLETE, { screen: 'WelcomeScreen' });
      completeOnboarding();
      uiLog('WelcomeScreen', 'reset_to_main_tabs');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'MainTabs',
              params: { screen: 'ScanScreen' },
            },
          ],
        }),
      );
      return;
    }

    setStepIndex((currentIndex) => currentIndex + 1);
  };

  return (
    <ScreenContainer scroll={false} centered>
      <Text style={styles.brand}>Okyo</Text>
      <View style={styles.heroBlock}>
        <View style={styles.imageDish}>
          <View style={styles.plate}>
            <Text style={styles.plateText}>$31.60</Text>
            <Text style={styles.plateLabel}>saved</Text>
          </View>
        </View>
        <Text style={styles.stepCount}>Step {stepIndex + 1} of {onboardingSteps.length}</Text>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.body}>{currentStep.body}</Text>
      </View>
      <View style={styles.dots}>
        {onboardingSteps.map((step, index) => (
          <View
            key={step.title}
            style={[styles.dot, index === stepIndex ? styles.dotActive : null]}
          />
        ))}
      </View>
      <View style={styles.action}>
        <PrimaryButton onPress={continueOnboarding}>{isLastStep ? 'Start Scanning' : 'Continue'}</PrimaryButton>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: colors.coral,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 28,
    textTransform: 'uppercase',
  },
  heroBlock: {
    ...sharedStyles.card,
    padding: 22,
  },
  imageDish: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 16,
    height: 132,
    justifyContent: 'center',
    marginBottom: 20,
  },
  plate: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.coral,
    borderRadius: 58,
    borderWidth: 4,
    height: 116,
    justifyContent: 'center',
    width: 116,
  },
  plateText: {
    color: colors.green,
    fontSize: 26,
    fontWeight: '900',
  },
  plateLabel: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stepCount: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 12,
  },
  title: {
    color: colors.charcoal,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 39,
  },
  body: {
    color: colors.body,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 14,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 22,
  },
  dot: {
    backgroundColor: colors.border,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  dotActive: {
    backgroundColor: colors.coral,
    width: 28,
  },
  action: {
    marginTop: 24,
  },
});
