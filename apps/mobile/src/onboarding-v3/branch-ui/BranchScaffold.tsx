import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { OnboardingScreenTransition } from '../components/OnboardingScreenTransition';
import { branchScrollKey } from './branchScrollKey';
import { branchPalettes, branchSurfaces, type BranchId } from './branchTheme';

const BRANCH_VIDEOS: Record<BranchId, any> = {
  save_money: require('../../../assets/videos/bb2.mp4'),
  eat_healthier: require('../../../assets/videos/gradient-1-1920x1080.mp4'),
  hit_macros: require('../../../assets/videos/gradient-2-1920x1080.mp4'),
};

// Expo's native development-menu FAB is rendered in a separate window above
// the React Native view. Keep the shared onboarding progress row clear of it
// during simulator/development testing; release builds have no such overlay.
const DEV_MENU_HEADER_CLEARANCE = 64;

export type BranchProgress = Readonly<{ answered: number; total: number; displayedStep?: number }>;

/** Keep branch drafts from flashing their default intro before AsyncStorage is ready. */
export function BranchHydrationScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.hydration}>
      <ActivityIndicator accessibilityLabel="Loading onboarding" color={colors.coral} />
    </SafeAreaView>
  );
}

/**
 * The single shell every branch screen renders inside: safe-area top and
 * bottom, a persistent Back control, a question-count progress bar, a
 * scrollable body, and a CTA anchored near the bottom.
 */
export function BranchScaffold({
  branch,
  onBack,
  hideBack = false,
  progress = null,
  headerProgress,
  ground,
  children,
  footer,
  contentStyle,
  progressVariant = 'segmented',
  transitionOrder,
  transitionStep,
}: {
  branch: BranchId;
  onBack: () => void;
  hideBack?: boolean;
  progress?: BranchProgress | null;
  /** Optional branch-local progress UI that keeps the shell's header anchored. */
  headerProgress?: ReactNode;
  /** Set on interstitial moments that use a full-bleed tinted ground. */
  ground?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Optional branch-specific density treatment for a compact questionnaire. */
  contentStyle?: StyleProp<ViewStyle>;
  progressVariant?: 'segmented' | 'continuous';
  transitionOrder?: readonly string[];
  transitionStep?: string;
}) {
  const scrollBodyStyle = [styles.scrollBody, contentStyle];
  const body = transitionStep ? (
    <OnboardingScreenTransition step={transitionStep} stepOrder={transitionOrder} style={scrollBodyStyle}>
      {children}
    </OnboardingScreenTransition>
  ) : <View style={scrollBodyStyle}>{children}</View>;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safe, ground ? { backgroundColor: ground } : null]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <View style={styles.header}>
          <OnboardingBackButton hidden={hideBack} onPress={onBack} />
          {headerProgress ?? (progress ? <BranchProgressBar branch={branch} progress={progress} variant={progressVariant} /> : <View style={styles.progressSpacer} />)}
        </View>
        <ScrollView
          key={branchScrollKey(branch, transitionStep)}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          scrollEventThrottle={16}
        >
          {body}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Segmented progress across the branch's *questions*, not its screens, so the
 * indicator never implies progress the user has not actually made.
 */
export function BranchProgressBar({ branch, progress, variant = 'segmented' }: { branch: BranchId; progress: BranchProgress; variant?: 'segmented' | 'continuous' }) {
  const palette = branchPalettes[branch];
  const total = Math.max(progress.total, 1);
  const answered = Math.min(Math.max(progress.answered, 0), total);
  const displayedStep = Math.min(Math.max(progress.displayedStep ?? answered + 1, 1), total);
  return (
    <View
      accessibilityLabel={`Question ${displayedStep} of ${total}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: answered }}
      style={styles.progress}
    >
      {variant === 'continuous' ? <ContinuousProgress answered={answered} branch={branch} tint={palette.accent} total={total} /> : <View style={styles.progressTrack}>
        {Array.from({ length: total }, (_, index) => <ProgressSegment key={index} filled={index < answered} tint={palette.accent} branch={branch} />)}
      </View>}
      <Text allowFontScaling={false} style={styles.progressLabel}>
        {displayedStep}/{total}
      </Text>
    </View>
  );
}

function ContinuousProgress({ answered, branch, tint, total }: { answered: number; branch: BranchId; tint: string; total: number }) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(answered / total);
  const videoSource = BRANCH_VIDEOS[branch];
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    void player.play();
  });

  useEffect(() => {
    progress.value = withTiming(answered / total, { duration: reduceMotion ? 0 : motionTokens.pagerDot.durationMs });
  }, [answered, progress, reduceMotion, total]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <View style={styles.continuousTrack}>
    <Animated.View style={[styles.continuousFill, fillStyle, { overflow: 'hidden' }]}>
      <VideoView contentFit="cover" nativeControls={false} player={player} style={StyleSheet.absoluteFill} />
    </Animated.View>
  </View>;
}

function ProgressSegment({ filled, tint, branch }: { filled: boolean; tint: string; branch: BranchId }) {
  const reduceMotion = useReduceMotion();
  const fill = useSharedValue<number>(filled ? 1 : 0);
  const videoSource = BRANCH_VIDEOS[branch];
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    void player.play();
  });

  useEffect(() => {
    fill.value = withTiming(filled ? 1 : 0, { duration: reduceMotion ? 0 : motionTokens.pagerDot.durationMs });
  }, [fill, filled, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: 0.18 + fill.value * 0.82 }));
  return <Animated.View style={[styles.progressSegment, animatedStyle, { overflow: 'hidden' }]}>
    <VideoView contentFit="cover" nativeControls={false} player={player} style={StyleSheet.absoluteFill} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  safe: { backgroundColor: colors.canvas, flex: 1 },
  hydration: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 48, paddingHorizontal: 20, paddingRight: __DEV__ ? 20 + DEV_MENU_HEADER_CLEARANCE : 20, paddingTop: 6 },
  progressSpacer: { flex: 1 },
  progress: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10 },
  progressTrack: { flex: 1, flexDirection: 'row', gap: 4 },
  continuousTrack: { backgroundColor: colors.canvasSunk, borderRadius: 999, flex: 1, height: 6, overflow: 'hidden' },
  continuousFill: { borderRadius: 999, height: '100%' },
  progressSegment: { borderRadius: 999, flex: 1, height: 5 },
  progressLabel: { color: branchSurfaces.muted, fontFamily: fontFamilies.semibold, fontSize: 12 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 20, paddingHorizontal: 16, paddingTop: 12 },
  // Preserve each screen's intrinsic height inside ScrollView. A zero-basis
  // flex:1 transition wrapper compresses long option grids under the footer.
  scrollBody: { flexBasis: 'auto', flexGrow: 1, flexShrink: 0 },
  footer: { paddingBottom: 12, paddingHorizontal: 20, paddingTop: 12 },
});
