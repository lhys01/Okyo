import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';

import { ONBOARDING_V3_STEPS } from '../controller/onboardingV3Machine';
import { useReduceMotion } from '../motion/useReduceMotion';

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
      entering={reduceMotion
        ? FadeIn.duration(MINIMAL_FADE_MS)
        : isSplashToShowcase
          ? SlideInRight.duration(SPLASH_TO_SHOWCASE_TRANSITION_MS).easing(Easing.inOut(Easing.cubic))
        : isBack
          ? SlideInLeft.duration(BACK_TRANSITION_MS).easing(Easing.out(Easing.cubic))
          : SlideInRight.duration(FORWARD_TRANSITION_MS).easing(Easing.out(Easing.cubic))}
      exiting={reduceMotion
        ? FadeOut.duration(MINIMAL_FADE_MS)
        : isSplashToShowcase
          ? SlideOutLeft.duration(SPLASH_TO_SHOWCASE_TRANSITION_MS).easing(Easing.inOut(Easing.cubic))
        : isBack
          ? SlideOutRight.duration(BACK_TRANSITION_MS).easing(Easing.out(Easing.cubic))
          : SlideOutLeft.duration(FORWARD_TRANSITION_MS).easing(Easing.out(Easing.cubic))}
      key={step}
      style={[styles.container, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
