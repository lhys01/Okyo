import { createContext, useContext, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { colors, onboardingFontFamilies as fontFamilies, onboardingTitleFont } from '../../../theme/okyoTheme';
import { getShowcaseResponsiveLayout, type ShowcaseResponsiveLayout } from '../showcaseResponsiveLayout';

const DEFAULT_LAYOUT = getShowcaseResponsiveLayout({ windowHeight: 852, topInset: 59, bottomInset: 34 });
const ResponsiveLayoutContext = createContext<ShowcaseResponsiveLayout>(DEFAULT_LAYOUT);

export function ShowcaseResponsiveLayoutProvider({ children, layout }: {
  children: ReactNode;
  layout: ShowcaseResponsiveLayout;
}) {
  return <ResponsiveLayoutContext.Provider value={layout}>{children}</ResponsiveLayoutContext.Provider>;
}

export function ShowcasePageShell({
  children,
  // Header and footer controls are owned by ShowcasePager; these legacy props
  // remain accepted so individual page call sites stay behaviorally stable.
  page: _page,
  onNext: _onNext,
  onBack: _onBack,
  ctaLabel: _ctaLabel,
}: {
  children: ReactNode;
  page?: number;
  onNext?: () => void;
  onBack?: () => void;
  ctaLabel?: string;
}) {
  return <View style={styles.root}>{children}</View>;
}

export function ShowcasePageFrame({
  artwork,
  artworkContent,
  title,
  body,
}: {
  artwork?: number;
  artworkContent?: ReactNode;
  title: string;
  body: string;
}) {
  const layout = useContext(ResponsiveLayoutContext);

  return (
    <ScrollView
      contentContainerStyle={[styles.frame, { paddingBottom: layout.contentBottomPadding, paddingTop: layout.framePaddingTop }]}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <View style={[styles.artworkSlot, { height: layout.heroHeight }]}>
        {artworkContent ?? <>{artwork !== undefined ? <ExpoArtwork source={artwork} /> : null}</>}
      </View>
      <View style={[styles.textSlot, { marginTop: layout.artworkTextGap }]}>
        <TextBlock body={body} layout={layout} title={title} />
      </View>
    </ScrollView>
  );
}

function ExpoArtwork({ source }: { source: number }) {
  return <Image accessible={false} contentFit="contain" source={source} style={styles.artwork} />;
}

function TextBlock({ title, body, layout }: { title: string; body: string; layout: ShowcaseResponsiveLayout }) {
  return <><Text accessibilityRole="header" maxFontSizeMultiplier={2} style={[styles.title, { fontSize: layout.headlineSize, lineHeight: layout.headlineLineHeight, marginTop: layout.titleMarginTop }]}>{title}</Text><Text maxFontSizeMultiplier={2} style={[styles.body, { lineHeight: layout.bodyLineHeight }]}>{body}</Text></>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  indicators: { alignItems: 'center', flexDirection: 'row', gap: 14, height: 28, justifyContent: 'center' },
  dot: { backgroundColor: '#C5C5C5', borderRadius: 8, height: 12, width: 12 },
  activeDot: { backgroundColor: colors.softCharcoal, width: 36 },
  content: { flex: 1 },
  frame: { alignItems: 'center', flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: 24 },
  artworkSlot: { alignItems: 'center', flexShrink: 0, justifyContent: 'center', maxWidth: 392, width: '100%' },
  artwork: { height: '100%', width: '100%' },
  textSlot: { alignItems: 'center', flexShrink: 0, justifyContent: 'flex-start', paddingHorizontal: 10, width: '100%' },
  title: { ...onboardingTitleFont, alignSelf: 'stretch', color: '#15151A', fontSize: 27, lineHeight: 31, marginTop: 16, textAlign: 'center' },
  body: { alignSelf: 'center', color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 19, marginTop: 8, maxWidth: 330, textAlign: 'center' },
});
