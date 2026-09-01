import { useEffect, useMemo, useReducer, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import {
  Bed, Coins, Community, Cookie, Cutlery, Dishwasher, EmojiSatisfied, Flash, Group, Heart,
  Home, HouseRooms, Leaf, LightBulb, Package, PizzaSlice, ShoppingBag, Shuffle, Sparks, SunLight,
  Timer, User, UserLove,
} from 'iconoir-react-native';

import { colors } from '../../theme/okyoTheme';
import { analyticsEvents, track } from '../../analytics/track';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { BranchScaffold } from '../branch-ui/BranchScaffold';
import { BranchHeading, CountStepper, MoneyField, type ChoiceOption } from '../branch-ui/BranchControls';
import { SpendProjection, StatTile, formatDollars } from '../branch-ui/BranchCharts';
import { branchPalettes } from '../branch-ui/branchTheme';
import { getBranchProgress } from '../branch-ui/branchProgress';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import {
  AnswerCardStack, CelebrateKikoArt, FrictionSceneRows, FrictionTransition, HouseholdCardGrid, MealTypeChoiceTiles, OrderSceneIntro,
  RankedPriorityCards, ReceiptCostCard, SaveMoneyReassurance, SavingsRevealHero, SavingsRevealReport,
  type AnswerCard, type HouseholdOption,
} from '../branch-ui/SaveMoneyVisuals';
import { saveMoneyBranchPersistence } from '../state/saveMoneyBranchPersistence';
import {
  calculateEatingOutSpend,
  initialSaveMoneyDraft,
  saveMoneyReducer,
  type FrictionId,
  type HouseholdSize,
  type MealTypeId,
  type RecipePriorityId,
  type SaveMoneyStep,
} from '../state/saveMoneyBranch';

const BRANCH = 'save_money' as const;
const palette = branchPalettes[BRANCH];

const STEPS: SaveMoneyStep[] = ['intro', 'frequency', 'cost', 'spendingGraph', 'friction', 'encouragement', 'mealType', 'replacementTarget', 'recipePriority', 'reassurance', 'householdSize', 'reveal', 'complete'];

const MAX_WEEKLY_MEALS = 21;

// Okyo has no way to know a real make-at-home cost before the first scan, so
// the comparison uses an openly illustrative per-meal figure and says so. The
// real number always comes from an actual recipe.
const ILLUSTRATIVE_HOME_MEAL_COST_CENTS = 600;

const frictionOptions: readonly ChoiceOption<FrictionId>[] = [
  { id: 'time', label: 'I’m short on time', icon: Timer },
  { id: 'energy', label: 'I’m too tired to cook', icon: Bed },
  { id: 'ideas', label: 'I don’t know what to make', icon: LightBulb },
  { id: 'ingredients', label: 'I’m missing ingredients', icon: ShoppingBag },
  { id: 'cravings', label: 'I want something specific', icon: Heart },
  { id: 'cleanup', label: 'Cleaning feels like too much', icon: Dishwasher },
  { id: 'other', label: 'Something else', icon: Sparks },
];

const mealOptions: readonly ChoiceOption<MealTypeId>[] = [
  { id: 'breakfast', label: 'Breakfast', icon: SunLight },
  { id: 'lunch', label: 'Lunch', icon: Cutlery },
  { id: 'dinner', label: 'Dinner', icon: PizzaSlice },
  { id: 'snacks', label: 'Snacks', icon: Cookie },
  { id: 'varies', label: 'It varies', icon: Shuffle },
];

const priorityOptions: readonly ChoiceOption<RecipePriorityId>[] = [
  { id: 'lowest_cost', label: 'Lowest cost', icon: Coins },
  { id: 'same_taste', label: 'Same satisfying taste', icon: EmojiSatisfied },
  { id: 'fast_easy', label: 'Fast and easy', icon: Flash },
  { id: 'healthier_ingredients', label: 'Healthier ingredients', icon: Leaf },
  { id: 'leftovers', label: 'Good leftovers', icon: Package },
];

const householdOptions: readonly HouseholdOption[] = [
  { id: '1', label: 'Just me', icon: User },
  { id: '2', label: '2 people', icon: UserLove },
  { id: '3', label: '3 people', icon: Group },
  { id: '4', label: '4 people', icon: Community },
  { id: '5_plus', label: '5+ people', icon: HouseRooms },
];

const encouragementCopy: Readonly<Record<FrictionId, string>> = {
  time: 'When time is tight, ordering is the realistic option.',
  energy: 'Cooking is a different job when you’re already spent.',
  ideas: 'Deciding is the work. We’ll do that part.',
  ingredients: 'One missing thing shouldn’t end the meal.',
  cravings: 'Spending less shouldn’t mean giving up the craving.',
  cleanup: 'A recipe isn’t easy if it wrecks the kitchen.',
  other: 'Everyone has days when cooking is too much.',
};

let saveMoneyStartTracked = false;
let saveMoneyCompletionTracked = false;

export function SaveMoneyBranchScreen({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [state, dispatch] = useReducer(saveMoneyReducer, initialSaveMoneyDraft);
  const [costText, setCostText] = useState('');

  useEffect(() => {
    if (!saveMoneyStartTracked) {
      saveMoneyStartTracked = true;
      track(analyticsEvents.ONBOARDING_START, { screen: 'save_money_stage2_preview', source: 'development_preview' });
    }
    void saveMoneyBranchPersistence.read().then((draft) => {
      dispatch({ type: 'HYDRATED', draft });
      if (draft.eatingOutCostCents !== null) setCostText(String(draft.eatingOutCostCents / 100));
    });
  }, []);

  useEffect(() => {
    if (state.currentStep !== 'intro' || state.branchCompleted) void saveMoneyBranchPersistence.write(state);
  }, [state]);

  const step = state.currentStep;
  const isComplete = step === 'complete';

  const spend = state.weeklyEatingOutCount !== null && state.eatingOutCostCents !== null
    ? calculateEatingOutSpend(state.weeklyEatingOutCount, state.eatingOutCostCents)
    : null;

  // Progress reflects the user's position in the route, so it advances on Next,
  // retreats on Back, and restores correctly on hydrate — it is never derived
  // from how many answers happen to be in the draft.
  const branchProgress = getBranchProgress(STEPS, step);
  const showProgress = step !== 'intro';

  const canContinue = step === 'intro'
    || (step === 'frequency' && state.weeklyEatingOutCount !== null)
    || (step === 'cost' && state.eatingOutCostCents !== null)
    || step === 'spendingGraph'
    || (step === 'friction' && state.orderingFriction !== null)
    || step === 'encouragement'
    || (step === 'mealType' && state.mealTypesToReplace.length > 0)
    || (step === 'replacementTarget' && state.weeklyReplacementTarget !== null)
    || (step === 'recipePriority' && state.recipePriority !== null)
    || step === 'reassurance'
    || (step === 'householdSize' && state.householdSize !== null)
    || step === 'reveal';

  const next = () => {
    if (step === 'complete') return;
    if (step === 'reveal') {
      if (!saveMoneyCompletionTracked) {
        saveMoneyCompletionTracked = true;
        track(analyticsEvents.ONBOARDING_COMPLETE, { screen: 'save_money_stage2_preview', source: 'development_preview' });
      }
      dispatch({ type: 'BRANCH_COMPLETED' });
    } else {
      dispatch({ type: 'NEXT_PRESSED' });
    }
  };

  const back = () => {
    if (step === 'intro') onBack();
    else dispatch({ type: 'BACK_PRESSED' });
  };

  const completePreview = () => {
    if (isComplete) onComplete();
  };

  const selectedFriction = frictionOptions.find((option) => option.id === state.orderingFriction);
  const summaryItems = useSummaryItems(state);

  return (
    <BranchScaffold
      branch={BRANCH}
      contentStyle={!isMoment(step) && step !== 'spendingGraph' ? styles.questionContent : undefined}
      footer={
        <OnboardingCTA
          disabled={isComplete ? false : !canContinue}
          label={step === 'intro' ? 'Let’s do it' : isComplete ? 'Done' : step === 'reassurance' ? 'Let’s go!' : step === 'encouragement' ? 'Let’s go' : 'Next'}
          onPress={isComplete ? completePreview : next}
          tone="pastelPink"
        />
      }
      ground={step === 'intro' ? colors.background : step === 'encouragement' || step === 'reassurance' ? colors.canvas : isMoment(step) ? palette.ground : undefined}
      onBack={back}
      progress={showProgress ? branchProgress : null}
      progressVariant="continuous"
      transitionOrder={STEPS}
      transitionStep={step}
    >
      {step === 'intro' ? (
        <OrderSceneIntro
          headline="Spend less without giving up the food you love"
          support=""
        />
      ) : null}

      {step === 'frequency' ? (
        <>
          <QuestionHead art={onboardingV3Assets.saveMoneyFrequency} artLabel="Kiko checking a weekly checklist" title="How often do you eat out each week?" />
          <CountStepper
            branch={BRANCH}
            max={MAX_WEEKLY_MEALS}
            min={0}
            onChange={(count) => dispatch({ type: 'FREQUENCY_SAVED', count })}
            unitLabel="meals a week"
            value={state.weeklyEatingOutCount}
          />
        </>
      ) : null}

      {step === 'cost' ? (
        <>
          <QuestionHead art={onboardingV3Assets.saveMoneyCost} artLabel="Kiko thinking about the cost of a meal" title="What does one of those meals usually cost?" />
          <ReceiptCostCard>
            <MoneyField
              accessibilityLabel="Eating out cost"
              onChangeText={(value) => {
                setCostText(value);
                const cents = Math.round(Number(value) * 100);
                if (Number.isFinite(cents)) dispatch({ type: 'COST_SAVED', cents });
              }}
              value={costText}
            />
          </ReceiptCostCard>
          {spend ? (
            <View style={styles.liveRow}>
              <StatTile branch={BRANCH} label="Eating out, weekly" value={formatDollars(spend.weeklySpendCents)} />
              <StatTile branch={BRANCH} label="Eating out, monthly" value={formatDollars(spend.monthlySpendCents)} />
            </View>
          ) : null}
        </>
      ) : null}

      {step === 'spendingGraph' ? (
        <View style={styles.spendingGraphFill}>
          <BranchHeading title="Your projection" />
          <View style={[styles.forecastFrame, { borderColor: palette.accentSoft }]}>
            <SpendProjection
              annualCents={spend?.annualSpendCents ?? 0}
              branch={BRANCH}
              horizons={[
                { id: 'week', label: 'Week', cents: spend?.weeklySpendCents ?? 0 },
                { id: 'month', label: 'Month', cents: spend?.monthlySpendCents ?? 0 },
                { id: 'year', label: 'Year', cents: spend?.annualSpendCents ?? 0 },
              ]}
            />
          </View>
        </View>
      ) : null}

      {step === 'friction' ? (
        <>
          <QuestionHead art={onboardingV3Assets.saveMoneyFriction} artLabel="Kiko thinking about what makes cooking easier" title="What makes eating out easier than cooking?" />
          <FrictionSceneRows
            onSelect={(friction) => dispatch({ type: 'FRICTION_SELECTED', friction })}
            options={frictionOptions}
            selected={state.orderingFriction ? [state.orderingFriction] : []}
          />
        </>
      ) : null}

      {step === 'encouragement' ? (
        <FrictionTransition
          frictionIcon={selectedFriction?.icon ?? Sparks}
          frictionLabel={selectedFriction?.label ?? 'Eating out'}
          headline={encouragementCopy[state.orderingFriction ?? 'other']}
        />
      ) : null}

      {step === 'mealType' ? (
        <>
          <QuestionHead title="Which meals would you most like to replace?" />
          <MealTypeChoiceTiles
            onSelect={(mealType) => dispatch({ type: 'MEAL_TYPE_TOGGLED', mealType })}
            options={mealOptions}
            selected={state.mealTypesToReplace}
          />
        </>
      ) : null}

      {step === 'replacementTarget' ? (
        <>
          <QuestionHead art={onboardingV3Assets.saveMoneyReplacement} artLabel="Kiko planning a cooking routine" title="How many would you realistically cook instead?" />
          <CountStepper
            branch={BRANCH}
            max={state.weeklyEatingOutCount ?? 0}
            min={0}
            onChange={(target) => dispatch({ type: 'REPLACEMENT_TARGET_SAVED', target })}
            unitLabel="meals a week"
            value={state.weeklyReplacementTarget}
          />
        </>
      ) : null}

      {step === 'recipePriority' ? (
        <>
          <QuestionHead art={onboardingV3Assets.saveMoneyPriority} artLabel="Kiko cooking with a laptop" title="What matters most when you pick what to cook?" />
          <RankedPriorityCards
            onSelect={(priority) => dispatch({ type: 'PRIORITY_SELECTED', priority })}
            options={priorityOptions}
            selected={state.recipePriority ? [state.recipePriority] : []}
          />
        </>
      ) : null}

      {step === 'reassurance' ? (
        <SaveMoneyReassurance />
      ) : null}

      {step === 'householdSize' ? (
        <>
          <QuestionHead art={onboardingV3Assets.saveMoneyHousehold} artLabel="Kiko serving a bowl" title="How many people are you cooking for?" />
          <HouseholdCardGrid
            onSelect={(id) => dispatch({ type: 'HOUSEHOLD_SIZE_SELECTED', size: (id === '5_plus' ? '5_plus' : Number(id)) as HouseholdSize })}
            options={householdOptions}
            selected={state.householdSize === null ? [] : [String(state.householdSize)]}
          />
        </>
      ) : null}

      {step === 'reveal' ? <SavingsReveal state={state} /> : null}

      {isComplete ? (
        <>
          <CelebrateKikoArt />
          <BranchHeading title="Your savings plan is ready" />
          <AnswerCardStack items={summaryItems} />
        </>
      ) : null}
    </BranchScaffold>
  );
}

/**
 * The payoff screen: the same meals priced two ways, with the arithmetic behind
 * the number stated out loud and nothing presented as money already saved.
 */
function SavingsReveal({ state }: { state: ReturnType<typeof saveMoneyReducer> }) {
  const replaced = state.weeklyReplacementTarget ?? 0;
  const eatingOutWeeklyCents = replaced * (state.eatingOutCostCents ?? 0);
  const homeWeeklyCents = replaced * ILLUSTRATIVE_HOME_MEAL_COST_CENTS;
  const differenceWeeklyCents = Math.max(0, eatingOutWeeklyCents - homeWeeklyCents);
  const differenceAnnualCents = differenceWeeklyCents * 52;

  return (
    <View style={styles.revealStack}>
      <SavingsRevealHero weeklyDifference={formatDollars(differenceWeeklyCents)} />
      <SavingsRevealReport
        annualDifference={formatDollars(differenceAnnualCents)}
        eatingOutWeekly={formatDollars(eatingOutWeeklyCents)}
        homeWeekly={formatDollars(homeWeeklyCents)}
        monthlyDifference={formatDollars(Math.round(differenceAnnualCents / 12))}
      />
    </View>
  );
}

function useSummaryItems(state: ReturnType<typeof saveMoneyReducer>): AnswerCard[] {
  return useMemo(() => {
    const items: AnswerCard[] = [];
    if (state.weeklyReplacementTarget !== null) {
      items.push({ id: 'target', label: 'Meals moving home', value: `${state.weeklyReplacementTarget} a week`, icon: Home });
    }
    const meals = state.mealTypesToReplace
      .map((id) => mealOptions.find((option) => option.id === id)?.label)
      .filter((label): label is string => Boolean(label));
    if (meals.length) items.push({ id: 'meals', label: 'Starting with', value: meals.join(', '), icon: Cutlery });
    const priority = priorityOptions.find((option) => option.id === state.recipePriority);
    if (priority) items.push({ id: 'priority', label: 'Recipes tuned for', value: priority.label, icon: priority.icon });
    const household = householdOptions.find((option) => option.id === String(state.householdSize));
    if (household) items.push({ id: 'household', label: 'Cooking for', value: household.label, icon: Group });
    return items;
  }, [state]);
}

/** Interstitial beats use the tinted ground; question screens stay on canvas. */
function isMoment(step: SaveMoneyStep): boolean {
  return step === 'intro' || step === 'encouragement' || step === 'reassurance' || step === 'complete';
}

/**
 * Question header: the supporting Kiko art sits to the left of the question on
 * the same axis when the screen is wide enough, and stacks above it on narrow
 * phones where a row would crowd the text. The art never sits over the options,
 * progress bar, or CTA.
 */
function QuestionHead({ title, art, artLabel }: { title: string; art?: number; artLabel?: string }) {
  const { width } = useWindowDimensions();
  const sideBySide = art !== undefined && width >= 380;
  return (
    <View style={[styles.qHead, sideBySide ? styles.qHeadRow : styles.qHeadColumn]}>
      {art !== undefined ? (
        <Image
          accessibilityLabel={artLabel}
          accessibilityRole="image"
          contentFit="contain"
          source={art}
          style={sideBySide ? styles.qHeadArtSide : styles.qHeadArtTop}
        />
      ) : null}
      <View style={styles.qHeadText}>
        <BranchHeading title={title} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // flex-start keeps the header + options together at the top; the old
  // space-between pushed the art into a large dead gap in the middle.
  questionContent: { flexGrow: 1, gap: 18, justifyContent: 'flex-start' },
  qHead: { width: '100%' },
  qHeadRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  qHeadColumn: { alignItems: 'flex-start', gap: 8 },
  qHeadText: { flex: 1 },
  qHeadArtSide: { height: 96, width: 96 },
  qHeadArtTop: { alignSelf: 'center', height: 104, width: 104 },
  // Fills the scroll area intentionally instead of leaving dead space below
  // the chart card, without forcing the card itself to stretch or crowd.
  spendingGraphFill: { flexGrow: 1, gap: 14, justifyContent: 'center' },
  forecastFrame: { borderRadius: 28, borderWidth: 1, padding: 6 },
  liveRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  revealStack: { gap: 14 },
});

export const SAVE_MONEY_SCREEN_STEPS = STEPS;
