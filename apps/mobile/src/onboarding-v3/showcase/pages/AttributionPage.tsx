import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppStore, Check, Group, Instagram, Tiktok, UserLove, Youtube } from 'iconoir-react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../../theme/okyoTheme';
import { type AttributionSource } from '../../state/attribution';
import { OnboardingBackButton } from '../../components/OnboardingBackButton';
import { OnboardingCTA } from '../../components/OnboardingCTA';
import { PageScaffold } from '../../components/PageScaffold';
import { motionTokens } from '../../motion/motionTokens';
import { useReduceMotion } from '../../motion/useReduceMotion';
import { getShowcaseResponsiveLayout } from '../showcaseResponsiveLayout';
import type { ShowcasePageProps } from './types';

const OPTIONS = [
  { source: 'influencer', label: 'From influencer', Icon: UserLove, color: '#8B62C6' },
  { source: 'instagram', label: 'Instagram', Icon: Instagram, color: '#D45586' },
  { source: 'tiktok', label: 'TikTok', Icon: Tiktok, color: '#29252A' },
  { source: 'youtube', label: 'YouTube', Icon: Youtube, color: '#E6534D' },
  { source: 'app_store', label: 'App Store search', Icon: AppStore, color: '#4B91E7' },
  { source: 'friends_family', label: 'Friends / family', Icon: Group, color: '#47A967' },
] as const satisfies readonly { source: AttributionSource; label: string; Icon: typeof Instagram; color: string }[];

function AttributionRow({ option, index, selected, settled, onPress }: {
  option: typeof OPTIONS[number];
  index: number;
  selected: boolean;
  settled: boolean;
  onPress: () => void;
}) {
  const Icon = option.Icon;
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(settled ? 1 : 0);
  const checkScale = useSharedValue(selected ? 1 : 0.85);
  useEffect(() => {
    progress.value = reduceMotion
      ? withTiming(settled ? 1 : 0, { duration: motionTokens.settle.reduceMotionMs })
      : withDelay(index * motionTokens.attribution.rowDelayStepMs, withTiming(settled ? 1 : 0, {
          duration: motionTokens.attribution.rowMs,
          easing: Easing.out(Easing.quad),
        }));
  }, [index, progress, reduceMotion, settled]);
  useEffect(() => {
    checkScale.value = selected
      ? reduceMotion ? 1 : withSpring(1, { damping: motionTokens.attribution.springDamping, stiffness: motionTokens.attribution.springStiffness })
      : 0.85;
  }, [checkScale, reduceMotion, selected]);
  const rowStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * motionTokens.stagger.translateY }],
  }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: selected ? 1 : 0, transform: [{ scale: checkScale.value }] }));
  return (
    <Animated.View style={[styles.rowWrap, rowStyle]}>
      <AnimatedPressable
        accessibilityLabel={option.label}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[styles.row, selected && styles.rowSelected]}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${option.color}14` }]}><Icon color={option.color} height={23} strokeWidth={2.2} width={23} /></View>
        <Text maxFontSizeMultiplier={1.2} style={styles.rowLabel}>{option.label}</Text>
        <Animated.View style={[styles.check, checkStyle]}><Check color={colors.coralDark} height={20} strokeWidth={3} width={20} /></Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AttributionPage(props: ShowcasePageProps & {
  attribution: AttributionSource | null;
  onSelectAttribution: (source: AttributionSource) => void;
  onSkipAttribution: () => void;
}) {
  const [selected, setSelected] = useState<AttributionSource | null>(props.attribution);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = getShowcaseResponsiveLayout({ windowHeight: height, topInset: insets.top, bottomInset: insets.bottom });
  const reduceMotion = useReduceMotion();
  const advance = useSharedValue(0);

  const select = (source: AttributionSource) => {
    setSelected(source);
    props.onSelectAttribution(source);
    if (reduceMotion) {
      props.onNext();
      return;
    }
    advance.value = withTiming(1, {
      duration: motionTokens.attribution.selectMs,
      easing: Easing.out(Easing.quad),
    }, (finished) => {
      if (finished) runOnJS(props.onNext)();
    });
  };

  return (
    <PageScaffold
      footer={<OnboardingCTA label="Submit" onPress={() => { props.onSkipAttribution(); props.onNext(); }} />}
      header={<OnboardingBackButton onPress={props.onBack} />}
    >
      <ScrollView contentContainerStyle={[styles.content, layout.compact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.25} style={[styles.title, layout.compact && styles.titleCompact]}>How did you hear about Okyo?</Text>
        <View accessibilityRole="radiogroup" style={[styles.rows, layout.compact && styles.rowsCompact]}>
          {OPTIONS.map((option, index) => (
            <AttributionRow
              index={index}
              key={option.source}
              onPress={() => select(option.source)}
              option={option}
              selected={selected === option.source}
              settled={props.settled}
            />
          ))}
        </View>
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingBottom: 10, paddingTop: 0 },
  contentCompact: { paddingBottom: 4 },
  title: { alignSelf: 'stretch', color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 30, fontWeight: '900', letterSpacing: -0.8, lineHeight: 35, marginBottom: 18, textAlign: 'center' },
  titleCompact: { fontSize: 27, lineHeight: 31, marginBottom: 10 },
  rows: { gap: 8, width: '100%' },
  rowsCompact: { gap: 5 },
  rowWrap: { width: '100%' },
  row: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: 13 },
  rowSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  iconCircle: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  rowLabel: { color: colors.charcoal, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 15, fontWeight: '600', marginLeft: 13 },
  check: { alignItems: 'center', height: 24, justifyContent: 'center', width: 24 },
});
