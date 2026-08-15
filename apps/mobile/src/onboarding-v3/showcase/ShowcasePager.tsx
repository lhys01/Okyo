import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { prefetchOnboardingV3Assets } from '../assets/onboardingV3Assets';
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
  const pendingPageSource = useRef<'button' | null>(null);
  const [showcasePage, setShowcasePage] = useState(initialPage);
  const moveTo = useCallback((page: number) => {
    if (page < 0 || page >= showcasePages.length) return;
    pendingPageSource.current = 'button';
    pager.current?.setPage(page);
  }, []);
  const next = useCallback(() => {
    if (showcasePage === showcasePages.length - 1) onFinished();
    else moveTo(showcasePage + 1);
  }, [moveTo, onFinished, showcasePage]);
  const back = useCallback(() => {
    if (showcasePage > 0) moveTo(showcasePage - 1);
  }, [moveTo, showcasePage]);

  useEffect(() => {
    const assets = showcasePages.slice(showcasePage, showcasePage + 3).flatMap((page) => page.prefetchAssets);
    void prefetchOnboardingV3Assets(assets).catch(() => undefined);
  }, [showcasePage]);

  const pageProps = (page: number) => ({ page, settled: showcasePage === page, onNext: next, onBack: back });
  return (
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
      style={{ flex: 1 }}
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
  );
}
