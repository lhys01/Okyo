import { HEALTH_PROGRESS_QUESTION_STEPS } from '../state/healthBranch';
import { useEffect, useReducer, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  colors,
  onboardingFontFamilies as fontFamilies,
} from "../../theme/okyoTheme";
import { branchShadow, branchSurfaces } from "../branch-ui/branchTheme";
import {
  Activity,
  Apple,
  BreadSlice,
  Coins,
  Cookie,
  Cutlery,
  EmojiQuite,
  FireFlame,
  Fish,
  LightBulb,
  MenuScale,
  PizzaSlice,
  Repeat,
  ScaleFrameReduce,
  ShoppingBag,
  Shuffle,
  Sparks,
  SunLight,
  Timer,
} from "../assets/onboardingStickerIcons";

import { analyticsEvents, track } from "../../analytics/track";
import { shouldExitCanonicalPreviewBranch } from "../../onboarding/canonical/navigation";
import { OnboardingCTA } from "../components/OnboardingCTA";
import { MacroTargetSlider } from "../components/MacroTargetSlider";
import { BranchHydrationScreen, BranchScaffold } from "../branch-ui/BranchScaffold";
import { ChoiceRows, type ChoiceOption } from "../branch-ui/BranchControls";
import { usePersistedBranchTransition } from "../branch-ui/usePersistedBranchTransition";
import { onboardingV3Assets } from "../assets/onboardingV3Assets";
import {
  HealthV3MessageScreen as HealthMessageScreen,
  HealthV3QuestionLayout as HealthQuestionLayout,
  HealthProgress,
} from "./HealthVisuals";
import {
  HealthPlanSummary,
} from "./HealthReferenceScreens";
import { healthBranchPersistence } from "../state/healthBranchPersistence";
import {
  HEALTH_STEPS,
  HEALTH_PROGRESS_QUESTION_INDEX,
  healthReducer,
  initialHealthDraft,
  type HealthBarrierId,
  type HealthCommitmentId,
  type HealthDefinitionId,
  type FoodStyleId,
  healthGoalTypeDefinitions,
  type MealToImproveId,
  type HealthProblemId,
  type MealPriorityId,
  type HealthGoalId,
  type HealthGoalTypeId,
} from "../state/healthBranch";
import { planSummaryRows } from "../state/healthBranchCopy";
import { stepsSkippedForVariant, type OnboardingQuestionVariant } from "../state/onboardingQuestionExperiment";

const BRANCH = "eat_healthier" as const;

const definitionOptions: readonly ChoiceOption<HealthDefinitionId>[] = [
  { id: "more_balanced_meals", label: "More balanced meals", icon: MenuScale },
  { id: "more_whole_foods", label: "More whole foods", icon: Apple },
  {
    id: "more_vegetables_fruit",
    label: "More fruits and vegetables",
    icon: BreadSlice,
  },
  { id: "more_energy", label: "More energy", icon: Activity },
  { id: "better_portions", label: "Better portions", icon: ScaleFrameReduce },
  { id: "less_takeout", label: "Less takeout", icon: ShoppingBag },
];

const barrierOptions: readonly ChoiceOption<HealthBarrierId>[] = [
  { id: "not_enough_time", label: "Not enough time", icon: Timer },
  { id: "too_expensive", label: "Costs too much", icon: Coins },
  {
    id: "dont_know_what_to_cook",
    label: "Unsure what to cook",
    icon: LightBulb,
  },
  { id: "feels_boring", label: "Healthy food feels boring", icon: EmojiQuite },
  {
    id: "struggle_consistency",
    label: "Hard to stay consistent",
    icon: Repeat,
  },
  { id: "too_hungry_tired", label: "Too hungry or tired", icon: FireFlame },
];

