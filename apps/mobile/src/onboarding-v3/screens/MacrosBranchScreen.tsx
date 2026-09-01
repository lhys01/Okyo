import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Activity, ChatBubbleQuestion, ClockRotateRight, Cookie, Cutlery, EmojiQuite, Flash, Hashtag,
  LightBulb, List, MenuScale, PizzaSlice, QuestionMark, Repeat, ScaleFrameReduce, SunLight, Timer, Weight,
} from 'iconoir-react-native';

import { colors, onboardingFontFamilies as fontFamilies } from '../../theme/okyoTheme';
import { analyticsEvents, track } from '../../analytics/track';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { BranchScaffold } from '../branch-ui/BranchScaffold';
import { BranchHeading, ChipGroup, ChoiceRows, type ChoiceOption } from '../branch-ui/BranchControls';
import { branchShadow } from '../branch-ui/branchTheme';
import { getBranchProgress } from '../branch-ui/branchProgress';
import { HealthMessageScreen, HealthQuestionLayout } from './HealthVisuals';
import {
  MacrosApproachScreen, MacrosNutritionVisual, MacrosPlanVisual, MacrosReassuranceAccent,
  MacrosRevealScreen, MacrosWhatOkyoScreen, type MacrosSummaryRow,
} from './MacrosVisuals';
import { OnboardingNumberPicker, type NumberPickerOption } from '../components/OnboardingNumberPicker';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { macrosBranchPersistence } from '../state/macrosBranchPersistence';
import {
  calculateProteinPreferenceGrams, initialMacrosDraft, macrosReducer, MACROS_STEPS,
  type BodyWeightUnit, type CalorieTrackingStatus, type MacroBarrierId, type MacroCommitmentId, type MacroFocusId,
  type MacrosMealToImproveId, type MacrosStep, type ProteinMultiplier, type TrackingStyleId,
} from '../state/macrosBranch';
import {
  approachHeadline, barrierResponse, calorieInsightBody, focusInsightBody, mealInsightBody,
  planSummaryRows, proteinPreferenceLine, revealSummary, startingPointValue,
} from '../state/macrosBranchCopy';

const BRANCH = 'hit_macros' as const;

const focusOptions: readonly ChoiceOption<MacroFocusId>[] = [
  { id: 'more_protein', label: 'More protein', detail: 'Protein-forward, same meals', icon: Weight },
  { id: 'fewer_calories', label: 'Fewer calories', detail: 'Lighter versions of what you eat', icon: MenuScale },
  { id: 'more_balanced_macros', label: 'More balanced macros', detail: 'The full plate, not one number', icon: Flash },
  { id: 'better_workout_fuel', label: 'Better workout fuel', detail: 'Matched to how you train', icon: Repeat },
  { id: 'maintain', label: 'Maintain where I am', detail: 'Keep what already works', icon: Activity },
  { id: 'not_sure', label: 'I am not sure yet', icon: QuestionMark },
];

const calorieStatusOptions: readonly ChoiceOption<CalorieTrackingStatus>[] = [
  { id: 'yes_has_target', label: 'Yes, I have a target', icon: Hashtag },
  { id: 'sometimes', label: 'Sometimes', icon: ClockRotateRight },
  { id: 'no', label: 'No', icon: QuestionMark },
  { id: 'not_sure', label: 'Not sure', icon: QuestionMark },
];

const barrierOptions: readonly ChoiceOption<MacroBarrierId>[] = [
  { id: 'estimating_portions', label: 'Estimating portions', detail: 'Hard to judge by eye', icon: ScaleFrameReduce },
  { id: 'getting_enough_protein', label: 'Getting enough protein', detail: 'Falls short most days', icon: Weight },
  { id: 'inaccurate_nutrition', label: 'Nutrition numbers I cannot trust', detail: 'Estimates feel off', icon: ChatBubbleQuestion },
  { id: 'doesnt_taste_good', label: 'Food that does not taste good', detail: 'Feels like a trade-off', icon: EmojiQuite },
  { id: 'meal_prep_time', label: 'Meal prep takes too long', detail: 'Not realistic most weeks', icon: Timer },
  { id: 'staying_consistent', label: 'Staying consistent', detail: 'Good days, then it slips', icon: Repeat },
  { id: 'dont_know_targets', label: 'I do not know my targets', icon: QuestionMark },
];

