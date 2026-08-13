import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { OnboardingCTA } from '../components/OnboardingCTA';

export function CookingCompleteScreen({ mascotName, onContinue }: { mascotName: string; onContinue: () => void }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Nice — you cooked it.</Text>
        <Text style={styles.body}>{mascotName} saved this recipe to your recent dishes. Costs and nutrition are estimates, and you can adjust the recipe anytime.</Text>
      </View>
      <View style={styles.footer}><OnboardingCTA label="Continue" onPress={onContinue} /></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 35, letterSpacing: -0.7, marginTop: 16, textAlign: 'center' },
  body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, marginTop: 12, maxWidth: 340, textAlign: 'center' },
  footer: { paddingBottom: 8, paddingHorizontal: 24, paddingTop: 12 },
});