const mealOptions: readonly ChoiceOption<MealToImproveId>[] = [
  {
    id: "breakfast",
    label: "Breakfast",
    icon: SunLight,
    imageSource: onboardingV3Assets.iconbreakfast,
  },
  {
    id: "lunch",
    label: "Lunch",
    icon: Cutlery,
    imageSource: onboardingV3Assets.iconlunch,
  },
  {
    id: "dinner",
    label: "Dinner",
    icon: PizzaSlice,
    imageSource: onboardingV3Assets.icondinner,
  },
  {
    id: "snacks",
    label: "Snacks",
    icon: Cookie,
    imageSource: onboardingV3Assets.iconsnacks,
  },
  {
    id: "it_varies",
    label: "It varies",
    icon: Shuffle,
    imageSource: onboardingV3Assets.iconvaries,
  },
];

const foodStyleOptions: readonly ChoiceOption<FoodStyleId>[] = [
  { id: "comfort_food", label: "Comfort food", icon: PizzaSlice },
  { id: "fresh_colorful", label: "Fresh and colorful", icon: Apple },
  { id: "high_protein", label: "High-protein meals", icon: Fish },
  { id: "quick_simple", label: "Quick and simple", icon: Timer },
  { id: "international", label: "International flavors", icon: FireFlame },
  { id: "a_bit_of_everything", label: "A little of everything", icon: Sparks },
];

const commitmentOptions: readonly ChoiceOption<HealthCommitmentId>[] = [
  {
    id: "most_meals_healthier",
    label: "Make most meals healthier",
    icon: Cutlery,
  },
  { id: "one_meal_daily", label: "One healthier meal a day", icon: SunLight },
  {
    id: "few_meals_weekly",
    label: "A few healthier meals weekly",
    icon: Repeat,
  },
  {
    id: "small_changes_days",
    label: "Small changes a few days",
    icon: Activity,
  },
  { id: "one_change_at_a_time", label: "One change at a time", icon: Sparks },
];
const problemOptions: readonly ChoiceOption<HealthProblemId>[] = [
  { id: "too_much_takeout", label: "Too much takeout", icon: ShoppingBag },
  { id: "meals_unbalanced", label: "Meals feel unbalanced", icon: MenuScale },
  {
    id: "not_enough_whole_foods",
    label: "Not enough whole foods",
    icon: Apple,
  },
  { id: "portions_off", label: "Portions feel off", icon: ScaleFrameReduce },
  { id: "low_energy", label: "Low energy", icon: Activity },
  {
    id: "eating_inconsistent",
    label: "Eating feels inconsistent",
    icon: Repeat,
  },
];
const mealPriorityOptions: readonly ChoiceOption<MealPriorityId>[] = [
  { id: "tastes_good", label: "Tastes good", icon: PizzaSlice },
  { id: "quick_to_make", label: "Quick to make", icon: Timer },
  { id: "keeps_me_full", label: "Keeps me full", icon: Cutlery },
  { id: "costs_less", label: "Costs less", icon: Coins },
  { id: "simple_ingredients", label: "Simple ingredients", icon: Apple },
];
const healthGoalTypeOptions: readonly ChoiceOption<HealthGoalTypeId>[] = [
  { id: "replace_takeout", label: "Replace takeout", icon: ShoppingBag },
  { id: "cook_at_home", label: "Cook at home", icon: Cutlery },
  { id: "balanced_meals", label: "Build more balanced meals", icon: MenuScale },
  { id: "whole_foods", label: "Add more whole foods", icon: Apple },
  { id: "steady_energy", label: "Feel steadier after meals", icon: Activity },
  {
    id: "steady_routine",
    label: "Build a steadier eating routine",
    icon: Repeat,
  },
];

const healthGoalTypeForProblem: Readonly<
  Record<HealthProblemId, HealthGoalTypeId>
> = {
  too_much_takeout: "replace_takeout",
  meals_unbalanced: "balanced_meals",
  not_enough_whole_foods: "whole_foods",
  portions_off: "better_portions",
  low_energy: "steady_energy",
  eating_inconsistent: "steady_routine",
};

