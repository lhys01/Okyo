import { NavArrowLeft, Refresh, Spark } from 'iconoir-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';

export function V4CustomizationScreen({ action, error, instruction, isApplying, onBack, onRetry, recipeTitle }: {
  action: 'cook' | 'customize';
  error: string | null;
  instruction: string;
  isApplying: boolean;
  onBack: () => void;
  onRetry: () => void;
  recipeTitle: string;
}) {
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
    <View style={styles.header}>{!isApplying ? <Pressable accessibilityLabel="Back to free recipe" accessibilityRole="button" onPress={onBack} style={styles.back}><NavArrowLeft color={colors.charcoal} height={24} width={24} /></Pressable> : null}</View>
    <View style={styles.content}>
      <View style={styles.icon}>{isApplying ? <ActivityIndicator color={colors.coralDark} /> : <Spark color={colors.coralDark} height={30} width={30} />}</View>
      <Text style={styles.eyebrow}>{isApplying ? (action === 'cook' ? 'Opening Cook Mode' : 'Applying customization') : `${action === 'cook' ? 'Cook Mode' : 'Customization'} paused`}</Text>
      <Text style={styles.title}>{isApplying ? (action === 'cook' ? `Getting ${recipeTitle} ready` : `Updating ${recipeTitle}`) : 'Your original recipe is safe'}</Text>
      <Text style={styles.body}>{isApplying ? (action === 'cook' ? 'Okyo is restoring the same recipe and cooking step.' : 'Okyo is applying the exact request you submitted. Keep this screen open for a moment.') : error ?? 'Okyo couldn’t safely finish that action yet.'}</Text>
      {action === 'customize' ? <View style={styles.request}><Text style={styles.requestLabel}>Your request</Text><Text style={styles.requestText}>{instruction}</Text></View> : null}
      {!isApplying ? <Pressable accessibilityLabel={`Retry ${action === 'cook' ? 'Cook Mode' : 'customization'}`} accessibilityRole="button" onPress={onRetry} style={styles.retry}><Refresh color="#FFFFFF" height={19} width={19} /><Text style={styles.retryText}>Retry</Text></Pressable> : null}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safeArea: { backgroundColor: colors.background, flex: 1 }, header: { minHeight: 52, paddingHorizontal: 18 }, back: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 }, content: { paddingHorizontal: 24, paddingTop: 20 }, icon: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 999, height: 58, justifyContent: 'center', width: 58 }, eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.5, marginTop: 18, textTransform: 'uppercase' }, title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 32, lineHeight: 39, marginTop: 7 }, body: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24, marginTop: 9 }, request: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20, borderWidth: 1, marginTop: 20, padding: 16 }, requestLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 12, textTransform: 'uppercase' }, requestText: { color: colors.charcoal, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 23, marginTop: 7 }, retry: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.coralDark, borderRadius: 16, flexDirection: 'row', gap: 8, marginTop: 18, minHeight: 48, paddingHorizontal: 18 }, retryText: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 15 } });
