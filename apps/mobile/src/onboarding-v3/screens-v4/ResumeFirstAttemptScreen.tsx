import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { OnboardingCTA } from '../components/OnboardingCTA';

export function ResumeFirstAttemptScreen({ onResume, onStartOver }: { onResume: () => void; onStartOver: () => void }) {
  return <SafeAreaView style={styles.safe}><View style={styles.content}>
    <Text style={styles.eyebrow}>Your free recipe is safe</Text><Text style={styles.title}>Resume your scan?</Text>
    <Text style={styles.body}>Okyo saved where you left off. Resume to try again, or start over with another dish.</Text>
    <View style={styles.actions}><OnboardingCTA label="Resume scan" onPress={onResume} />
      <Pressable accessibilityLabel="Start over with another dish" accessibilityRole="button" onPress={onStartOver} style={styles.secondary}><Text style={styles.secondaryText}>Start over</Text></Pressable></View>
  </View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { backgroundColor: colors.background, flex: 1 }, content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 }, eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 14, textTransform: 'uppercase' }, title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 38, marginTop: 8 }, body: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 17, lineHeight: 25, marginTop: 12 }, actions: { marginTop: 30 }, secondary: { alignItems: 'center', minHeight: 50, justifyContent: 'center', marginTop: 6 }, secondaryText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 15 } });
