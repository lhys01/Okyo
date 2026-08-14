import { Spark } from 'iconoir-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';

export function FirstScanAnalyzingScreen({ phase, onCancel }: { phase: 'analysis' | 'recipe'; onCancel: () => void }) {
  const stages = phase === 'analysis'
    ? ['Identifying your dish']
    : ['Finding ingredients', 'Building your recipe', 'Estimating nutrition', 'Applying dietary preferences'];
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}><OnboardingBackButton onPress={onCancel} /></View>
      <View style={styles.content}>
        <View accessibilityLabel="Analyzing dish" accessibilityRole="progressbar" style={styles.visual}><Spark color={colors.coralDark} height={58} width={58} /></View>
        <Text style={styles.title}>{phase === 'analysis' ? 'Studying your dish' : 'Making it cookable'}</Text>
        <View accessibilityLiveRegion="polite" style={styles.stages}>{stages.map((stage) => <Text key={stage} style={styles.stage}>• {stage}</Text>)}</View>
        <Text style={styles.note}>Recipe, nutrition, and cost estimates are AI-generated and can be edited.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { minHeight: 56, paddingHorizontal: 20, paddingTop: 8 },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingBottom: 70, paddingHorizontal: 30 },
  visual: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 48, height: 128, justifyContent: 'center', width: 128 },
  title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 28, marginTop: 28, textAlign: 'center' },
  stages: { alignItems: 'flex-start', marginTop: 14 },
  stage: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 16, lineHeight: 27 },
  note: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 18, marginTop: 20, maxWidth: 310, textAlign: 'center' },
});
