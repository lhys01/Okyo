import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { OnboardingCTA } from '../components/OnboardingCTA';

export function FoxIntroductionScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
    <View style={styles.header}><OnboardingBackButton onPress={onBack} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Image accessibilityLabel="Your Okyo virtual assistant fox" accessibilityRole="image" contentFit="contain" source={onboardingV3Assets.welcomeArtwork} style={styles.art} />
      <Text accessibilityRole="header" style={styles.title}>Meet your virtual assistant fox.</Text>
      <Text style={styles.body}>Your fox will help you find meals that fit your goal. First, give your fox a name.</Text>
    </ScrollView>
    <View style={styles.footer}><OnboardingCTA label="Name my fox" onPress={onContinue} tone="pastelPink" /></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 10 },
  content: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  art: { height: 220, maxWidth: '80%', width: 270 },
  title: { color: colors.ink, fontFamily: fontFamilies.extraBold, fontSize: 30, lineHeight: 37, textAlign: 'center' },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 17, lineHeight: 25, marginTop: 14, maxWidth: 340, textAlign: 'center' },
  footer: { paddingHorizontal: 24, paddingVertical: 12 },
});
