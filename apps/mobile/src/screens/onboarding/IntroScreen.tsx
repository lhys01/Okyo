import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import {
  DirectionCProgress, DirectionCShell, DisplayHeadline, BodyText, KikoImage, KikoNote,
  PrimaryButton, Spacer,
} from '../../components/onboarding/DirectionC';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useChosenMascotName } from '../../state/useMascotName';
import { getFoxSubjectName } from '../../state/foxDisplayName';

type Props = { onContinue: () => void; percent: number };

/** Kiko walks in beneath the settled headline. Motion never gates the CTA. */
export function IntroScreen({ onContinue, percent }: Props) {
  const mascotName = getFoxSubjectName(useChosenMascotName());
  const reduceMotion = useReducedMotion();
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    const animation = Animated.timing(enter, {
      delay: 120,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  return (
    <DirectionCShell
      footer={<PrimaryButton label="Show me" onPress={onContinue} />}
      scroll={false}
    >
      <DirectionCProgress percent={percent} showBack={false} />
      <Spacer flex={0.6} />
      <DisplayHeadline>Turn what you have into something worth cooking.</DisplayHeadline>
      <BodyText style={styles.sub}>
        Make a recipe, waste less food, and avoid another unnecessary order.
      </BodyText>
      <View style={styles.kikoStage}>
        <Animated.View
          style={{
            opacity: enter,
            transform: [
              { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) },
            ],
          }}
        >
          <KikoImage pose="holdingBowl" size={140} />
        </Animated.View>
      </View>
      <Spacer />
      <View style={styles.note}>
        <KikoNote
          line={`${mascotName} will walk you through it — about a minute.`}
          pose="sittingSide"
          size={0}
        />
      </View>
    </DirectionCShell>
  );
}

const styles = StyleSheet.create({
  kikoStage: { height: 150, justifyContent: 'flex-end', marginTop: 18 },
  note: { paddingBottom: 18 },
  sub: { marginTop: 20 },
});