const mealOptions: readonly ChoiceOption<MacrosMealToImproveId>[] = [
  { id: 'breakfast', label: 'Breakfast', icon: SunLight },
  { id: 'lunch', label: 'Lunch', icon: Cutlery },
  { id: 'dinner', label: 'Dinner', icon: PizzaSlice },
  { id: 'snacks', label: 'Snacks', icon: Cookie },
  { id: 'it_varies', label: 'It varies', icon: Repeat },
];

const trackingStyleOptions: readonly ChoiceOption<TrackingStyleId>[] = [
  { id: 'exact_numbers', label: 'Exact numbers', detail: 'Show the precise grams', icon: Hashtag },
  { id: 'flexible_ranges', label: 'Flexible ranges', detail: 'Ballpark is enough', icon: Flash },
  { id: 'simple_suggestions', label: 'Simple suggestions', detail: 'Tell me what to change', icon: LightBulb },
  { id: 'just_show_info', label: 'Just show the information', icon: List },
];

const commitmentOptions: readonly ChoiceOption<MacroCommitmentId>[] = [
  { id: 'few_aligned_meals', label: 'A few meals that hit my targets each week', icon: Cutlery },
  { id: 'most_days', label: 'Stay close most days', icon: SunLight },
  { id: 'ease_in', label: 'I want to ease in gradually', icon: Activity },
  { id: 'not_sure', label: 'I am not sure yet', icon: EmojiQuite },
];

const proteinPreferences: readonly { multiplier: ProteinMultiplier; detail: string; label: string }[] = [
  { multiplier: 1, label: '1.0× body weight', detail: 'A steady starting point' },
  { multiplier: 1.3, label: '1.3× body weight', detail: 'A more protein-focused approach' },
  { multiplier: 1.6, label: '1.6× body weight', detail: 'A higher protein preference' },
];

let macrosStartTracked = false;
let macrosCompletionTracked = false;

