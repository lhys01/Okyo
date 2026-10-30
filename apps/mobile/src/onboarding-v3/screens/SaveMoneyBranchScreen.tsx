import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Group, Home, LightBulb, ShoppingBag } from 'iconoir-react-native';

import { shouldExitCanonicalPreviewBranch } from '../../onboarding/canonical/navigation';
import { colors, onboardingFontFamilies as fontFamilies, onboardingTitleFont } from '../../theme/okyoTheme';
import { useMascotName } from '../../state/useMascotName';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import { Leaf, stickerIcons } from '../assets/onboardingStickerIcons';
import { BranchHeading } from '../branch-ui/BranchControls';
import { BranchHydrationScreen, BranchScaffold } from '../branch-ui/BranchScaffold';
import { usePersistedBranchTransition } from '../branch-ui/usePersistedBranchTransition';
import {
  HouseholdSegment,
  PotentialSavingsStats,
  SavingsOptionGrid,
  SavingsProjectionChart,
  SavingsValueSlider,
  WeeklySnapshotSummary,
  formatMoney,
  type SavingsTileOption,
} from '../branch-ui/SavingsPlanComponents';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { saveMoneyBranchPersistence } from '../state/saveMoneyBranchPersistence';
import { onboardingV3Log } from '../utils/onboardingV3Log';
import { analyticsEvents, track } from '../../analytics/track';
import { stepsSkippedForVariant, type OnboardingQuestionVariant } from '../state/onboardingQuestionExperiment';
import {
  SAVE_MONEY_STEPS,
  SAVE_MONEY_VISIBLE_STEPS,
  calculateSavingsProjection,
  initialSaveMoneyDraft,
  saveMoneyReducer,
  type FrictionId,
  type HouseholdSize,
  type RecipePriorityId,
} from '../state/saveMoneyBranch';

const BRANCH = 'save_money' as const;
const MAX_WEEKLY_MEALS = 30;
const MAX_MEAL_COST_CENTS = 50_000;

const priorityOptions: readonly SavingsTileOption<RecipePriorityId>[] = [
  { id: 'lower_cost', label: 'Lower cost', icon: stickerIcons.coins },
  { id: 'quick_easy', label: 'Quick and easy', icon: stickerIcons.timer },
  { id: 'familiar_satisfying', label: 'Familiar and satisfying', icon: stickerIcons.flame },
  { id: 'healthier_ingredients', label: 'Healthier ingredients', icon: stickerIcons.leaf },
  { id: 'leftovers', label: 'Good leftovers', icon: stickerIcons.proteinBar },
  { id: 'other', label: 'Other', icon: stickerIcons.chat },
];

const householdOptions: readonly { id: HouseholdSize; label: string }[] = [
  { id: 1, label: '1' }, { id: 2, label: '2' }, { id: 3, label: '3' }, { id: 4, label: '4' }, { id: '5_plus', label: '5+' },
];

const barrierResponse: Readonly<Record<FrictionId, string>> = {
  time: 'We’ll prioritize meals that fit busy days.',
  energy: 'We’ll keep the steps simple and manageable.',
  ideas: 'Okyo will help turn cravings into clear recipes.',
  ingredients: 'We’ll favor recipes that work with what you have.',
  cleanup: 'We’ll prioritize simpler, lower-cleanup meals.',
  other: 'We’ll keep the plan flexible so it can fit the week you actually have.',
};

