import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { prefetchOnboardingV3Assets } from '../assets/onboardingV3Assets';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { ONBOARDING_BACK_ROW_HEIGHT, ONBOARDING_BACK_ROW_TOP_GAP, ONBOARDING_HORIZONTAL_PADDING } from '../components/onboardingLayout';
import { colors, homeRecipeCardShadow, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { motionTokens } from '../motion/motionTokens';
import { useReduceMotion } from '../motion/useReduceMotion';
import type { AttributionSource } from '../state/attribution';
import { onboardingV3Log } from '../utils/onboardingV3Log';
import { AttributionPage } from './pages/AttributionPage';
import { CustomizePage } from './pages/CustomizePage';
import { CustomizeDetailsPage } from './pages/CustomizeDetailsPage';
import { HeroPage } from './pages/HeroPage';
import { MeetKikoPage } from './pages/MeetKikoPage';
import { ScanPage } from './pages/ScanPage';
import { ValuePage } from './pages/ValuePage';
import { showcasePages } from './showcasePages';

export function ShowcasePager({
  initialPage = 0,
  attribution,
  onAttributionSelected,
  onAttributionSkipped,
  onPageChange,
  onFinished,
}: {
  initialPage?: number;
  attribution: AttributionSource | null;
  onAttributionSelected: (source: AttributionSource) => void;
  onAttributionSkipped: () => void;
  onPageChange?: (page: number) => void;
  onFinished: () => void;
}) {
  const pager = useRef<PagerView>(null);
  const reduceMotion = useReduceMotion();
  const buttonScale = useSharedValue(1);
  const buttonShadow = useSharedValue<number>(homeRecipeCardShadow.shadowOpacity);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: buttonShadow.value,
    transform: [{ scale: buttonScale.value }],
  }));
  const pendingPageSource = useRef<'button' | null>(null);
  const [showcasePage, setShowcasePage] = useState(initialPage);
  const moveTo = useCallback((page: number) => {
    if (page < 0 || page >= showcasePages.length) return;
    pendingPageSource.current = 'button';
    pager.current?.setPage(page);
  }, []);
  const advance = useCallback(() => {
    if (showcasePage === showcasePages.length - 1) onFinished();
    else moveTo(showcasePage + 1);
  }, [moveTo, onFinished, showcasePage]);
  const next = useCallback(() => {
    if (showcasePage === 5) onAttributionSkipped();
    advance();
  }, [advance, onAttributionSkipped, showcasePage]);
  const back = useCallback(() => {
    if (showcasePage > 0) moveTo(showcasePage - 1);
  }, [moveTo, showcasePage]);
  const pressIn = () => {
    buttonScale.value = withTiming(reduceMotion ? 1 : motionTokens.cta.pressedScale, { duration: reduceMotion ? 0 : motionTokens.cta.pressInMs, easing: Easing.out(Easing.quad) });
    buttonShadow.value = withTiming(homeRecipeCardShadow.shadowOpacity * 0.6, { duration: reduceMotion ? 0 : motionTokens.cta.pressInMs, easing: Easing.out(Easing.quad) });
  };
  const pressOut = () => {
    buttonScale.value = withDelay(reduceMotion ? 0 : motionTokens.cta.releaseDelayMs, withTiming(1, { duration: reduceMotion ? 0 : motionTokens.cta.pressOutMs, easing: Easing.out(Easing.quad) }));
    buttonShadow.value = withDelay(reduceMotion ? 0 : motionTokens.cta.releaseDelayMs, withTiming(homeRecipeCardShadow.shadowOpacity, { duration: reduceMotion ? 0 : motionTokens.cta.pressOutMs, easing: Easing.out(Easing.quad) }));
  };

  useEffect(() => {
    const assets = showcasePages.slice(showcasePage, showcasePage + 3).flatMap((page) => page.prefetchAssets);
    void prefetchOnboardingV3Assets(assets).catch(() => undefined);
  }, [showcasePage]);

  const pageProps = (page: number) => ({ page, settled: showcasePage === page, onNext: advance, onBack: back });
  const pagerContent = (
    <View style={styles.pager}>
      <PagerView
        initialPage={initialPage}
        onPageSelected={(event) => {
          const page = event.nativeEvent.position;
          setShowcasePage(page);
          onPageChange?.(page);
          onboardingV3Log('showcase_page', { page, source: pendingPageSource.current ?? 'swipe' });
          pendingPageSource.current = null;
        }}
        orientation="horizontal"
        overdrag
        ref={pager}
        style={styles.pager}
      >
      <View collapsable={false} key="hero" style={{ flex: 1 }}><HeroPage {...pageProps(0)} /></View>
      <View collapsable={false} key="scan" style={{ flex: 1 }}><ScanPage {...pageProps(1)} /></View>
      <View collapsable={false} key="value" style={{ flex: 1 }}><ValuePage {...pageProps(2)} /></View>
      <View collapsable={false} key="customize" style={{ flex: 1 }}><CustomizePage {...pageProps(3)} /></View>
      <View collapsable={false} key="customizeDetails" style={{ flex: 1 }}><CustomizeDetailsPage {...pageProps(4)} /></View>
      <View collapsable={false} key="attribution" style={{ flex: 1 }}>
        <AttributionPage
          {...pageProps(5)}
          attribution={attribution}
          onSelectAttribution={onAttributionSelected}
          onSkipAttribution={onAttributionSkipped}
        />
      </View>
      <View collapsable={false} key="meetKiko" style={{ flex: 1 }}><MeetKikoPage {...pageProps(6)} /></View>
      </PagerView>
    </View>
  );

  const carouselChromeVisible = showcasePage > 0;
  return (
    <SafeAreaView edges={carouselChromeVisible ? ['top', 'bottom'] : []} style={styles.screen}>
      {carouselChromeVisible ? (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(220)} style={styles.header}>
          <OnboardingBackButton onPress={back} />
          <View accessibilityLabel={`Showcase page ${showcasePage + 1} of ${showcasePages.length}`} accessibilityRole="image" style={styles.indicators}>
            {showcasePages.map((page, index) => <View key={page.id} style={[styles.dot, index === showcasePage && styles.activeDot]} />)}
          </View>
        </Animated.View>
      ) : null}
      <View style={styles.content}>{pagerContent}</View>
      {carouselChromeVisible ? <Animated.View entering={FadeIn.duration(320)} exiting={FadeOut.duration(220)} style={styles.footer}>
        {showcasePage === 6 ? (
          <Animated.View style={[styles.meetKikoButton, buttonAnimatedStyle]}>
          <Pressable
            accessibilityLabel="Name your fox"
            accessibilityRole="button"
            accessibilityState={{ disabled: false }}
            onPress={onFinished}
            onPressIn={pressIn}
            onPressOut={pressOut}
            style={({ pressed }) => [styles.meetKikoButtonInner, pressed && styles.meetKikoButtonPressed]}
            testID="meet-kiko-name-fox"
            >
            <Text maxFontSizeMultiplier={1.2} style={styles.meetKikoLabel}>Next</Text>
          </Pressable>
          </Animated.View>
        ) : (
          <OnboardingCTA label="Next"
            accessibilityLabel={showcasePage === 5 ? 'Continue from attribution' : undefined}
            disabled={showcasePage === 5 && attribution === null}
            onPress={next}
            testID={showcasePage === 5 ? 'attribution-next' : undefined}
          />
        )}
      </Animated.View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFFFFF', flex: 1 },
  header: {
    height: ONBOARDING_BACK_ROW_HEIGHT + ONBOARDING_BACK_ROW_TOP_GAP + 36,
    paddingHorizontal: ONBOARDING_HORIZONTAL_PADDING,
    paddingTop: ONBOARDING_BACK_ROW_TOP_GAP,
  },
  indicators: { alignItems: 'center', flexDirection: 'row', gap: 14, height: 28, justifyContent: 'center', marginTop: 4 },
  dot: { backgroundColor: '#C5C5C5', borderRadius: 8, height: 12, width: 12 },
  activeDot: { backgroundColor: colors.softCharcoal, width: 36 },
  content: { flex: 1 },
  pager: { flex: 1 },
  footer: { paddingBottom: 6, paddingHorizontal: 16, paddingTop: 6 },
  meetKikoButton: { alignSelf: 'center', maxWidth: 360, ...homeRecipeCardShadow, width: '86%' },
  meetKikoButtonInner: { alignItems: 'center', backgroundColor: '#FFA8C2', borderRadius: 999, flexDirection: 'row', justifyContent: 'center', minHeight: 60, paddingHorizontal: 28, width: '100%' },
  meetKikoButtonPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  meetKikoLabel: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 17, fontWeight: 'normal' },
});