export function MacrosBranchScreen({ onBack, onComplete, userName: _userName }: { onBack: () => void; onComplete: () => Promise<void>; userName?: string | null }) {
  const [state, dispatch] = useReducer(macrosReducer, initialMacrosDraft);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const handoffStarted = useRef(false);

  useEffect(() => {
    if (!macrosStartTracked) { macrosStartTracked = true; track(analyticsEvents.ONBOARDING_START, { screen: 'hit_macros_stage2_preview', source: 'development_preview' }); }
    void macrosBranchPersistence.read().then((draft) => { dispatch({ type: 'HYDRATED', draft }); });
  }, []);
  useEffect(() => { if (state.currentStep !== 'intro' || state.branchCompleted) void macrosBranchPersistence.write(state); }, [state]);

  const step = state.currentStep;
  const isComplete = step === 'complete';
  const showProgress = step !== 'intro';
  // Position-based so it advances on Next, retreats on Back, and restores on hydrate.
  const branchProgress = getBranchProgress(MACROS_STEPS, step);

  const canContinue = step === 'intro'
    ? true
    : (step === 'focus' ? state.macroFocus !== null
      : step === 'proteinWeight' ? (state.bodyWeight !== null || state.proteinTargetStatus === 'not_sure')
      : step === 'proteinPreference' ? state.proteinMultiplier !== null
      : step === 'calorieCheck' ? state.calorieTrackingStatus !== null
      : step === 'barrier' ? state.macroBarrier !== null
      : step === 'mealToImprove' ? state.mealToImprove !== null
      : step === 'trackingStyle' ? state.trackingStyle !== null
      : step === 'commitment' ? state.flexibleCommitment !== null
      : true);

  const next = () => {
    if (step === 'reveal') {
      if (!macrosCompletionTracked) { macrosCompletionTracked = true; track(analyticsEvents.ONBOARDING_COMPLETE, { screen: 'hit_macros_stage2_preview', source: 'development_preview' }); }
      dispatch({ type: 'BRANCH_COMPLETED' });
      void macrosBranchPersistence.write({ ...state, branchCompleted: true, currentStep: 'complete' });
      return;
    }
    dispatch({ type: 'NEXT_PRESSED' });
  };
  const done = async () => {
    if (!isComplete || handoffStarted.current) return;
    handoffStarted.current = true;
    setCompletionError(null);
    setIsFinalizing(true);
    try {
      await onComplete();
    } catch {
      handoffStarted.current = false;
      setCompletionError('We couldn’t finish onboarding. Check your connection and try again.');
    } finally {
      setIsFinalizing(false);
    }
  };
  const back = () => { if (step === 'intro') onBack(); else dispatch({ type: 'BACK_PRESSED' }); };

  const barrierCopy = barrierResponse(state.macroBarrier);
  const summaryRows: MacrosSummaryRow[] = useMemo(() => planSummaryRows(state), [state]);

  return <BranchScaffold
    branch={BRANCH}
    contentStyle={styles.branchContent}
    footer={<View style={styles.completionFooter}>
      {completionError ? <Text accessibilityRole="alert" style={styles.completionError}>{completionError}</Text> : null}
      <OnboardingCTA
        accessibilityLabel={isComplete ? (isFinalizing ? 'Finishing onboarding' : 'Finish onboarding and open Okyo') : 'Continue Macros onboarding'}
        disabled={isComplete ? isFinalizing : !canContinue}
        label={isComplete ? (isFinalizing ? 'Finishing…' : 'Done') : 'Next'}
        onPress={isComplete ? () => { void done(); } : next}
        testID="macros-completion-cta"
        tone="pastelPink"
      />
    </View>}
    onBack={back}
    progress={showProgress ? branchProgress : null}
    progressVariant="continuous"
    transitionOrder={MACROS_STEPS}
    transitionStep={step}
  >
    {step === 'intro' ? (
      <HealthMessageScreen
        body="No spreadsheets. No perfect days. Just numbers that fit how you already eat."
        sticker={onboardingV3Assets.macrosIntro}
        title="Let’s make hitting your macros feel less like math."
      />
    ) : null}

    {step === 'focus' ? (
      <HealthQuestionLayout density="dense" sticker={onboardingV3Assets.macrosFocus} subtitle="This points the plan in the right direction. You can change it later." title="What are you focused on right now?">
        <ChoiceRows branch={BRANCH} compact onSelect={(focus) => dispatch({ type: 'FOCUS_SELECTED', focus })} options={focusOptions} selected={state.macroFocus ? [state.macroFocus] : []} />
      </HealthQuestionLayout>
    ) : null}

    {step === 'focusInsight' ? (
      <HealthMessageScreen body={focusInsightBody(state.macroFocus)} footnote="Okyo uses this to shape recipes and suggestions, not to lock you in." sticker={onboardingV3Assets.macrosFocusInsight} title="That points us in the right direction." />
    ) : null}

    {step === 'proteinWeight' ? <BodyWeightStep state={state} dispatch={dispatch} /> : null}

    {step === 'proteinPreference' && state.bodyWeight !== null ? (
      <ProteinPreferenceStep weight={state.bodyWeight} unit={state.bodyWeightUnit} selected={state.proteinMultiplier} onSelect={(multiplier) => dispatch({ type: 'PROTEIN_MULTIPLIER_SELECTED', multiplier })} />
    ) : null}

    {step === 'calorieCheck' ? (
      <HealthQuestionLayout density="dense" sticker={onboardingV3Assets.macrosCalorie} subtitle="Either way is fine. It just changes what Okyo shows you." title="Do you track calories too?">
        <ChoiceRows branch={BRANCH} compact onSelect={(status) => dispatch({ type: 'CALORIE_STATUS_SELECTED', status })} options={calorieStatusOptions} selected={state.calorieTrackingStatus ? [state.calorieTrackingStatus] : []} />
      </HealthQuestionLayout>
    ) : null}

    {step === 'calorieInsight' ? (
      <HealthMessageScreen body={calorieInsightBody(state.calorieTrackingStatus)} sticker={onboardingV3Assets.macrosCalorieInsight} title="Good to know." />
    ) : null}

    {step === 'barrier' ? (
      <HealthQuestionLayout density="dense" sticker={onboardingV3Assets.macrosBarrier} subtitle="We’ll build the plan around this, not ignore it." title="What makes hitting your macros the hardest?">
        <ChoiceRows branch={BRANCH} compact onSelect={(barrier) => dispatch({ type: 'BARRIER_SELECTED', barrier })} options={barrierOptions} selected={state.macroBarrier ? [state.macroBarrier] : []} />
      </HealthQuestionLayout>
    ) : null}

    {step === 'barrierResponse' ? (
      <HealthMessageScreen body={barrierCopy.body} sticker={onboardingV3Assets.macrosBarrierResponse} title={barrierCopy.title} />
    ) : null}

    {step === 'mealToImprove' ? (
      <HealthQuestionLayout sticker={onboardingV3Assets.macrosMeal} subtitle="Let’s start with the one that slips the most." title="Which meal is hardest to keep aligned?">
        <ChipGroup branch={BRANCH} onSelect={(meal) => dispatch({ type: 'MEAL_TO_IMPROVE_SELECTED', meal })} options={mealOptions} selected={state.mealToImprove ? [state.mealToImprove] : []} />
      </HealthQuestionLayout>
    ) : null}

    {step === 'mealInsight' ? (
      <HealthMessageScreen body={mealInsightBody(state.mealToImprove)} footnote="You don’t have to fix every meal at once." sticker={onboardingV3Assets.macrosMealInsight} title="We’ll start there." />
    ) : null}

    {step === 'trackingStyle' ? (
      <HealthQuestionLayout density="dense" sticker={onboardingV3Assets.macrosTracking} subtitle="Okyo will match the amount of detail you want." title="How closely do you want to track?">
        <ChoiceRows branch={BRANCH} compact onSelect={(style) => dispatch({ type: 'TRACKING_STYLE_SELECTED', style })} options={trackingStyleOptions} selected={state.trackingStyle ? [state.trackingStyle] : []} />
      </HealthQuestionLayout>
    ) : null}

    {step === 'reassurance' ? <MacrosNutritionVisual trackingStyle={state.trackingStyle} /> : null}

    {step === 'approach' ? (
      <MacrosApproachScreen headline={approachHeadline(state)} supportText="Your answers shape the recipes, the nutrition detail, and the guidance Okyo gives you." />
    ) : null}

    {step === 'whatOkyoDoes' ? <MacrosWhatOkyoScreen /> : null}

    {step === 'commitment' ? (
      <HealthQuestionLayout density="dense" sticker={onboardingV3Assets.macrosCommitment} subtitle="Pick a starting point—not a perfect streak." title="What feels realistic right now?">
        <ChoiceRows branch={BRANCH} compact onSelect={(commitment) => dispatch({ type: 'COMMITMENT_SELECTED', commitment })} options={commitmentOptions} selected={state.flexibleCommitment ? [state.flexibleCommitment] : []} />
      </HealthQuestionLayout>
    ) : null}

    {step === 'reveal' ? (
      <MacrosRevealScreen proteinLine={proteinPreferenceLine(state)} startingPoint={startingPointValue(state)} summary={revealSummary(state)} />
    ) : null}

    {isComplete ? (
      <MacrosPlanVisual proteinLine={proteinPreferenceLine(state)} rows={summaryRows} startWith={startingPointValue(state, { lowercase: true })} />
    ) : null}
  </BranchScaffold>;
}