const priorityLabels: Readonly<Record<RecipePriorityId, string>> = {
  lower_cost: 'Lower cost', quick_easy: 'Quick and easy', familiar_satisfying: 'Familiar and satisfying',
  healthier_ingredients: 'Healthier ingredients', leftovers: 'Good leftovers', other: 'Other',
};
export function SaveMoneyBranchScreen({ onBack, onComplete, variant = 'A' }: { onBack: () => void; onComplete: () => void; variant?: OnboardingQuestionVariant }) {
  const [state, dispatch] = useReducer(saveMoneyReducer, initialSaveMoneyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [completionError, setCompletionError] = useState(false);
  const viewedStep = useRef<string | null>(null);
  const advanceInFlight = useRef(false);
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const { isTransitioning, persistDraft, schedulePersist, transition } = usePersistedBranchTransition({
    draft: state,
    dispatch,
    getStep: (draft) => draft.currentStep,
    hydrated,
    persistence: saveMoneyBranchPersistence,
    reduce: saveMoneyReducer,
  });

  useEffect(() => {
    let cancelled = false;
    track(analyticsEvents.ONBOARDING_EXPERIMENT_STARTED, { experiment_name: 'branch_questions_v1', experiment_variant: variant });
    void saveMoneyBranchPersistence.read().then((draft) => {
      if (cancelled) return;
      // Completed legacy drafts resume at the shared plan handoff.
      const assignedDraft = variant === 'A' || draft.recipePriorities.length > 0 ? draft : { ...draft, recipePriorities: ['lower_cost' as const], recipePriority: 'lower_cost' as const };
      dispatch({ type: 'HYDRATED', draft: assignedDraft.branchCompleted ? { ...assignedDraft, branchCompleted: false, currentStep: 'reveal' } : assignedDraft });
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [variant]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => { schedulePersist(state); }, 220);
    return () => clearTimeout(timer);
  }, [hydrated, schedulePersist, state]);

  useEffect(() => {
    if (!hydrated || viewedStep.current === state.currentStep || state.currentStep === 'complete') return;
    viewedStep.current = state.currentStep;

  }, [hydrated, state.currentStep]);

  const projection = useMemo(() => calculateSavingsProjection({
    weeklyEatingOutCount: state.weeklyEatingOutCount,
    eatingOutCostCents: state.eatingOutCostCents,
    weeklyReplacementTarget: state.weeklyReplacementTarget,
  }), [state.eatingOutCostCents, state.weeklyEatingOutCount, state.weeklyReplacementTarget]);

  const canContinue = state.currentStep === 'intro'
    || state.currentStep === 'weeklySnapshot'
    || state.currentStep === 'projection'
    || (state.currentStep === 'planSetup' && (variant !== 'A' || state.recipePriorities.length > 0) && state.householdSize !== null)
    || state.currentStep === 'reveal'
    || state.currentStep === 'complete';
  const visibleSteps: readonly (typeof SAVE_MONEY_VISIBLE_STEPS)[number][] = variant === 'C'
    ? SAVE_MONEY_VISIBLE_STEPS.filter((step) => step !== 'projection')
    : SAVE_MONEY_VISIBLE_STEPS;
  const visibleIndex = visibleSteps.indexOf(state.currentStep as typeof visibleSteps[number]);
  const progress = state.currentStep === 'intro' || state.currentStep === 'complete' ? null : { answered: Math.max(0, visibleIndex), total: visibleSteps.length };

  const next = () => {
    if (!canContinue || advanceInFlight.current) return;
    const experimentSteps = stepsSkippedForVariant(variant, BRANCH).filter((step): step is typeof SAVE_MONEY_STEPS[number] => SAVE_MONEY_STEPS.includes(step as typeof SAVE_MONEY_STEPS[number]));
    const upcoming = saveMoneyReducer(state, { type: 'NEXT_PRESSED', skipSteps: experimentSteps, omitRecipePriorities: variant !== 'A' });
    if (upcoming.currentStep === 'reveal' || upcoming.currentStep === 'complete') {
      void finish(upcoming);
      return;
    }
    advanceInFlight.current = true;
    void transition({ type: 'NEXT_PRESSED', skipSteps: experimentSteps, omitRecipePriorities: variant !== 'A' }).finally(() => { advanceInFlight.current = false; });
  };
  const back = () => {
    if (shouldExitCanonicalPreviewBranch(state.currentStep, 'intro')) onBack();
    else void transition({ type: 'BACK_PRESSED', skipSteps: stepsSkippedForVariant(variant, BRANCH).filter((step): step is typeof SAVE_MONEY_STEPS[number] => SAVE_MONEY_STEPS.includes(step as typeof SAVE_MONEY_STEPS[number])) });
  };
  const finish = async (draft: typeof state) => {
    if (advanceInFlight.current) return;
    advanceInFlight.current = true;
    setCompletionError(false);
    try {
      const saved = await persistDraft({ ...draft, branchCompleted: false, currentStep: 'reveal' });
      if (!saved) throw new Error('Savings plan could not be saved');
      onboardingV3Log('savings_answers_saved', { stage: 'plan_handoff_ready' });
      track(analyticsEvents.ONBOARDING_EXPERIMENT_BRANCH_COMPLETED, { experiment_name: 'branch_questions_v1', experiment_variant: variant });
      onComplete();
    } catch {
      onboardingV3Log('savings_answers_save_failed', { stage: 'plan_handoff_persist' });
      setCompletionError(true);
    } finally {
      advanceInFlight.current = false;
    }
  };

  useEffect(() => {
    if (hydrated && (state.currentStep === 'reveal' || state.currentStep === 'complete') && !completionError) void finish(state);
  }, [hydrated, state.currentStep]);

  if (!hydrated || ((state.currentStep === 'reveal' || state.currentStep === 'complete') && !completionError)) return <BranchHydrationScreen />;

  return (
    <BranchScaffold
      branch={BRANCH}
      contentStyle={[styles.content, compact && styles.contentCompact]}
      footer={<View style={styles.footer}>
        {completionError ? <Text accessibilityRole="alert">We couldn’t save your plan. Please try again.</Text> : null}
        <OnboardingCTA disabled={!canContinue || isTransitioning} label={state.currentStep === 'intro' ? 'Build my plan' : 'Continue'} onPress={next} tone="pastelPink" />
      </View>}
      ground={colors.canvas}
      onBack={back}
      progress={progress}
      progressVariant="continuous"
      transitionOrder={visibleSteps}
      transitionStep={state.currentStep}
    >
      {state.currentStep === 'intro' ? <IntroScreen compact={compact} /> : null}

      {state.currentStep === 'weeklySnapshot' ? (
        <QuestionScreen title="Let’s get a quick picture of your week." subtitle="You can change these anytime.">
          <View style={styles.sliders}>
            <SavingsValueSlider label="Meals eaten out per week" max={MAX_WEEKLY_MEALS} maxLabel="30 / week" min={0} minLabel="0 / week" onChange={(count) => dispatch({ type: 'FREQUENCY_SAVED', count })} step={1} testID="savings-eating-out-slider" value={state.weeklyEatingOutCount} valueLabel={`${state.weeklyEatingOutCount} / week`} />
            <SavingsValueSlider label="Average cost per meal" max={Math.max(MAX_MEAL_COST_CENTS, state.eatingOutCostCents)} maxLabel={formatMoney(Math.max(MAX_MEAL_COST_CENTS, state.eatingOutCostCents))} min={100} minLabel="$1" onChange={(cents) => dispatch({ type: 'COST_SAVED', cents })} step={100} testID="savings-cost-slider" value={state.eatingOutCostCents} valueLabel={formatMoney(state.eatingOutCostCents)} />
            <SavingsValueSlider label="How many takeout meals would you like to replace?" max={state.weeklyEatingOutCount} maxLabel={`${state.weeklyEatingOutCount} / week`} min={0} minLabel="0 / week" onChange={(target) => dispatch({ type: 'REPLACEMENT_TARGET_SAVED', target })} step={1} testID="savings-replacement-slider" value={state.weeklyReplacementTarget} valueLabel={`${state.weeklyReplacementTarget} / week`} />
          </View>
          <WeeklySnapshotSummary costCents={state.eatingOutCostCents} eatingOut={state.weeklyEatingOutCount} replacement={state.weeklyReplacementTarget} />
        </QuestionScreen>
      ) : null}

      {state.currentStep === 'projection' ? <SavingsProjectionScreen projection={projection} /> : null}

      {state.currentStep === 'planSetup' ? (
        <QuestionScreen title={variant === 'A' ? "What should your recipes prioritize?" : "Who are you cooking for?"} subtitle={variant === 'A' ? "Choose up to two." : "We’ll size recipes around your table."}>
          {variant === 'A' ? <SavingsOptionGrid accessibilityHint={`${state.recipePriorities.length} of 2 selected`} compact={compact} layout="priorityGrid" multi onSelect={(priority) => dispatch({ type: 'PRIORITY_TOGGLED', priority })} options={priorityOptions} selected={state.recipePriorities} /> : null}
          {variant === 'A' && state.recipePriorities.includes('other') ? (
            <ContextualInput
              label="What else should we prioritize?"
              onChangeText={(text) => dispatch({ type: 'PRIORITY_OTHER_TEXT_CHANGED', text })}
              placeholder="Add your recipe priority"
              testID="savings-priority-other-input"
              value={state.recipePriorityOtherText}
            />
          ) : null}
          <View style={styles.householdBlock}>
            <View><Text style={styles.householdTitle}>Cooking for</Text><Text style={styles.householdSubtitle}>We’ll size recipes around your table.</Text></View>
            <HouseholdSegment onSelect={(id) => dispatch({ type: 'HOUSEHOLD_SIZE_SELECTED', size: id })} options={householdOptions} selected={state.householdSize} />
          </View>
        </QuestionScreen>
      ) : null}

    </BranchScaffold>
  );
}

function IntroScreen({ compact }: { compact: boolean }) {
  const mascotName = useMascotName();
  return (
    <View style={styles.intro}>
      <View accessibilityLabel={`${mascotName} ready to help plan home-cooked meals`} accessibilityRole="image" style={[styles.introArt, compact && styles.introArtCompact]}>
        <Image accessibilityIgnoresInvertColors contentFit="contain" source={onboardingV3Assets.saveMoneyIntro} style={styles.introKiko} />
      </View>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.introTitle}>Spend less on takeout without giving up the food you love.</Text>
      <Text maxFontSizeMultiplier={1.35} style={styles.introSupport}>Let’s build a realistic plan around your week.</Text>
    </View>
  );
}

function QuestionScreen({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <View style={styles.question}><BranchHeading subtitle={subtitle} title={title} />{children}</View>;
}

function ContextualInput({ label, placeholder, value, onChangeText, testID }: { label: string; placeholder: string; value: string; onChangeText: (text: string) => void; testID: string }) {
  return (
    <View style={styles.customInputBlock}>
      <Text style={styles.customInputLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="sentences"
        maxLength={120}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        style={styles.customInput}
        testID={testID}
        value={value}
      />
    </View>
  );
}

function CostItem({ color, icon: Icon, label, value }: { color: string; icon: typeof Home; label: string; value: string }) {
  return (
    <View style={[styles.costItem, { backgroundColor: color === colors.savings ? colors.savingsSoft : colors.coralSoft }]}>
      <View style={[styles.costIcon, { backgroundColor: `${color}18` }]}><Icon color={color} height={22} strokeWidth={2} width={22} /></View>
      <View style={styles.costText}><Text style={styles.costLabel}>{label}</Text><Text style={[styles.costValue, { color }]}>{value}</Text></View>
    </View>
  );
}

function SavingsProjectionScreen({ projection }: { projection: ReturnType<typeof calculateSavingsProjection> }) {
  return (
    <View style={styles.projectionScreen}>
      <Text accessibilityRole="header" style={styles.projectionTitle}>Cook a little more.{"\n"}Keep a lot more.</Text>
      <View style={styles.projectionLead}>
        <View style={styles.projectionLeadCopy}>
          <Text style={styles.projectionPrefix}>You could keep about</Text>
          <Text accessibilityLiveRegion="polite" allowFontScaling={false} style={styles.projectionNumber}>{formatMoney(projection.weeklyPotentialSavingsCents)}</Text>
          <Text style={styles.projectionSuffix}>more each week</Text>
        </View>
      </View>
      <View style={styles.costComparison}>
        <CostItem color={colors.coralDark} icon={ShoppingBag} label="Current routine" value={`${formatMoney(projection.currentWeeklyCostCents)} / week`} />
        <CostItem color={colors.savings} icon={Home} label={`With ${projection.replacements} at home`} value={`${formatMoney(projection.projectedWeeklyCostCents)} / week`} />
      </View>
      <SavingsProjectionChart projection={projection} />
    </View>
  );
}

export function SavingsFinalPlan({ state, projection }: { state: typeof initialSaveMoneyDraft; projection: ReturnType<typeof calculateSavingsProjection> }) {
  const mascotName = useMascotName();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.4;
  const priorities = readableList(state.recipePriorities.map((priority) => priority === 'other' && state.recipePriorityOtherText.trim()
    ? state.recipePriorityOtherText.trim()
    : priorityLabels[priority]));
  const household = state.householdSize === '5_plus' ? '5+ people' : `${state.householdSize ?? 1} ${state.householdSize === 1 ? 'person' : 'people'}`;
  return (
    <View style={styles.final}>
      <Text accessibilityRole="header" adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={3} style={styles.finalTitle}>You could keep about {formatMoney(projection.weeklyPotentialSavingsCents)} more each week.</Text>
      {largeText ? <Text accessibilityRole="text" style={styles.largeTextScrollHint}>Scroll for your full plan ↓</Text> : null}
      <Text style={styles.finalEstimateNote}>Potential savings use an estimated {formatMoney(projection.estimatedHomeCostCents)} homemade meal. Actual costs vary.</Text>
      <View style={styles.finalSavingsStage}>
        <View pointerEvents="none" style={styles.finalLeafLeft}><Leaf height={42} width={42} /></View>
        <View pointerEvents="none" style={styles.finalLeafRight}><Leaf height={42} width={42} /></View>
        <View style={styles.finalSavingsOrb}>
          <Text style={styles.finalOrbLabel}>SAVE</Text>
          <Text accessibilityLiveRegion="polite" adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={1} style={styles.finalOrbValue}>{formatMoney(projection.weeklyPotentialSavingsCents)}</Text>
          <Text style={styles.finalOrbSuffix}>per week</Text>
        </View>
        <Image accessibilityLabel={`${mascotName} celebrating the plan`} accessibilityIgnoresInvertColors accessibilityRole="image" contentFit="contain" source={onboardingV3Assets.saveMoneyReassuranceKiko} style={styles.finalKiko} />
      </View>
      <PotentialSavingsStats largeText={largeText} projection={projection} />
      <View style={[styles.finalDetails, largeText && styles.finalDetailsStack]}>
        <View style={[styles.finalDetailColumn, largeText && styles.finalDetailColumnStack]}><DetailRow icon={Group} label="Cooking for" value={household} /></View>
        <View style={[styles.finalDetailDivider, largeText && styles.finalDetailDividerStack]} />
        <View style={[styles.finalDetailColumn, largeText && styles.finalDetailColumnStack]}><DetailRow icon={LightBulb} label="Recipe priorities" value={priorities} /></View>
      </View>
      <View style={styles.finalMessage}>
        <Text style={styles.finalMessageText}>{barrierResponse[state.orderingFriction ?? 'other']}</Text>
      </View>
    </View>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) {
  return <View style={styles.detailRow}><View style={styles.detailIcon}><Icon color={colors.savings} height={20} strokeWidth={2} width={20} /></View><View style={styles.detailCopy}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View></View>;
}

function readableList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? 'meals that fit your week';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

const styles = StyleSheet.create({
  footer: { gap: 6 },
  content: { flexGrow: 1, paddingBottom: 8 },
  contentCompact: { paddingTop: 6 },
  question: { flexGrow: 1, gap: 8, width: '100%' },
  intro: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingBottom: 16 },
  introArt: { height: 300, marginBottom: 16, position: 'relative', width: '100%' },
  introArtCompact: { height: 242, marginBottom: 8 },
  introKiko: { bottom: 4, left: '16%', position: 'absolute', right: '16%', top: 4 },
  introTitle: { ...onboardingTitleFont, color: colors.ink, fontSize: 30, letterSpacing: -0.7, lineHeight: 36, textAlign: 'center' },
  introSupport: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 23, marginTop: 12, textAlign: 'center' },
  sliders: { gap: 13 },
  customInputBlock: { gap: 7 },
  customInputLabel: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 14, lineHeight: 19 },
  customInput: { backgroundColor: colors.surface, borderColor: colors.coral, borderRadius: 16, borderWidth: 1.5, color: colors.ink, fontFamily: fontFamilies.body, fontSize: 15, minHeight: 48, paddingHorizontal: 14, paddingVertical: 11 },

  projectionScreen: { gap: 13, paddingTop: 4, width: '100%' },
  projectionTitle: { ...onboardingTitleFont, alignSelf: 'center', color: colors.ink, fontSize: 28, letterSpacing: -0.7, lineHeight: 32, maxWidth: '100%', textAlign: 'center' },
  projectionLead: { alignItems: 'center', backgroundColor: colors.savingsSoft, borderRadius: 22, minHeight: 148, paddingHorizontal: 18, paddingVertical: 17 },
  projectionLeadCopy: { alignItems: 'center', flex: 1 },
  projectionPrefix: { color: colors.savings, fontFamily: fontFamilies.bold, fontSize: 15, lineHeight: 21 },
  projectionNumber: { color: colors.savings, fontFamily: fontFamilies.extraBold, fontSize: 50, letterSpacing: -1.5, lineHeight: 55, marginVertical: 1 },
  projectionSuffix: { color: colors.savings, fontFamily: fontFamilies.bold, fontSize: 16, lineHeight: 21 },
  costComparison: { flexDirection: 'row', gap: 8 },
  costItem: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 8, minWidth: 0, padding: 10 },
  costIcon: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  costText: { flex: 1, minWidth: 0 },
  costLabel: { color: colors.body, fontFamily: fontFamilies.medium, fontSize: 10, lineHeight: 14 },
  costValue: { fontFamily: fontFamilies.extraBold, fontSize: 14, lineHeight: 19 },

  householdBlock: { gap: 10, marginTop: 4 },
  householdTitle: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 23 },
  householdSubtitle: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18, marginTop: 2 },

  final: { alignItems: 'center', gap: 10, paddingTop: 2, width: '100%' },
  finalTitle: { ...onboardingTitleFont, color: colors.ink, fontSize: 28, letterSpacing: -0.7, lineHeight: 32, textAlign: 'left', width: '100%' },
  largeTextScrollHint: { alignSelf: 'stretch', color: colors.body, fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  finalSavingsStage: { alignItems: 'center', minHeight: 238, justifyContent: 'center', position: 'relative', width: '100%' },
  finalSavingsOrb: { alignItems: 'center', backgroundColor: '#E2F8EA', borderRadius: 116, justifyContent: 'center', minHeight: 228, paddingHorizontal: 18, paddingVertical: 20, width: 228 },
  finalOrbLabel: { color: colors.savings, fontFamily: fontFamilies.bold, fontSize: 16, letterSpacing: 0.8, lineHeight: 21 },
  finalEstimateNote: { color: colors.body, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19 },
  finalOrbValue: { color: '#147D4B', fontFamily: fontFamilies.extraBold, fontSize: 56, letterSpacing: -1.9, lineHeight: 62, textAlign: 'center', width: '100%' },
  finalOrbSuffix: { color: '#147D4B', fontFamily: fontFamilies.bold, fontSize: 19, lineHeight: 25 },
  finalLeafLeft: { left: 4, position: 'absolute', top: 118 },
  finalLeafRight: { position: 'absolute', right: 4, top: 92, transform: [{ scaleX: -1 }] },
  finalKiko: { bottom: 2, height: 58, opacity: 0.94, position: 'absolute', right: 26, width: 58 },
  finalDetails: { alignItems: 'stretch', alignSelf: 'stretch', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', minWidth: 0, overflow: 'hidden', width: '100%' },
  finalDetailsStack: { flexDirection: 'column' },
  finalDetailColumn: { flex: 1, minWidth: 0 },
  finalDetailColumnStack: { flex: 0, width: '100%' },
  finalDetailDivider: { backgroundColor: colors.border, width: StyleSheet.hairlineWidth },
  finalDetailDividerStack: { height: StyleSheet.hairlineWidth, width: undefined },
  detailRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 68, paddingHorizontal: 10, paddingVertical: 9 },
  detailIcon: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  detailCopy: { flex: 1 },
  detailLabel: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 10, lineHeight: 14 },
  detailValue: { color: colors.ink, fontFamily: fontFamilies.bold, fontSize: 13, lineHeight: 18 },
  finalMessage: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.coralSoft, borderRadius: 20, flexDirection: 'row', gap: 10, minHeight: 56, paddingHorizontal: 16 },
  finalMessageText: { color: colors.body, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 18 },
  barrierCard: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 20, flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  barrierText: { color: colors.body, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 18 },
});

export const SAVE_MONEY_SCREEN_STEPS = SAVE_MONEY_VISIBLE_STEPS;
export const SAVE_MONEY_BARRIER_COPY = barrierResponse;
