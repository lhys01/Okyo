import { Check, Clock, NavArrowLeft, NavArrowRight, Xmark } from 'iconoir-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Recipe } from '../../mocks';
import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { buildGuidedCookingSteps } from '../../utils/guidedCookingSteps';
import { getConciseGuidedInstruction } from '../../utils/guidedInstruction';

export function OnboardingCookingScreen({ recipe, initialIndex = 0, onBack, onExit, onProgress, onComplete }: {
  recipe: Recipe;
  initialIndex?: number;
  onBack: () => void;
  onExit: () => void;
  onProgress: (index: number, total: number) => void;
  onComplete: () => void;
}) {
  const steps = useMemo(() => buildGuidedCookingSteps(recipe), [recipe]);
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, steps.length - 1)));
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const move = (next: number) => {
    const safe = Math.max(0, Math.min(next, steps.length - 1));
    setIndex(safe);
    onProgress(safe, steps.length);
  };
  const next = () => isLast ? onComplete() : move(index + 1);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to recipe" accessibilityRole="button" onPress={onBack} style={styles.iconButton}>
          <NavArrowLeft color={colors.charcoal} height={23} width={23} />
        </Pressable>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%` }]} /></View>
        <Pressable accessibilityLabel="Exit cooking" accessibilityRole="button" onPress={onExit} style={styles.iconButton}>
          <Xmark color={colors.charcoal} height={24} width={24} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{step.phase || 'Cooking'} · Step {index + 1} of {steps.length}</Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.instruction}>{getConciseGuidedInstruction(step.instruction)}</Text>
        {step.estimatedMinutes ? (
          <View style={styles.metaPill}><Clock color={colors.coralDark} height={18} width={18} /><Text style={styles.metaText}>About {step.estimatedMinutes} min</Text></View>
        ) : null}
        {step.ingredientsUsed.length ? (
          <InfoCard title="Use now" body={step.ingredientsUsed.map((item) => `${item.quantity} ${item.name}`.trim()).join(' · ')} />
        ) : null}
        {step.toolsUsed.length ? <InfoCard title="Tools" body={step.toolsUsed.join(' · ')} /> : null}
        {step.doneWhen ? <InfoCard title="You’re done when" body={step.doneWhen} accent /> : null}
        {step.visualCue ? <InfoCard title="Look for" body={step.visualCue} /> : null}
        {step.tip ? <InfoCard title={step.tip.title} body={step.tip.body} /> : null}
        {step.safetyNote ? <InfoCard title="Safety note" body={step.safetyNote} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable accessibilityLabel="Previous cooking step" accessibilityRole="button" disabled={index === 0} onPress={() => move(index - 1)} style={[styles.previous, index === 0 && styles.disabled]}>
          <NavArrowLeft color={colors.charcoal} height={19} width={19} />
          <Text style={styles.previousText}>Previous</Text>
        </Pressable>
        <Pressable accessibilityLabel={isLast ? 'Finish cooking' : 'Next cooking step'} accessibilityRole="button" onPress={next} style={styles.next}>
          {isLast ? <Check color="#FFFFFF" height={21} strokeWidth={3} width={21} /> : null}
          <Text style={styles.nextText}>{isLast ? 'Finish cooking' : 'Next step'}</Text>
          {!isLast ? <NavArrowRight color="#FFFFFF" height={20} width={20} /> : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function InfoCard({ title, body, accent = false }: { title: string; body: string; accent?: boolean }) {
  return (
    <View style={[styles.card, accent && styles.accentCard]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 13, minHeight: 58, paddingHorizontal: 18 },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  progressTrack: { backgroundColor: colors.creamDeep, borderRadius: 999, flex: 1, height: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.coral, borderRadius: 999, height: '100%' },
  content: { paddingBottom: 28, paddingHorizontal: 24, paddingTop: 16 },
  eyebrow: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 13, letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { color: colors.charcoal, fontFamily: fontFamilies.extraBold, fontSize: 34, letterSpacing: -0.7, lineHeight: 41, marginTop: 8 },
  instruction: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 18, lineHeight: 28, marginTop: 16 },
  metaPill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.coralSoft, borderRadius: 999, flexDirection: 'row', gap: 7, marginTop: 18, minHeight: 42, paddingHorizontal: 14 },
  metaText: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: 20, marginTop: 13, padding: 17 },
  accentCard: { backgroundColor: colors.greenSoft },
  cardTitle: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 15 },
  cardBody: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21, marginTop: 5 },
  footer: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, paddingBottom: 8, paddingHorizontal: 18, paddingTop: 12 },
  previous: { alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'center', minHeight: 54, paddingHorizontal: 12 },
  previousText: { color: colors.charcoal, fontFamily: fontFamilies.bold, fontSize: 14 },
  next: { alignItems: 'center', backgroundColor: colors.softCharcoal, borderRadius: 999, flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 56, paddingHorizontal: 20 },
  nextText: { color: '#FFFFFF', fontFamily: fontFamilies.bold, fontSize: 15 },
  disabled: { opacity: 0.35 },
});
