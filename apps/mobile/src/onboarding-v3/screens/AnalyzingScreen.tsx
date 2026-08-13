import { useVideoPlayer, VideoView } from 'expo-video';
import { Spark } from 'iconoir-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';

const scanLoadingVideo = require('../../../assets/scan/scan-loading-gradient.mp4');

export function AnalyzingScreen({ mascotName, photoUri, onCancel }: {
  mascotName: string;
  photoUri: string | null;
  onCancel: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const loadingPlayer = useVideoPlayer(scanLoadingVideo, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });
  const phase = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      spin.value = 0;
      phase.value = 0;
      return;
    }
    spin.value = withRepeat(withTiming(1, {
      duration: motionTokens.loading.spinnerMs,
      easing: Easing.linear,
    }), -1, false);
    phase.value = withRepeat(withSequence(
      withTiming(1, { duration: motionTokens.loading.spinnerMs * 2, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: motionTokens.loading.spinnerMs * 2, easing: Easing.inOut(Easing.quad) }),
    ), -1, false);
  }, [phase, reduceMotion, spin]);
  const firstStyle = useAnimatedStyle(() => ({ opacity: 1 - phase.value }));
  const secondStyle = useAnimatedStyle(() => ({ opacity: phase.value }));
  const spinnerStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}><OnboardingBackButton onPress={onCancel} /></View>
      <View style={styles.content}>
        <View style={styles.visual}>
          {photoUri ? (
            <VideoView accessibilityLabel="Dish scan loading" contentFit="cover" nativeControls={false} player={loadingPlayer} style={StyleSheet.absoluteFill} surfaceType="textureView" />
          ) : (
            <View accessibilityLabel="Analyzing dish description" accessibilityRole="image" style={styles.descriptionVisual}><Spark color={colors.coralDark} height={54} width={54} /></View>
          )}
          <Animated.View accessibilityLabel="Analyzing" accessibilityRole="progressbar" style={[styles.spinner, spinnerStyle]} />
        </View>
        <Text style={styles.title}>{mascotName} is studying your dish</Text>
        <View accessibilityLiveRegion="polite" style={styles.stageWrap}>
          <Animated.Text style={[styles.stage, styles.stageAbsolute, firstStyle]}>Identifying your dish…</Animated.Text>
          <Animated.Text style={[styles.stage, secondStyle]}>Reading the ingredients…</Animated.Text>
        </View>
        <Text style={styles.note}>Recipe estimates are AI-generated and can be edited after your scan.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { minHeight: ONBOARDING_BACK_ROW_HEIGHT, paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING, paddingTop: ONBOARDING_BACK_ROW_TOP_GAP },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingBottom: 80, paddingHorizontal: 30 },
  visual: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 36, height: 280, justifyContent: 'center', overflow: 'hidden', width: '100%' },
  descriptionVisual: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 48, height: 128, justifyContent: 'center', width: 128 },
  spinner: { borderColor: 'rgba(255,255,255,0.7)', borderRadius: 52, borderRightColor: colors.coral, borderTopColor: colors.coral, borderWidth: 5, height: 104, position: 'absolute', width: 104 },
  title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 27, letterSpacing: -0.5, marginTop: 28, textAlign: 'center' },
  stageWrap: { alignItems: 'center', height: 28, justifyContent: 'center', marginTop: 12, width: '100%' },
  stage: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 16, textAlign: 'center' },
  stageAbsolute: { position: 'absolute' },
  note: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 18, marginTop: 24, maxWidth: 300, textAlign: 'center' },
});