export function HealthBranchScreen({
  onBack,
  onComplete,
  userName = "",
  variant = 'A',
}: {
  onBack: () => void;
  onComplete?: () => void | Promise<void>;
  userName?: string;
  variant?: OnboardingQuestionVariant;
}) {
  const completionStarted = useRef(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [completionError, setCompletionError] = useState(false);
  const [state, dispatch] = useReducer(healthReducer, initialHealthDraft);
  const [hydrated, setHydrated] = useState(false);
  const goalAnalyticsKey = useRef<string | null>(null);
  const goalRecommendationShown = useRef(false);
  const { isTransitioning, persistDraft, schedulePersist, transition } = usePersistedBranchTransition({
    draft: state,
    dispatch,
    getStep: (draft) => draft.currentStep,
    hydrated,
    persistence: healthBranchPersistence,
    reduce: healthReducer,
  });

  useEffect(() => {
    let cancelled = false;
    track(analyticsEvents.ONBOARDING_EXPERIMENT_STARTED, { experiment_name: 'branch_questions_v1', experiment_variant: variant });
    void healthBranchPersistence.read().then((draft) => {
      if (cancelled) return;
      const skipped = stepsSkippedForVariant(variant, BRANCH);
      let experimentDraft = draft;
      if (skipped.includes('mealToImprove')) experimentDraft = { ...experimentDraft, mealToImprove: experimentDraft.mealToImprove ?? 'it_varies' };
      if (skipped.includes('meaning')) experimentDraft = { ...experimentDraft, healthDefinition: experimentDraft.healthDefinition ?? (experimentDraft.healthProblem ? ({ too_much_takeout: 'less_takeout', meals_unbalanced: 'more_balanced_meals', not_enough_whole_foods: 'more_whole_foods', portions_off: 'better_portions', low_energy: 'more_energy', eating_inconsistent: 'more_balanced_meals' } as const)[experimentDraft.healthProblem] : 'more_balanced_meals') };
      if (skipped.includes('mealPriority')) experimentDraft = { ...experimentDraft, mealPriority: experimentDraft.mealPriority ?? 'tastes_good' };
      if (skipped.includes('foodStyle')) experimentDraft = { ...experimentDraft, foodStyles: experimentDraft.foodStyles.length ? experimentDraft.foodStyles : ['a_bit_of_everything'] };
      if (skipped.includes('commitment')) experimentDraft = { ...experimentDraft, flexibleCommitment: experimentDraft.flexibleCommitment ?? 'one_change_at_a_time' };
      dispatch({ type: "HYDRATED", draft: experimentDraft });
      if (draft.goal)
        goalAnalyticsKey.current = `${draft.goal.goalType}:${draft.goal.targetValue}:${draft.goal.targetDate}`;
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [variant]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => schedulePersist(state), 180);
    return () => clearTimeout(timer);
  }, [hydrated, schedulePersist, state]);

  useEffect(() => {
    if (!state.goal) return;
    const key = `${state.goal.goalType}:${state.goal.targetValue}:${state.goal.targetDate}`;
    if (goalAnalyticsKey.current === key) return;
    const event =
      goalAnalyticsKey.current === null
        ? analyticsEvents.GOAL_CREATED
        : analyticsEvents.GOAL_CHANGED;
    goalAnalyticsKey.current = key;
  }, [state.goal]);

  const step = state.currentStep;
  useEffect(() => {
    if (step === "goal" && !goalRecommendationShown.current) {
      goalRecommendationShown.current = true;

    } else if (step !== "goal") goalRecommendationShown.current = false;
  }, [step]);
  const isFinalPlan = step === "reveal" || step === "complete";
  const skippedSteps = stepsSkippedForVariant(variant, BRANCH).filter((item): item is typeof HEALTH_STEPS[number] => HEALTH_STEPS.includes(item as typeof HEALTH_STEPS[number]));
  const visibleQuestions = HEALTH_PROGRESS_QUESTION_STEPS.filter((question) => !skippedSteps.includes(question));
  const progressQuestion = variant === 'A' ? Math.max(HEALTH_PROGRESS_QUESTION_INDEX[step], 1) : Math.max(visibleQuestions.indexOf(step as typeof visibleQuestions[number]) + 1, 1);
  const progressTotal = variant === 'A' ? 8 : visibleQuestions.length;
  const recommendedGoalType = state.healthProblem
    ? healthGoalTypeForProblem[state.healthProblem]
    : "healthier_meals";
  const prioritizedHealthGoalTypes = [...healthGoalTypeOptions].sort((a, b) =>
    a.id === recommendedGoalType ? -1 : b.id === recommendedGoalType ? 1 : 0,
  );
  const canContinue =
    step === "problem"
      ? state.healthProblem !== null
      : step === "barrier"
        ? state.healthBarrier !== null
        : step === "mealToImprove"
          ? state.mealToImprove !== null
          : step === "meaning"
              ? state.healthDefinition !== null
              : step === "mealPriority"
                ? state.mealPriority !== null
                : step === "foodStyle"
                  ? state.foodStyles.length > 0
                  : step === "commitment"
                    ? state.flexibleCommitment !== null
                    : step === "goal"
                      ? state.healthGoalType !== null
                      : step === "solutionValue"
                        ? state.goal !== null
                        : true;

  const finish = async (draft: typeof state) => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    setIsFinishing(true);
    setCompletionError(false);
    try {
      const savedDraft = await persistDraft({ ...draft, branchCompleted: false, currentStep: 'reveal' });
      if (!savedDraft) throw new Error('Health plan could not be saved');
      track(analyticsEvents.ONBOARDING_EXPERIMENT_BRANCH_COMPLETED, { experiment_name: 'branch_questions_v1', experiment_variant: variant });
      await onComplete?.();
    } catch {
      setCompletionError(true);
    } finally {
      completionStarted.current = false;
      setIsFinishing(false);
    }
  };
  const next = async () => {
    if (!canContinue) return;
    const upcoming = isFinalPlan ? state : healthReducer(state, { type: 'NEXT_PRESSED', skipSteps: skippedSteps });
    if (upcoming.currentStep === 'reveal' || upcoming.currentStep === 'complete') {
      await finish(upcoming);
      return;
    }
    void transition({ type: 'NEXT_PRESSED', skipSteps: skippedSteps });
  };
  useEffect(() => {
    if (hydrated && isFinalPlan && !completionError) void finish(state);
  }, [hydrated, isFinalPlan]);
  const back = () => {
    if (shouldExitCanonicalPreviewBranch(step, "intro")) onBack();
    else void transition({ type: "BACK_PRESSED", skipSteps: skippedSteps });
  };

  if (!hydrated || (isFinalPlan && !completionError)) return <BranchHydrationScreen />;

  return (
    <BranchScaffold
      branch={BRANCH}
      footer={
        <View>
          {completionError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              We couldn’t finish saving. Please try again.
            </Text>
          ) : null}
          <OnboardingCTA
            disabled={!canContinue || isFinishing || isTransitioning}
            label={isFinishing ? "Saving…" : isFinalPlan ? "Done" : step === "intro" ? "Build my plan" : "Continue"}
            onPress={next}
            tone="pastelPink"
          />
        </View>
      }
      onBack={back}
      headerProgress={<HealthProgress question={progressQuestion} total={progressTotal} />}
      transitionOrder={HEALTH_STEPS}
      transitionStep={isFinalPlan ? "reveal" : step}
      contentStyle={styles.branchContent}
    >
      {step === "intro" ? (
        <HealthMessageScreen
          body="No strict rules. No perfect meals. Just small changes that fit the way you already eat."
          sticker={onboardingV3Assets.healthIntro}
          title="Let’s make eating healthier feel easier."
        />
      ) : null}
      {step === "problem" ? (
        <HealthQuestionLayout title="What's the biggest problem with the way you eat right now?">
          <ChoiceRows
            branch={BRANCH}
            iconSize={34}
            textGap={14}
            onSelect={(problem) =>
              dispatch({ type: "PROBLEM_SELECTED", problem })
            }
            options={problemOptions}
            selected={state.healthProblem ? [state.healthProblem] : []}
          />
        </HealthQuestionLayout>
      ) : null}
      {step === "barrier" ? (
        <HealthQuestionLayout title="What usually gets in the way of fixing it?">
          <ChoiceRows
            branch={BRANCH}
            iconSize={34}
            textGap={14}
            onSelect={(barrier) =>
              dispatch({ type: "BARRIER_SELECTED", barrier })
            }
            options={barrierOptions}
            selected={state.healthBarrier ? [state.healthBarrier] : []}
          />
        </HealthQuestionLayout>
      ) : null}
      {step === "mealToImprove" ? (
        <HealthQuestionLayout title="Which meal gives you the most trouble?">
          <ChoiceRows
            branch={BRANCH}
            iconSize={34}
            textGap={14}
            illustrated
            onSelect={(meal) =>
              dispatch({ type: "MEAL_TO_IMPROVE_SELECTED", meal })
            }
            options={mealOptions}
            selected={state.mealToImprove ? [state.mealToImprove] : []}
          />
        </HealthQuestionLayout>
      ) : null}
      {step === "meaning" ? (
        <HealthQuestionLayout title="What would eating healthier mean to you?">
          <ChoiceRows
            branch={BRANCH}
            iconSize={34}
            textGap={14}
            onSelect={(definition) =>
              dispatch({ type: "DEFINITION_SELECTED", definition })
            }
            options={definitionOptions}
            selected={state.healthDefinition ? [state.healthDefinition] : []}
          />
        </HealthQuestionLayout>
      ) : null}
      {step === "mealPriority" ? (
        <HealthQuestionLayout title="What matters most in a healthier meal?">
          <ChoiceRows
            branch={BRANCH}
            iconSize={34}
            textGap={14}
            onSelect={(priority) =>
              dispatch({ type: "MEAL_PRIORITY_SELECTED", priority })
            }
            options={mealPriorityOptions}
            selected={state.mealPriority ? [state.mealPriority] : []}
          />
        </HealthQuestionLayout>
      ) : null}
      {step === "foodStyle" ? (
        <HealthQuestionLayout title="What kind of food do you actually enjoy?">
          <ChoiceRows
            branch={BRANCH}
            multi
            iconSize={34}
            textGap={14}
            onSelect={(foodStyle) =>
              dispatch({ type: "FOOD_STYLE_TOGGLED", foodStyle })
            }
            options={foodStyleOptions}
            selected={state.foodStyles}
          />
        </HealthQuestionLayout>
      ) : null}
      {step === "commitment" ? (
        <HealthQuestionLayout title="What feels realistic for you right now?">
          <ChoiceRows
            branch={BRANCH}
            iconSize={34}
            textGap={14}
            onSelect={(commitment) =>
              dispatch({ type: "COMMITMENT_SELECTED", commitment })
            }
            options={commitmentOptions}
            selected={
              state.flexibleCommitment ? [state.flexibleCommitment] : []
            }
          />
        </HealthQuestionLayout>
      ) : null}
      {step === "goal" ? (
        <HealthQuestionLayout
          subtitle="Choose the change you’d most like to make."
          title="What do you want to work toward?"
        >
          <ChoiceRows
            branch={BRANCH}
            onSelect={(goalType) =>
              dispatch({ type: "HEALTH_GOAL_TYPE_SELECTED", goalType })
            }
            options={prioritizedHealthGoalTypes.map((option) =>
              option.id === recommendedGoalType
                ? { ...option, badge: "Recommended" }
                : option,
            )}
            selected={state.healthGoalType ? [state.healthGoalType] : []}
          />
        </HealthQuestionLayout>
      ) : null}
      {step === "solutionValue" ? (
        <HealthGoalBuilder
          state={state}
          onTargetChange={(value) =>
            dispatch({ type: "HEALTH_GOAL_TARGET_CHANGED", value })
          }
          onDurationChange={(value) =>
            dispatch({ type: "HEALTH_GOAL_DURATION_CHANGED", value })
          }
        />
      ) : null}
    </BranchScaffold>
  );
}
export { HealthNutritionExample } from "./HealthVisuals";
export const HEALTH_SCREEN_STEPS = HEALTH_STEPS;
const styles = StyleSheet.create({
  branchContent: { flex: 1 },
  error: { textAlign: "center", marginBottom: 8 },
});

