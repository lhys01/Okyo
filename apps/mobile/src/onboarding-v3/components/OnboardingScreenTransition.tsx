import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, SlideInLeft, SlideInRight } from 'react-native-reanimated';

import { ONBOARDING_V3_STEPS } from '../controller/onboardingV3Machine';
import { useReduceMotion } from '../motion/useReduceMotion';
import { useLaunchStartup } from '../../startup/LaunchScreen';

const BACK_TRANSITION_MS = 300;
const FORWARD_TRANSITION_MS = 300;
const SPLASH_TO_SHOWCASE_TRANSITION_MS = 850;
const MINIMAL_FADE_MS = 100;

const defaultStepOrder: readonly string[] = ONBOARDING_V3_STEPS;

export function OnboardingScreenTransition({
  step,
  stepOrder = defaultStepOrder,
  style,
  children,
}: {
  step: string;
  stepOrder?: readonly string[];
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  const { finished: launchFinished } = useLaunchStartup();
  const previousStep = useRef(step);
  const currentIndex = stepOrder.indexOf(step);
  const previousIndex = stepOrder.indexOf(previousStep.current);
  const direction = currentIndex >= 0 && previousIndex >= 0 && currentIndex < previousIndex ? 'back' : 'forward';

  useEffect(() => {
    previousStep.current = step;
  }, [step]);

  const isBack = direction === 'back';
  const isSplashToShowcase = previousStep.current === 'splash' && step === 'showcase';
  return (
    <Animated.View
      // Exiting Reanimated views can remain mounted above the new screen for
      // the duration of the native animation. In remote/cloud simulators that
      // stale layer can win hit-testing and make the new CTA look disabled.
      // Keep the animated shell transparent to hit-testing; the active screen
      // children retain their normal touch targets.
      pointerEvents="box-none"
      // Prepare the first destination in place underneath the launch screen.
      entering={!launchFinished ? undefined : reduceMotion
        ? FadeIn.duration(MINIMAL_FADE_MS)
        : isSplashToShowcase
          ? SlideInRight.duration(SPLASH_TO_SHOWCASE_TRANSITION_MS).easing(Easing.inOut(Easing.cubic))
        : isBack
          ? SlideInLeft.duration(BACK_TRANSITION_MS).easing(Easing.out(Easing.cubic))
          : SlideInRight.duration(FORWARD_TRANSITION_MS).easing(Easing.out(Easing.cubic))}
      key={step}
      style={[styles.container, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