function BodyWeightStep({ state, dispatch }: { state: ReturnType<typeof macrosReducer>; dispatch: (event: Parameters<typeof macrosReducer>[1]) => void }) {
  const min = state.bodyWeightUnit === 'lb' ? 50 : 23;
  const max = state.bodyWeightUnit === 'lb' ? 700 : 318;
  const options = useMemo<readonly NumberPickerOption<number>[]>(() => Array.from({ length: max - min + 1 }, (_, index) => ({ value: min + index, label: String(min + index), accessibilityLabel: `${min + index} ${state.bodyWeightUnit}` })), [max, min, state.bodyWeightUnit]);
  const selectedIndex = (state.bodyWeight ?? (state.bodyWeightUnit === 'lb' ? 150 : 68)) - min;
  return <View style={styles.targetScreen}>
    <BranchHeading subtitle="Optional — it helps Okyo set a protein preference." title="What’s your body weight?" />
    <View accessibilityLabel="Body weight unit" accessibilityRole="radiogroup" style={styles.unitToggle}>
      {(['lb', 'kg'] as const).map((unit) => <Pressable accessibilityLabel={`${unit} units`} accessibilityRole="radio" accessibilityState={{ checked: state.bodyWeightUnit === unit, selected: state.bodyWeightUnit === unit }} key={unit} onPress={() => dispatch({ type: 'BODY_WEIGHT_UNIT_SELECTED', unit })} style={[styles.unitButton, state.bodyWeightUnit === unit && styles.unitButtonSelected]}><Text style={[styles.unitLabel, state.bodyWeightUnit === unit && styles.unitLabelSelected]}>{unit}</Text></Pressable>)}
    </View>
    <View style={[styles.weightCard, branchShadow]}><View style={styles.weightPickerWrap}><OnboardingNumberPicker accessibilityLabel={`Body weight in ${state.bodyWeightUnit}`} onChange={(weight) => dispatch({ type: 'BODY_WEIGHT_SAVED', weight, unit: state.bodyWeightUnit })} options={options} selectedIndex={selectedIndex} testID="macros-body-weight-picker" /></View><Text style={styles.weightUnit}>{state.bodyWeightUnit}</Text></View>
    <Text style={styles.helper}>Use a number that feels right for you. This stays in your onboarding draft and is never sent to analytics.</Text>
    <Pressable accessibilityLabel="Skip body weight for now" accessibilityRole="button" accessibilityState={{ disabled: false }} onPress={() => dispatch({ type: 'BODY_WEIGHT_SKIPPED' })} style={styles.skipButton}><Text style={styles.skipLabel}>Skip for now</Text></Pressable>
  </View>;
}

