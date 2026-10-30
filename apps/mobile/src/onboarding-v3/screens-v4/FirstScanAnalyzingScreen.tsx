import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, onboardingFontFamilies as fonts, radius, spacing } from '../../theme/okyoTheme';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { useReduceMotion } from '../motion/useReduceMotion';

type Props = { phase: 'analysis' | 'recipe'; onCancel: () => void; imageUri?: string; description?: string };
export function FirstScanAnalyzingScreen({ phase, onCancel, imageUri, description }: Props) {
  const reduceMotion = useReduceMotion();
  const building = phase === 'recipe';
  return <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text accessibilityRole="header" style={styles.title}>{building ? 'Making it\ncookable.' : 'Getting to know\nyour dish.'}</Text>
      <View style={styles.scene}>
        {imageUri ? <Image accessibilityLabel="The dish you selected" accessibilityRole="image" contentFit="contain" source={{ uri: imageUri }} style={styles.food} /> : <View style={styles.descriptionSurface}><Text style={styles.label}>Your dish</Text><Text style={styles.description}>{description || 'The dish you described'}</Text></View>}
        <Image accessible={false} contentFit="contain" source={onboardingV3Assets.macrosTracking} style={styles.kiko} />
      </View>
      <Animated.View layout={LinearTransition.duration(reduceMotion ? 0 : 260)} accessibilityRole="progressbar" accessibilityLabel={building ? 'Building your recipe' : 'Identifying your dish'} accessibilityState={{ busy: true }} style={styles.progress}>
        <Text style={styles.received}>Dish received</Text>
        <Text accessibilityLiveRegion="polite" style={[styles.phase, building && styles.completed]}>{building ? '✓ Dish identified' : 'Identifying your dish…'}</Text>
        {building ? <Text accessibilityLiveRegion="polite" style={styles.phase}>Building your recipe…</Text> : null}
        <Text style={styles.detail}>{building ? 'Ingredients, steps, nutrition, and cost estimates—with your preferences included.' : 'Looking at what is in the dish before building the recipe.'}</Text>
      </Animated.View>
      <Text style={styles.note}>AI can miss things. You can correct the result.</Text>
    </ScrollView>
    <View style={styles.footer}><Text style={styles.waiting}>Building your recipe…</Text><Pressable accessibilityLabel="Change input" accessibilityRole="button" onPress={onCancel} style={styles.cancel}><Text style={styles.cancelLabel}>Change input</Text></Pressable></View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  title: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 },
  scene: { marginTop: spacing.xl },
  food: { width: '100%', aspectRatio: 1.35, maxHeight: 260, borderRadius: radius.hero, backgroundColor: colors.creamDeep },
  descriptionSurface: { minHeight: 200, backgroundColor: colors.creamDeep, borderRadius: radius.hero, padding: spacing.xl, justifyContent: 'center' },
  label: { color: colors.body, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21 },
  description: { color: colors.ink, fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, marginTop: spacing.md },
  kiko: { alignSelf: 'flex-end', height: 76, marginTop: spacing.sm, width: 76 },
  progress: { marginTop: spacing.lg },
  received: { color: colors.body, fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, marginBottom: spacing.sm },
  phase: { color: colors.ink, fontFamily: fonts.bold, fontSize: 23, lineHeight: 31 },
  completed: { color: colors.savings, fontSize: 16, lineHeight: 25, marginBottom: spacing.sm },
  detail: { color: colors.body, fontFamily: fonts.body, fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  note: { color: colors.body, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, marginTop: spacing.xl },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  waiting: { color: colors.body, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, textAlign: 'center', padding: spacing.lg, backgroundColor: colors.creamDeep, borderRadius: radius.button },
  cancel: { minHeight: 48, padding: spacing.md, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { color: colors.body, fontFamily: fonts.semibold, fontSize: 14 },
});
