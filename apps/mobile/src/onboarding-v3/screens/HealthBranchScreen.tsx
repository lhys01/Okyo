import { useEffect, useMemo, useReducer } from 'react';
import { StyleSheet } from 'react-native';
import {
  Activity, Apple, BreadSlice, Coins, Cookie, Cutlery, EmojiQuite, FireFlame, Fish, LightBulb,
  MenuScale, PizzaSlice, Repeat, ScaleFrameReduce, ShoppingBag, Shuffle, Sparks, SunLight, Timer,
} from 'iconoir-react-native';

import { analyticsEvents, track } from '../../analytics/track';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { BranchScaffold } from '../branch-ui/BranchScaffold';
import { getBranchProgress } from '../branch-ui/branchProgress';
import { ChoiceRows, ChoiceTiles, ChipGroup, type ChoiceOption } from '../branch-ui/BranchControls';
import { onboardingV3Assets } from '../assets/onboardingV3Assets';
import {
  HealthApproachScreen,
  HealthMessageScreen,
  HealthPlanSummary,
  HealthNutritionExample,
  HealthQuestionLayout,
  HealthReassuranceAccent,
  HealthRevealScreen,
  HealthWhatOkyoScreen,
  type HealthSummaryRow,
} from './HealthVisuals';
import { healthBranchPersistence } from '../state/healthBranchPersistence';
import {
  HEALTH_STEPS,
  healthReducer,
  initialHealthDraft,
  type HealthBarrierId,
  type HealthCommitmentId,
  type HealthDefinitionId,
  type HealthStep,
  type FoodStyleId,
  type MealToImproveId,
} from '../state/healthBranch';
import {
  approachHeadline,
  barrierResponse,
  meaningInsightBody,
  mealInsightBody,
  planSummaryRows,
  revealSummary,
  startingPointValue,
} from '../state/healthBranchCopy';

const BRANCH = 'eat_healthier' as const;

const definitionOptions: readonly ChoiceOption<HealthDefinitionId>[] = [
  { id: 'more_balanced_meals', label: 'More balanced meals', icon: MenuScale },
  { id: 'more_whole_foods', label: 'More whole foods', icon: Apple },
  { id: 'more_vegetables_fruit', label: 'More vegetables and fruit', icon: BreadSlice },
  { id: 'more_energy', label: 'More energy', icon: Activity },
  { id: 'better_portions', label: 'Better portions', icon: ScaleFrameReduce },
  { id: 'less_takeout', label: 'Less takeout', icon: ShoppingBag },
  { id: 'something_else', label: 'Something else', icon: Sparks },
];

const barrierOptions: readonly ChoiceOption<HealthBarrierId>[] = [
  { id: 'not_enough_time', label: 'I do not have enough time', icon: Timer },
  { id: 'too_expensive', label: 'Healthy food feels too expensive', icon: Coins },
  { id: 'dont_know_what_to_cook', label: 'I do not know what to cook', icon: LightBulb },
  { id: 'feels_boring', label: 'Healthy meals feel boring', icon: EmojiQuite },
  { id: 'struggle_consistency', label: 'I struggle to stay consistent', icon: Repeat },
  { id: 'too_hungry_tired', label: 'I am usually too hungry or tired', icon: FireFlame },
  { id: 'something_else', label: 'Something else', icon: Sparks },
];

const mealOptions: readonly ChoiceOption<MealToImproveId>[] = [
  { id: 'breakfast', label: 'Breakfast', icon: SunLight },
  { id: 'lunch', label: 'Lunch', icon: Cutlery },
  { id: 'dinner', label: 'Dinner', icon: PizzaSlice },
  { id: 'snacks', label: 'Snacks', icon: Cookie },
  { id: 'it_varies', label: 'It varies', icon: Shuffle },
];

const foodStyleOptions: readonly ChoiceOption<FoodStyleId>[] = [
  { id: 'comfort_food', label: 'Comfort food', icon: PizzaSlice },
  { id: 'fresh_colorful', label: 'Fresh and colorful', icon: Apple },
  { id: 'high_protein', label: 'High-protein meals', icon: Fish },
  { id: 'quick_simple', label: 'Quick and simple', icon: Timer },
  { id: 'international', label: 'International flavors', icon: FireFlame },
  { id: 'a_bit_of_everything', label: 'A little bit of everything', icon: Sparks },
];

