import { Image } from 'expo-image';
import { Check, Plus, Minus } from 'iconoir-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, onboardingFontFamilies as fonts } from '../../theme/okyoTheme';
import { OnboardingBackButton } from '../components/OnboardingBackButton';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { useReduceMotion } from '../motion/useReduceMotion';
import { MACROS_FOOD_FOCUSES, MACROS_FOOD_BARRIERS, macrosFoodFirstReveal } from '../state/macrosFoodFirst';
import type { PersonalizedAnswer, PersonalizedOnboardingProfile } from '../state/personalizedOnboarding';

type Props = {
  step: string;
  profile: PersonalizedOnboardingProfile;
  onAnswer: (key: string, value: PersonalizedAnswer) => void;
  onBack: () => void;
  onContinue: () => void;
};
const dish = require('../../../assets/food/recipes/garlic-chicken-rice-bowl.png');

/** Food is the visual anchor across questions and the reveal. No fabricated targets. */
export function MacrosFoodFirstScreen({ step, profile, onAnswer, onBack, onContinue }: Props) {
  const reduceMotion = useReduceMotion();
  const focus = step === 'branchIntro';
  const barrier = step === 'question1';
  const targets = step === 'question2';
  const reveal = step === 'branchDemo';
  const own = profile.answers.macrosOwnTargets === 'yes';
  const content = macrosFoodFirstReveal(profile);
  const choices = focus ? MACROS_FOOD_FOCUSES : MACROS_FOOD_BARRIERS;
  const selected = focus ? profile.macroPreferences?.focus : profile.answers.macrosObstacle;
  const refs = profile.macroPreferences?.ownDailyReferences;
  const validTargets = refs?.proteinGrams !== undefined && (profile.answers.macrosDailyCalories == null || refs.calories !== undefined);
  const enabled = reveal || (targets ? validTargets : Boolean(selected));
  const title = focus ? 'Food you love.\nMacros that make sense.' : barrier ? 'What makes it\nhard right now?' : targets ? 'Your targets.\nNot another calculation.' : content.title;
  return <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}><OnboardingBackButton onPress={onBack} /><Text style={styles.wordmark}>MADE FOR YOUR APPETITE</Text></View>
      <ScrollView key={step} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {focus ? <>
          <Image accessible accessibilityLabel="Garlic chicken and rice: an example dish" source={dish} contentFit="cover" style={styles.focusPhoto} />
          <Text style={styles.prompt}>What would you like to focus on?</Text>
        </> : null}
        {barrier ? <Text style={styles.subtitle}>Let’s make room for the way you actually eat.</Text> : null}
        {focus || barrier ? <View accessibilityRole="radiogroup" style={styles.options}>
          {choices.map((choice) => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: selected === choice }} accessibilityLabel={choice} testID={'macros-food-choice-' + choice} onPress={() => onAnswer(focus ? 'macrosFocus' : 'macrosObstacle', choice)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={[styles.choice, selected === choice && styles.choiceSelected]}>{choice}</Text>
            <View style={[styles.radio, selected === choice && styles.radioSelected]}>{selected === choice ? <Check color="#FFFFFF" width={16} height={16} /> : null}</View>
          </Pressable>)}
        </View> : null}
        {barrier ? <>
          <Animated.View layout={LinearTransition.duration(reduceMotion ? 0 : 220)} style={styles.optional}>
            <Pressable accessibilityLabel={own ? 'Remove my daily targets' : 'I already have daily targets'} accessibilityRole="checkbox" accessibilityState={{ checked: own }} onPress={() => onAnswer('macrosOwnTargets', own ? 'no' : 'yes')} style={styles.optionalButton} testID="macros-food-own-toggle">
              {own ? <Minus width={18} height={18} color={colors.macros} /> : <Plus width={18} height={18} color={colors.macros} />}
              <Text style={styles.optionalLabel}>{own ? 'I’ll add my daily targets' : 'I already have daily targets'}</Text>
            </Pressable>
            {own ? <Text style={styles.note}>Add them next. We won’t calculate new ones.</Text> : null}
          </Animated.View>
          <View style={styles.reassurance}><Image accessible={false} source={onboardingV3Assets.macrosIntro} contentFit="contain" style={styles.guide} /><Text style={styles.reassuranceText}>You don’t need to know your targets to start.</Text></View>
        </> : null}
        {targets ? <>
          <Text style={styles.subtitle}>Keep your own daily numbers as a reference.</Text>
          {(['macrosDailyProtein', 'macrosDailyCalories'] as const).map((key) => <View key={key} style={styles.field}>
            <Text style={styles.fieldLabel}>{key === 'macrosDailyProtein' ? 'Protein / day' : 'Calories / day · optional'}</Text>
            <TextInput accessibilityLabel={key === 'macrosDailyProtein' ? 'Daily protein in grams' : 'Daily calories, optional'} keyboardType="number-pad" value={profile.answers[key] == null ? '' : String(profile.answers[key])} onChangeText={(text) => onAnswer(key, text === '' ? null : /^\d+$/.test(text) ? Number(text) : text)} placeholder={key === 'macrosDailyProtein' ? 'Grams' : 'Calories'} placeholderTextColor={colors.body} maxLength={6} style={styles.input} testID={key} />
          </View>)}
          <Text style={styles.note}>Your numbers—not targets recommended by Okyo. Recipe estimates are per serving, not per day.</Text>
          {!validTargets && (profile.answers.macrosDailyProtein != null || profile.answers.macrosDailyCalories != null) ? <Text accessibilityRole="alert" style={styles.error}>Use 1–400g protein. Calories can be 800–6,000, or left blank.</Text> : null}
          <Pressable accessibilityLabel="Continue without entering daily targets" accessibilityRole="button" onPress={() => { onAnswer('macrosOwnTargets', 'no'); onBack(); }} style={styles.optionalButton}><Text style={styles.optionalLabel}>Continue without targets</Text></Pressable>
        </> : null}
        {reveal ? <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(220)}>
          <View style={styles.revealScene}>
            <Image accessibilityLabel="Example garlic chicken and rice bowl, not your generated recipe" source={dish} contentFit="cover" style={styles.revealPhoto} />
            <View style={styles.foodCaption}><Text style={styles.caption}>Garlic chicken & rice</Text><Text style={styles.captionSmall}>Example dish</Text></View>
          </View>
          <Text style={styles.response}>{content.response}</Text>
          <View style={styles.insight}><Text style={styles.insightTitle}>{content.insight}</Text><Text style={styles.note}>Your recipe will show estimated nutrition per serving.</Text></View>
          {own && refs ? <Text style={styles.reference}>Your daily reference: {refs.proteinGrams}g protein{refs.calories ? ` · ${refs.calories} cal` : ''}</Text> : null}
        </Animated.View> : null}
      </ScrollView>
      <View style={styles.footer}><OnboardingCTA disabled={!enabled} label={reveal ? 'Start with a dish I love' : targets ? 'See my approach' : barrier && !own ? 'See my approach' : 'Continue'} onPress={onContinue} testID="macros-food-continue" tone="pastelPink" /></View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceMuted }, flex: { flex: 1 },
  header: { minHeight: 48, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.4, color: colors.macros },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28 },
  title: { fontFamily: fonts.extraBold, fontSize: 36, lineHeight: 41, letterSpacing: -1.4, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: colors.body, marginTop: 16 },
  focusPhoto: { height: 190, width: '100%', borderRadius: 28, marginTop: 22 },
  prompt: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 25, color: colors.ink, marginTop: 22 },
  options: { marginTop: 12 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  choice: { flex: 1, fontFamily: fonts.semibold, fontSize: 19, lineHeight: 26, color: colors.ink },
  choiceSelected: { color: colors.macros }, radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.body, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.macros, borderColor: colors.macros },
  optional: { marginTop: 22 }, optionalButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionalLabel: { color: colors.macros, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.body, marginTop: 8 },
  reassurance: { marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 14 }, guide: { width: 75, height: 90 },
  reassuranceText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, color: colors.body },
  field: { marginTop: 28 }, fieldLabel: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  input: { minHeight: 70, paddingVertical: 12, color: colors.macros, fontFamily: fonts.bold, fontSize: 36, borderBottomWidth: 1, borderBottomColor: colors.macros },
  error: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.danger, marginTop: 16 },
  revealScene: { marginTop: 24, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.macrosSoft },
  revealPhoto: { height: 300, width: '100%' }, foodCaption: { paddingHorizontal: 18, paddingVertical: 12 },
  caption: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, color: colors.ink }, captionSmall: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.body },
  response: { fontFamily: fonts.medium, fontSize: 19, lineHeight: 28, color: colors.ink, marginTop: 24 },
  insight: { marginTop: 20 }, insightTitle: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 26, color: colors.macros },
  reference: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.body, marginTop: 16 },
  footer: { paddingHorizontal: 24, paddingVertical: 12 }, pressed: { opacity: 0.65 },
});