function HealthGoalBuilder({
  state,
  onTargetChange,
  onDurationChange,
}: {
  state: {
    healthGoalType: HealthGoalTypeId | null;
    goalTargetCount: number | null;
    goalDurationWeeks: number | null;
  };
  onTargetChange: (value: number) => void;
  onDurationChange: (value: number) => void;
}) {
  const type = state.healthGoalType ?? "healthier_meals";
  const definition = healthGoalTypeDefinitions[type];
  const count = state.goalTargetCount ?? definition.defaultCount;
  const weeks = state.goalDurationWeeks ?? 4;
  return (
    <View style={goalBuilderStyles.wrap}>
      <View style={goalBuilderStyles.context}>
        <Text style={goalBuilderStyles.contextLabel}>You chose</Text>
        <Text style={goalBuilderStyles.contextValue}>
          {healthGoalTypeOptions.find((option) => option.id === type)?.label}
        </Text>
      </View>
      <Text style={goalBuilderStyles.question}>{definition.countQuestion}</Text>
      <MacroTargetSlider
        label="Meals"
        min={1}
        max={30}
        onChange={onTargetChange}
        step={1}
        testID="health-goal-count-slider"
        unit="meals"
        value={count}
      />
      <Text style={goalBuilderStyles.question}>
        {definition.durationQuestion}
      </Text>
      <MacroTargetSlider
        label="Time window"
        min={2}
        max={8}
        onChange={onDurationChange}
        step={1}
        testID="health-goal-duration-slider"
        unit="weeks"
        value={weeks}
      />
    </View>
  );
}