function ProteinPreferenceStep({ weight, unit, selected, onSelect }: { weight: number; unit: BodyWeightUnit; selected: ProteinMultiplier | null; onSelect: (value: ProteinMultiplier) => void }) {
  const options = useMemo<readonly NumberPickerOption<ProteinMultiplier>[]>(() => proteinPreferences.map((option) => ({ value: option.multiplier, label: option.label, accessibilityLabel: option.label })), []);
  const selectedIndex = Math.max(0, proteinPreferences.findIndex((option) => option.multiplier === selected));
  const selectedOption = proteinPreferences[selectedIndex];
  const selectedGrams = calculateProteinPreferenceGrams(weight, unit, selectedOption.multiplier);
  return <View style={styles.targetScreen}>
    <BranchHeading subtitle="This is a preference range, not medical advice." title="How much protein do you want to aim for?" />
    <View accessibilityLabel="Protein preference" style={[styles.proteinPickerCard, branchShadow]}><OnboardingNumberPicker accessibilityLabel="Protein preference multiplier" onChange={onSelect} options={options} selectedIndex={selectedIndex} testID="macros-protein-picker" /><Text style={styles.proteinValue}>{selectedGrams}g/day</Text><Text style={styles.proteinCardDetail}>{selectedOption.detail}</Text></View>
    <Text style={styles.disclaimer}>If you have medical or nutrition concerns, use a target from a qualified professional.</Text>
  </View>;
}

// Retained so the shared reassurance accent stays reachable for future beats.
export { MacrosReassuranceAccent };
export const MACROS_SCREEN_STEPS = MACROS_STEPS;

const styles = StyleSheet.create({
  branchContent: { flexGrow: 1 },
  completionFooter: { gap: 8 },
  completionError: { color: colors.coralDark, fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 18, paddingHorizontal: 8, textAlign: 'center' },
  helper: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  targetScreen: { gap: 14 },
  unitToggle: { alignSelf: 'center', backgroundColor: colors.canvasSunk, borderRadius: 18, flexDirection: 'row', padding: 4 },
  unitButton: { alignItems: 'center', borderRadius: 14, justifyContent: 'center', minHeight: 44, minWidth: 74, paddingHorizontal: 14 },
  unitButtonSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral, borderWidth: 1 },
  unitLabel: { color: colors.muted, fontFamily: fontFamilies.bold, fontSize: 15 },
  unitLabelSelected: { color: colors.coralDark },
  weightCard: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 24, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 220, paddingHorizontal: 18, width: '100%' },
  weightPickerWrap: { flex: 1, minWidth: 0 },
  weightUnit: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 20, marginLeft: 8 },
  skipButton: { alignItems: 'center', alignSelf: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 20 },
  skipLabel: { color: colors.coralDark, fontFamily: fontFamilies.bold, fontSize: 15 },
  proteinPickerCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  proteinCardDetail: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, marginTop: 3, textAlign: 'center' },
  proteinValue: { color: colors.coralDark, fontFamily: fontFamilies.extraBold, fontSize: 17 },
  disclaimer: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
