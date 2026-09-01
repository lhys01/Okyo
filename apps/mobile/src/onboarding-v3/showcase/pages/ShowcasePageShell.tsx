import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { colors, onboardingFontFamilies as fontFamilies, onboardingTitleFont } from '../../../theme/okyoTheme';

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
  return (
    <View style={styles.frame}>
      <View style={styles.artworkSlot}>
        {artworkContent ?? <>{artwork !== undefined ? <ExpoArtwork source={artwork} /> : null}</>}
      </View>
      <View style={styles.textSlot}>
        <TextBlock body={body} title={title} />
      </View>
    </View>
  );
}

function ExpoArtwork({ source }: { source: number }) {
  return <Image accessible={false} contentFit="contain" source={source} style={styles.artwork} />;
}

function TextBlock({ title, body }: { title: string; body: string }) {
  return <><Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>{title}</Text><Text maxFontSizeMultiplier={1.2} style={styles.body}>{body}</Text></>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  indicators: { alignItems: 'center', flexDirection: 'row', gap: 14, height: 28, justifyContent: 'center' },
  dot: { backgroundColor: '#C5C5C5', borderRadius: 8, height: 12, width: 12 },
  activeDot: { backgroundColor: colors.softCharcoal, width: 36 },
  content: { flex: 1 },
  frame: { alignItems: 'center', flex: 1, justifyContent: 'flex-start', paddingTop: 16 },
  artworkSlot: { alignItems: 'center', height: 430, justifyContent: 'center', maxWidth: 392, width: '100%' },
  artwork: { height: '100%', width: '100%' },
  textSlot: { alignItems: 'center', height: 116, justifyContent: 'flex-start', width: '100%' },
  title: { ...onboardingTitleFont, alignSelf: 'stretch', color: '#15151A', fontSize: 27, lineHeight: 31, marginTop: 10, textAlign: 'center' },
  body: { alignSelf: 'center', color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 19, marginTop: 5, maxWidth: 350, textAlign: 'center' },
});
