import { Image } from 'expo-image';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors, onboardingFontFamilies as fontFamilies } from '../../../theme/okyoTheme';
import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { OnboardingBackButton } from '../../components/OnboardingBackButton';
import { OnboardingCTA } from '../../components/OnboardingCTA';
import { PageScaffold } from '../../components/PageScaffold';
import type { ShowcasePageProps } from './types';

export function CustomizeDetailsPage({ page, onBack, onNext }: ShowcasePageProps) {
  const { height } = useWindowDimensions();
  const compact = height < 760;
  return (
    <PageScaffold
      header={<OnboardingBackButton onPress={onBack} />}
      footer={<OnboardingCTA label="Next" onPress={onNext} />}
    >
      <View style={[styles.content, compact && styles.compactContent]}>
        <View accessibilityLabel={`Showcase page ${page + 1}`} accessibilityRole="image" style={[styles.dots, compact && styles.compactDots]}>
          {[0, 1, 2, 3, 4, 5, 6].map((dot) => <View key={dot} style={[styles.dot, dot === page && styles.activeDot]} />)}
        </View>
        <Image accessible accessibilityLabel="Approved salmon bowl customization artwork" contentFit="contain" source={onboardingV3Assets.approvedMoreThanRecipeArtwork} style={[styles.artwork, compact && styles.compactArtwork]} />
        <Text accessibilityRole="header" style={[styles.heading, compact && styles.compactHeading]}>More than just a recipe</Text>
        <Text style={styles.body}>See nutrition, cooking time, and what making the dish at home could cost.</Text>
      </View>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flex: 1, justifyContent: 'flex-start' },
  compactContent: { justifyContent: 'flex-start' },
  dots: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  compactDots: { marginBottom: 8 },
  dot: { backgroundColor: '#C5C5C5', borderRadius: 8, height: 12, width: 12 },
  activeDot: { backgroundColor: colors.softCharcoal, width: 36 },
  artwork: { aspectRatio: 772 / 1043, maxHeight: '76%', width: '100%' },
  compactArtwork: { maxHeight: '70%' },
  heading: { color: '#15151A', fontFamily: fontFamilies.extraBold, fontSize: 27, lineHeight: 31, marginTop: 10, textAlign: 'center' },
  compactHeading: { fontSize: 24, lineHeight: 28, marginTop: 10 },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 19, marginTop: 5, maxWidth: 350, textAlign: 'center' },
});