const goalBuilderStyles = StyleSheet.create({
  wrap: { gap: 12, paddingBottom: 8 },
  context: { alignItems: "center", gap: 2, paddingBottom: 2 },
  contextLabel: {
    color: branchSurfaces.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  contextValue: {
    color: branchSurfaces.ink,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  question: {
    color: branchSurfaces.ink,
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    lineHeight: 23,
    textAlign: "center",
  },
});

function healthGoalDefinitionForAnalytics(goal: HealthGoalId): {
  targetValue: number;
  targetUnit: string;
  duration: number;
} {
  switch (goal) {
    case "one_daily":
      return { targetValue: 1, targetUnit: "meal_per_day", duration: 14 };
    case "four_week":
      return { targetValue: 4, targetUnit: "meals_per_week", duration: 28 };
    case "two_takeout":
      return {
        targetValue: 2,
        targetUnit: "takeout_meals_per_week",
        duration: 28,
      };
    case "cook_home_three":
      return { targetValue: 3, targetUnit: "meals_per_week", duration: 28 };
    case "whole_foods_daily":
      return { targetValue: 1, targetUnit: "meal_per_day", duration: 21 };
    case "healthier_breakfast_four":
      return { targetValue: 4, targetUnit: "meals_per_week", duration: 28 };
    case "balanced_meals_five":
      return { targetValue: 5, targetUnit: "meals_per_week", duration: 28 };
    case "small_change_daily":
      return { targetValue: 1, targetUnit: "change_per_day", duration: 14 };
    case "custom":
      return { targetValue: 1, targetUnit: "custom", duration: 14 };
  }
}