const commitmentOptions: readonly ChoiceOption<HealthCommitmentId>[] = [
  { id: 'few_meals_weekly', label: 'A few healthier meals each week', icon: Cutlery },
  { id: 'small_changes_daily', label: 'Small changes most days', icon: SunLight },
  { id: 'improve_gradually', label: 'I want to improve gradually', icon: Activity },
  { id: 'not_sure', label: 'I am not sure yet', icon: EmojiQuite },
];

let healthStartTracked = false;
let healthCompletionTracked = false;

export function HealthBranchScreen({ onBack, onComplete, userName = '' }: { onBack: () => void; onComplete?: () => void | Promise<void>; userName?: string }) {
  const [state, dispatch] = useReducer(healthReducer, initialHealthDraft);

  useEffect(() => {
    if (!healthStartTracked) {
      healthStartTracked = true;
      track(analyticsEvents.ONBOARDING_START, { screen: 'eat_healthier_stage2_preview', source: 'development_preview' });
    }
    void healthBranchPersistence.read().then((draft) => {
      dispatch({ type: 'HYDRATED', draft });
    });
  }, []);

  useEffect(() => {
    if (state.currentStep !== 'intro' || state.branchCompleted) void healthBranchPersistence.write(state);
  }, [state]);

  const step = state.currentStep;
  const isComplete = step === 'complete';

  // One continuous bar for the whole branch, including the final plan summary.
  // Position-based so it advances on Next, retreats on Back, and restores on hydrate.
  const branchProgress = getBranchProgress(HEALTH_STEPS, step);
  const showProgress = step !== 'intro';

  const canContinue = step === 'intro'
    ? true
    : isComplete
      || (step === 'meaning' ? state.healthDefinition !== null
        : step === 'barrier' ? state.healthBarrier !== null
        : step === 'mealToImprove' ? state.mealToImprove !== null
        : step === 'foodStyle' ? state.foodStyles.length > 0
        : step === 'commitment' ? state.flexibleCommitment !== null
        : true);

  const next = () => {
    if (step === 'complete') return;
    if (step === 'reveal') {
      if (!healthCompletionTracked) {
        healthCompletionTracked = true;
        track(analyticsEvents.ONBOARDING_COMPLETE, { screen: 'eat_healthier_stage2_preview', source: 'development_preview' });
      }
      dispatch({ type: 'BRANCH_COMPLETED' });
    } else {
      dispatch({ type: 'NEXT_PRESSED' });
    }
  };

  const completePreview = () => {
    dispatch({ type: 'BRANCH_COMPLETED' });
    if (onComplete) void onComplete();
  };

  const back = () => {
    if (step === 'intro') onBack();
    else dispatch({ type: 'BACK_PRESSED' });
  };

  const barrierCopy = barrierResponse(state.healthBarrier);
  const summaryRows: HealthSummaryRow[] = useMemo(() => planSummaryRows(state), [state]);

  return (
    <BranchScaffold
      branch={BRANCH}
      footer={<OnboardingCTA disabled={!isComplete && !canContinue} label={isComplete ? 'Done' : 'Continue'} onPress={isComplete ? completePreview : next} tone="pastelPink" />}
      onBack={back}
      progress={showProgress ? branchProgress : null}
      progressVariant="continuous"
      transitionOrder={HEALTH_STEPS}
      transitionStep={step}
      contentStyle={styles.branchContent}
    >
      {step === 'intro' ? (
        <HealthMessageScreen
          accent="heart"
          body="No strict rules. No perfect meals. Just small changes that fit the way you already eat."
          sticker={onboardingV3Assets.healthIntro}
          title="Let’s make eating healthier feel easier."
        />
      ) : null}

      {step === 'meaning' ? (
        <HealthQuestionLayout
          density="dense"
          sticker={onboardingV3Assets.healthMeaning}
          subtitle="There’s no wrong answer. Choose what would make the biggest difference for you."
          title="What would eating healthier mean to you?"
        >
          <ChoiceRows
            branch={BRANCH}
            compact
            onSelect={(definition) => dispatch({ type: 'DEFINITION_SELECTED', definition })}
            options={definitionOptions}
            selected={state.healthDefinition ? [state.healthDefinition] : []}
          />
        </HealthQuestionLayout>
      ) : null}

      {step === 'meaningInsight' ? (
        <HealthMessageScreen
          body={meaningInsightBody(state.healthDefinition)}
          footnote="Okyo will use this preference to make your recipes more useful and realistic."
          sticker={onboardingV3Assets.healthMeaningInsight}
          title="That gives us a great place to start."
        />
      ) : null}

      {step === 'barrier' ? (
        <HealthQuestionLayout
          density="dense"
          sticker={onboardingV3Assets.healthBarrier}
          subtitle="Healthy choices are easier when they work around your real life."
          title="What usually gets in the way?"
        >
          <ChoiceRows
            branch={BRANCH}
            compact
            onSelect={(barrier) => dispatch({ type: 'BARRIER_SELECTED', barrier })}
            options={barrierOptions}
            selected={state.healthBarrier ? [state.healthBarrier] : []}
          />
        </HealthQuestionLayout>
      ) : null}

      {step === 'barrierResponse' ? (
        <HealthMessageScreen
          accent="sparkle"
          body={barrierCopy.body}
          sticker={onboardingV3Assets.healthBarrierResponse}
          title={barrierCopy.title}
        />
      ) : null}

      {step === 'mealToImprove' ? (
        <HealthQuestionLayout
          sticker={onboardingV3Assets.healthMeal}
          subtitle="Let’s start with the part of your day that needs the most help."
          title="Which meal would you most like to improve?"
        >
          <ChipGroup
            branch={BRANCH}
            onSelect={(meal) => dispatch({ type: 'MEAL_TO_IMPROVE_SELECTED', meal })}
            options={mealOptions}
            selected={state.mealToImprove ? [state.mealToImprove] : []}
          />
        </HealthQuestionLayout>
      ) : null}

      {step === 'mealInsight' ? (
        <HealthMessageScreen
          body={mealInsightBody(state.mealToImprove)}
          footnote="You do not need to change everything at once."
          sticker={onboardingV3Assets.healthMealInsight}
          title="We’ll start where it matters most."
        />
      ) : null}

      {step === 'foodStyle' ? (
        <HealthQuestionLayout
          sticker={onboardingV3Assets.healthFoodStyle}
          subtitle="Your healthier approach should still taste like you."
          title="What kind of food do you actually enjoy?"
        >
          <ChoiceTiles
            branch={BRANCH}
            compact
            onSelect={(foodStyle) => dispatch({ type: 'FOOD_STYLE_TOGGLED', foodStyle })}
            options={foodStyleOptions}
            selected={state.foodStyles}
          />
        </HealthQuestionLayout>
      ) : null}

      {step === 'reassurance' ? (
        <HealthMessageScreen
          body="Okyo helps you make better-fitting choices, one meal at a time."
          sticker={onboardingV3Assets.healthReassurance}
          title="You do not have to give up the food you love."
        >
          <HealthReassuranceAccent />
        </HealthMessageScreen>
      ) : null}

      {step === 'approach' ? (
        <HealthApproachScreen
          headline={approachHeadline(state)}
          supportText="Your answers shape the recipes, suggestions, and guidance Okyo gives you."
        />
      ) : null}

      {step === 'whatOkyoDoes' ? <HealthWhatOkyoScreen /> : null}

      {step === 'commitment' ? (
        <HealthQuestionLayout
          sticker={onboardingV3Assets.healthCommitment}
          subtitle="Choose a starting point—not a perfect promise."
          title="What feels realistic for you right now?"
        >
          <ChoiceRows
            branch={BRANCH}
            onSelect={(commitment) => dispatch({ type: 'COMMITMENT_SELECTED', commitment })}
            options={commitmentOptions}
            selected={state.flexibleCommitment ? [state.flexibleCommitment] : []}
          />
        </HealthQuestionLayout>
      ) : null}

      {step === 'reveal' ? (
        <HealthRevealScreen
          startingPoint={startingPointValue(state)}
          summary={revealSummary(state)}
        />
      ) : null}

      {isComplete ? (
        <HealthPlanSummary
          rows={summaryRows}
          startWith={startingPointValue(state, { lowercase: true })}
        />
      ) : null}
    </BranchScaffold>
  );
}

// Re-exported so the honest example-nutrition card stays reachable for tests.
export { HealthNutritionExample };
export const HEALTH_SCREEN_STEPS = HEALTH_STEPS;

const styles = StyleSheet.create({
  // Lets every Health branch layout use the available viewport intentionally.
  branchContent: { flex: 1 },
});
