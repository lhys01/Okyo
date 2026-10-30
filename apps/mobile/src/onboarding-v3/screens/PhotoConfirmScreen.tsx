import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { OnboardingCTA } from '../components/OnboardingCTA';

export function PhotoConfirmScreen({ photoUri, onBack, onConfirm }: {
  photoUri: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Your first dish</Text>
          <Text style={styles.title}>Ready to scan?</Text>
        </View>
        <View style={styles.previewArea}>
          <View style={styles.previewFrame}>
            <Image accessibilityLabel="Selected dish photo" contentFit="contain" source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
          </View>
        </View>
        <View style={styles.footer}>
          <OnboardingCTA label="Use Photo" onPress={onConfirm} />
          <Pressable accessibilityLabel="Retake or choose another photo" accessibilityRole="button" onPress={onBack} style={styles.retake}>
            <Text style={styles.retakeText}>Retake or choose another</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.charcoal, flex: 1 },
  safeArea: { flex: 1 },
  heading: { paddingHorizontal: 24, paddingTop: 24 },
  eyebrow: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontFamily: fontFamilies.extraBold, fontSize: 38, letterSpacing: -0.8, marginTop: 7 },
  previewArea: { flex: 1, minHeight: 0, paddingHorizontal: 24, paddingVertical: 18 },
  previewFrame: { backgroundColor: '#292325', borderRadius: 28, flex: 1, overflow: 'hidden', width: '100%' },
  footer: { backgroundColor: 'rgba(251,241,229,0.96)', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 8, paddingHorizontal: 24, paddingTop: 22 },
  retake: { alignItems: 'center', justifyContent: 'center', minHeight: 50, marginTop: 6 },
  retakeText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 15 },
});
