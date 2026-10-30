import { MACROS_PROGRESS_QUESTION_STEPS } from '../state/macrosBranch';
import { useEffect, useReducer, useRef, useState } from "react";
import type { Dispatch } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { analyticsEvents, track } from "../../analytics/track";
import { shouldExitCanonicalPreviewBranch } from "../../onboarding/canonical/navigation";
import {
  colors,
  onboardingFontFamilies as fontFamilies,
} from "../../theme/okyoTheme";
import {
  Activity,
  Apple,
  Coins,
  FireFlame,
  Fish,
  LightBulb,
  List,
  PizzaSlice,
  Repeat,
  ScaleFrameReduce,
  ShoppingBag,
  Sparks,
  StatsUpSquare,
  Target,
  Timer,
  Weight,
} from "../assets/onboardingStickerIcons";
import { onboardingV3Assets } from "../assets/onboardingV3Assets";
import { BranchHydrationScreen, BranchScaffold } from "../branch-ui/BranchScaffold";
import { ChoiceRows, type ChoiceOption } from "../branch-ui/BranchControls";
import { usePersistedBranchTransition } from "../branch-ui/usePersistedBranchTransition";
import { branchSurfaces } from "../branch-ui/branchTheme";
import { MacroTargetSlider } from "../components/MacroTargetSlider";
import { StartingEstimateSlider } from "../components/StartingEstimateSlider";
import { OnboardingCTA } from "../components/OnboardingCTA";
import {
  MACROS_PROGRESS_QUESTION_INDEX,
  MACROS_PROGRESS_TOTAL,
  MACROS_STEPS,
  initialMacrosDraft,
  macrosReducer,
  normalizeMacrosDraft,
  reuseOnboardingAge,
  type MacroBarrierId,
  type MacroFocusId,
  type MacroRecipePriorityId,
  type MacroTargetMode,
  type MacrosDraft,
} from "../state/macrosBranch";
import {
  diagnosisCopy,
} from "../state/macrosBranchCopy";
import { macrosBranchPersistence } from "../state/macrosBranchPersistence";
import { stepsSkippedForVariant, type OnboardingQuestionVariant } from "../state/onboardingQuestionExperiment";
import {
  HealthProgress,
  HealthV3QuestionLayout as QuestionLayout,
} from "./HealthVisuals";

const BRANCH = "hit_macros" as const;
const rowProps = { branch: BRANCH, iconSize: 34, textGap: 14 } as const;
const goalOptions: readonly ChoiceOption<MacroFocusId>[] = [
  { id: "low_protein", label: "Get enough protein", icon: Weight },
  {
    id: "calorie_inconsistency",
    label: "Stay closer to my calories",
    icon: Activity,
  },
  { id: "meals_miss_targets", label: "Balance my macros", icon: StatsUpSquare },
  {
    id: "portion_confusion",
    label: "Understand portions",
    icon: ScaleFrameReduce,
  },
  { id: "tracking_friction", label: "Spend less time tracking", icon: List },
];
const barrierOptions: readonly ChoiceOption<MacroBarrierId>[] = [
  { id: "boring", label: "Macro-friendly food feels boring", icon: PizzaSlice },
  { id: "time", label: "I don’t have enough time", icon: Timer },
  { id: "hunger", label: "I get too hungry", icon: FireFlame },
  { id: "eating_out", label: "Eating out throws me off", icon: ShoppingBag },
  { id: "planning", label: "Planning takes too much effort", icon: LightBulb },
  { id: "consistency", label: "It’s hard to stay consistent", icon: Repeat },
];
const priorityOptions: readonly {
  id: MacroRecipePriorityId;
  label: string;
  icon: any;
}[] = [
  { id: "tastes_good", label: "Tastes genuinely good", icon: PizzaSlice },
  { id: "keeps_me_full", label: "Keeps me full", icon: FireFlame },
  { id: "quick_to_make", label: "Quick to make", icon: Timer },
  { id: "simple_ingredients", label: "Uses simple ingredients", icon: Apple },
  { id: "fits_budget", label: "Fits my budget", icon: Coins },
  { id: "feels_familiar", label: "Feels familiar", icon: Sparks },
];
const targetModeOptions: readonly ChoiceOption<MacroTargetMode>[] = [
  {
    id: "calculate_estimate",
    label: "Calculate an estimate for me",
    icon: Activity,
  },
  { id: "known_targets", label: "I already know my targets", icon: Target },
  { id: "keep_flexible", label: "Keep things flexible for now", icon: Sparks },
];

export function MacrosBranchScreen({
  onBack,
  onComplete,
  ageYears,
  onAgeChange,
  variant = 'A',
}: {
  onBack: () => void;
  onComplete: (draft: MacrosDraft) => void | Promise<void>;
  ageYears: number | null;
  onAgeChange: (age: number) => void;
  userName?: string | null;
  variant?: OnboardingQuestionVariant;
}) {
  const [state, dispatch] = useReducer(macrosReducer, initialMacrosDraft);
  const [isFinishing, setIsFinishing] = useState(false);
  const [completionError, setCompletionError] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const completionStarted = useRef(false);
  const { isTransitioning, persistDraft, schedulePersist, transition } = usePersistedBranchTransition({
    draft: state,
    dispatch,
    getStep: (draft) => draft.currentStep,
    hydrated,
    persistence: macrosBranchPersistence,
    reduce: macrosReducer,
  });
  useEffect(() => {
    let cancelled = false;
    track(analyticsEvents.ONBOARDING_EXPERIMENT_STARTED, { experiment_name: 'branch_questions_v1', experiment_variant: variant });
    void macrosBranchPersistence
      .read()
      .then((draft) => {
        if (cancelled) return;
        const normalized = normalizeMacrosDraft(draft);
        const skipped = stepsSkippedForVariant(variant, BRANCH);
        const experimentDraft = skipped.includes('barrier') ? {
          ...normalized,
          macroBarrier: normalized.macroBarrier ?? 'consistency',
          recipePriorities: skipped.includes('mealPriority') && normalized.recipePriorities.length === 0 ? ['tastes_good' as const] : normalized.recipePriorities,
        } : normalized;
        dispatch({ type: "HYDRATED", draft: reuseOnboardingAge(experimentDraft, ageYears) });
        setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [variant]);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => schedulePersist(state), 180);
    return () => clearTimeout(timer);
  }, [hydrated, schedulePersist, state]);
  const step = state.currentStep;
  const skippedSteps = stepsSkippedForVariant(variant, BRANCH).filter((item): item is typeof MACROS_STEPS[number] => MACROS_STEPS.includes(item as typeof MACROS_STEPS[number]));
  const finalPlan = step === "reveal" || step === "complete";
  const visibleQuestionSteps = MACROS_PROGRESS_QUESTION_STEPS.filter((question) => !skippedSteps.includes(question));
  const progress = variant === 'A' ? Math.max(MACROS_PROGRESS_QUESTION_INDEX[step], 1) : Math.max(visibleQuestionSteps.indexOf(step as typeof visibleQuestionSteps[number]) + 1, 1);
  const progressTotal = variant === 'A' ? MACROS_PROGRESS_TOTAL : visibleQuestionSteps.length;
  const diagnosis = diagnosisCopy(state);
  const canContinue =
    step === "problem"
      ? !!state.macroFocus
      : step === "barrier"
        ? !!state.macroBarrier
        : step === "mealPriority"
          ? state.recipePriorities.length > 0
        : step === "targetMode"
            ? !!state.targetMode
            : step === "estimateDetails"
              ? !!state.proteinTargetGrams && !!state.calorieTarget
              : true;
  const finish = async (draft: MacrosDraft) => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    setIsFinishing(true);
    setCompletionError(false);
    try {
      const savedDraft = await persistDraft(draft);
      if (!savedDraft) throw new Error('Macro plan could not be saved');
      track(analyticsEvents.ONBOARDING_EXPERIMENT_BRANCH_COMPLETED, { experiment_name: 'branch_questions_v1', experiment_variant: variant });
      await onComplete(draft);
    } catch {
      setCompletionError(true);
    } finally {
      completionStarted.current = false;
      setIsFinishing(false);
    }
  };
  const next = async () => {
    if (!canContinue) return;
    const upcoming = finalPlan ? state : macrosReducer(state, { type: 'NEXT_PRESSED', skipSteps: skippedSteps });
    if (upcoming.currentStep === 'reveal' || upcoming.currentStep === 'complete') {
      await finish(upcoming);
      return;
    }
    void transition({ type: 'NEXT_PRESSED', skipSteps: skippedSteps });
  };
  useEffect(() => {
    if (hydrated && finalPlan && !completionError) void finish(state);
  }, [hydrated, finalPlan]);
  const back = () =>
    shouldExitCanonicalPreviewBranch(step, "intro")
      ? onBack()
      : void transition({ type: "BACK_PRESSED", skipSteps: skippedSteps });

  if (!hydrated || (finalPlan && !completionError)) return <BranchHydrationScreen />;

  return (
    <BranchScaffold
      branch={BRANCH}
      contentStyle={styles.content}
      footer={
        <View>
          {completionError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              We couldn’t finish saving. Please try again.
            </Text>
          ) : null}
          <OnboardingCTA
            disabled={!canContinue || isFinishing || isTransitioning}
            label={isFinishing ? "Saving…" : step === "intro" ? "Build my plan" : "Continue"}
            onPress={() => {
              void next();
            }}
            tone="pastelPink"
          />
        </View>
      }
      onBack={back}
      headerProgress={
        step === "intro" ? (
          <View style={styles.progressSpacer} />
        ) : (
          <HealthProgress question={progress} total={progressTotal} />
        )
      }
      transitionOrder={MACROS_STEPS}
      transitionStep={finalPlan ? "reveal" : step}
    >
      {step === "intro" ? <MacrosPromise /> : null}
      {step === "problem" ? (
        <QuestionLayout title="What do you want help with most?">
          <ChoiceRows
            {...rowProps}
            options={goalOptions}
            selected={state.macroFocus ? [state.macroFocus] : []}
            onSelect={(problem) => {

              dispatch({ type: "PROBLEM_SELECTED", problem });
            }}
          />
        </QuestionLayout>
      ) : null}
      {step === "barrier" ? (
        <QuestionLayout title="What usually makes that difficult?">
          <ChoiceRows
            {...rowProps}
            options={barrierOptions}
            selected={state.macroBarrier ? [state.macroBarrier] : []}
            onSelect={(barrier) => {

              dispatch({ type: "BARRIER_SELECTED", barrier });
            }}
          />
        </QuestionLayout>
      ) : null}
      {step === "diagnosis" ? (
        <Acknowledgement
          title={diagnosis.title}
          body={diagnosis.body}
        />
      ) : null}
      {step === "mealPriority" ? (
        <RecipePriorities
          selected={state.recipePriorities}
          onToggle={(priority) =>
            dispatch({ type: "RECIPE_PRIORITIES_TOGGLED", priority })
          }
        />
      ) : null}
      {step === "targetMode" ? (
        <QuestionLayout
          title="How should we set your targets?"
          subtitle="You can change these any time."
        >
          <ChoiceRows
            {...rowProps}
            options={targetModeOptions}
            selected={state.targetMode ? [state.targetMode] : []}
            onSelect={(mode) =>
              dispatch({ type: "TARGET_MODE_SELECTED", mode })
            }
          />
          {state.targetMode === "calculate_estimate" && state.estimateProfile.ageYears === null ? (
            <Text accessibilityRole="text" style={styles.targetSub}>
              An estimate needs the age you entered earlier. Go back to update it, or choose your own targets or a flexible plan.
            </Text>
          ) : null}
        </QuestionLayout>
      ) : null}
      {step === "estimateDetails" ? (
        <EstimateDetails state={state} dispatch={dispatch} />
      ) : null}
      {step === "knownTargets" ? (
        <KnownTargets state={state} dispatch={dispatch} />
      ) : null}
    </BranchScaffold>
  );
}

function Acknowledgement({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={styles.ack}>
      <Text accessibilityRole="header" style={styles.ackTitle}>
        {title}
      </Text>
      <Text style={styles.ackBody}>{body}</Text>
      <View style={styles.ackArt}>
        <View style={styles.ackBlob} />
        <Image
          accessibilityElementsHidden
          contentFit="contain"
          source={onboardingV3Assets.macrosDiagnosis}
          style={styles.ackSticker}
        />
      </View>
    </View>
  );
}
function MacrosPromise() {
  return (
    <View style={styles.promise}>
      <Text accessibilityRole="header" style={styles.promiseTitle}>
        Eat what you like.{`\n`}Make the numbers work.
      </Text>
      <Text style={styles.promiseBody}>
        Okyo helps turn food you want into recipes that better fit your
        calories, protein, and routine.
      </Text>
      <View style={styles.promiseArt}>
        <View style={styles.promiseBlob} />
        <Image
          accessibilityElementsHidden
          contentFit="contain"
          source={onboardingV3Assets.macrosIntro}
          style={styles.promiseKiko}
        />
      </View>
    </View>
  );
}
function RecipePriorities({
  selected,
  onToggle,
}: {
  selected: readonly MacroRecipePriorityId[];
  onToggle: (id: MacroRecipePriorityId) => void;
}) {
  return (
    <View style={styles.priorityWrap}>
      <Text accessibilityRole="header" style={styles.priorityTitle}>
        What should every recipe get right?
      </Text>
      <Text style={styles.prioritySub}>Choose up to two priorities.</Text>
      <View style={styles.priorityGrid}>
        {priorityOptions.map((option) => {
          const active = selected.includes(option.id);
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              key={option.id}
              onPress={() => onToggle(option.id)}
              style={[styles.priorityTile, active && styles.priorityTileActive]}
            >
              <option.icon
                color={active ? colors.coralDark : branchSurfaces.body}
                height={30}
                width={30}
              />
              <Text
                style={[
                  styles.priorityText,
                  active && styles.priorityTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.selectionHint}>{selected.length}/2 selected</Text>
    </View>
  );
}
function EstimateDetails({
  state,
  dispatch,
}: {
  state: MacrosDraft;
  dispatch: Dispatch<import("../state/macrosBranch").MacrosEvent>;
}) {
  const profile = state.estimateProfile;
  const heightInches =
    profile.heightCm === null ? null : Math.round(profile.heightCm / 2.54);
  const weightPounds =
    profile.weightKg === null ? null : Math.round(profile.weightKg * 2.20462);
  const heightLabel = (inches: number | null) =>
    inches === null
      ? "Set height"
      : `${Math.floor(inches / 12)}'${inches % 12}"`;
  const weightLabel = (pounds: number | null) =>
    pounds === null ? "Set weight" : `${pounds.toLocaleString()} lb`;
  const weeklyChangeLabel = (pounds: number | null) =>
    pounds === null || pounds === 0
      ? "Maintain"
      : `${pounds < 0 ? "Lose" : "Gain"} ${Math.abs(pounds)} lb/week`;
  return (
    <View style={styles.estimateWrap}>
      <View style={styles.estimateHeader}>
        <Text accessibilityRole="header" style={styles.targetTitle}>
          Set your starting point
        </Text>
        <Text style={styles.targetSub}>
          A few quick details help Okyo estimate a starting daily target.
        </Text>
      </View>
      <StartingEstimateSlider
        label="Height"
        max={84}
        maxLabel={"7'0\""}
        min={48}
        minLabel={"4'0\""}
        onChange={(inches) =>
          dispatch({
            type: "ESTIMATE_PROFILE_UPDATED",
            patch: { heightCm: Math.round(inches * 2.54) },
          })
        }
        step={1}
        testID="macros-height-slider"
        value={heightInches}
        valueLabel={heightLabel}
      />
      <StartingEstimateSlider
        label="Current weight"
        max={350}
        maxLabel="350 lb"
        min={80}
        minLabel="80 lb"
        onChange={(pounds) =>
          dispatch({
            type: "ESTIMATE_PROFILE_UPDATED",
            patch: { weightKg: Math.round((pounds / 2.20462) * 10) / 10 },
          })
        }
        step={1}
        testID="macros-weight-slider"
        value={weightPounds}
        valueLabel={weightLabel}
      />
      <StartingEstimateSlider
        label="How do you want your weight to change?"
        max={2}
        maxLabel="Gain"
        min={-2}
        minLabel="Lose"
        onChange={(pounds) =>
          dispatch({ type: "WEEKLY_CHANGE_SELECTED", pounds })
        }
        step={0.5}
        testID="macros-weekly-change-slider"
        value={state.weeklyChangePounds}
        valueLabel={weeklyChangeLabel}
        variant="weightChange"
      />
      <View style={styles.aboutSection}>
        <ChoiceChips
          label="Estimate using"
          selected={profile.biologicalSex}
          options={[
            ["female", "Female"],
            ["male", "Male"],
            ["non_binary", "Non-binary"],
            ["prefer_not_to_say", "Prefer not to say"],
          ]}
          onSelect={(biologicalSex) =>
            dispatch({
              type: "ESTIMATE_PROFILE_UPDATED",
              patch: {
                biologicalSex: biologicalSex as
                  "female" | "male" | "non_binary" | "prefer_not_to_say",
              },
            })
          }
        />
      </View>
      <StartingEstimateSlider
        bubbleWidth={156}
        label="Weekly activity"
        max={56}
        maxLabel="56 hours/week"
        min={0}
        minLabel="0 hours/week"
        onChange={(activityHoursPerWeek) =>
          dispatch({ type: "ESTIMATE_PROFILE_UPDATED", patch: { activityHoursPerWeek } })
        }
        step={1}
        testID="macros-weekly-activity-slider"
        value={profile.activityHoursPerWeek ?? null}
        valueLabel={(hours) => hours === null ? "Set activity" : `${hours} hours/week`}
      />
      <View accessibilityLiveRegion="polite" style={styles.targetPayoff}>
        <Text style={styles.targetEyebrow}>YOUR STARTING DAILY TARGET</Text>
        <Text
          style={[
            styles.targetPayoffValue,
            state.calorieTarget === null && styles.targetPayoffUnset,
          ]}
        >
          {state.calorieTarget === null
            ? "Complete your details"
            : `${state.calorieTarget.toLocaleString()} cal/day`}
        </Text>
        <Text style={styles.disclaimer}>
          Estimate only — not medical advice.
        </Text>
      </View>
    </View>
  );
}
function ChoiceChips({
  label,
  selected,
  options,
  onSelect,
}: {
  label: string;
  selected: string | null;
  options: readonly (readonly [string, string])[];
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chips}>
      <Text style={styles.chipsLabel}>{label}</Text>
      <View style={styles.chipRows}>
        {options.map(([id, text]) => (
          <Pressable
            accessibilityLabel={`${label}: ${text}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === id }}
            key={id}
            onPress={() => onSelect(id)}
            style={[styles.chip, selected === id && styles.chipSelected]}
          >
            <Text
              style={[
                styles.chipText,
                selected === id && styles.chipTextSelected,
              ]}
            >
              {text}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function KnownTargets({
  state,
  dispatch,
}: {
  state: MacrosDraft;
  dispatch: Dispatch<import("../state/macrosBranch").MacrosEvent>;
}) {
  return (
    <View style={styles.targetWrap}>
      <Text accessibilityRole="header" style={styles.targetTitle}>
        Add your daily targets
      </Text>
      <Text style={styles.targetSub}>
        Every value is optional. Add only the targets you already use.
      </Text>
      <MacroTargetSlider
        label="Daily protein"
        min={40}
        max={350}
        step={5}
        unit="g"
        value={state.proteinTargetGrams}
        onChange={(value) =>
          dispatch({ type: "PROTEIN_TARGET_SAVED", grams: value })
        }
        testID="macros-protein-slider"
      />
      <MacroTargetSlider
        label="Daily calories"
        min={1200}
        max={4200}
        step={25}
        unit="cal"
        value={state.calorieTarget}
        onChange={(value) =>
          dispatch({ type: "CALORIE_TARGET_SAVED", calories: value })
        }
        testID="macros-calorie-slider"
      />
      <MacroTargetSlider
        label="Daily carbohydrates"
        min={0}
        max={500}
        step={5}
        unit="g"
        value={state.carbTargetGrams}
        onChange={(value) =>
          dispatch({ type: "CARB_TARGET_SAVED", grams: value })
        }
        testID="macros-carbs-slider"
      />
      <MacroTargetSlider
        label="Daily fat"
        min={0}
        max={250}
        step={5}
        unit="g"
        value={state.fatTargetGrams}
        onChange={(value) =>
          dispatch({ type: "FAT_TARGET_SAVED", grams: value })
        }
        testID="macros-fat-slider"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  progressSpacer: { flex: 1 },
  error: {
    color: colors.coralDark,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginBottom: 7,
    textAlign: "center",
  },
  promise: {
    alignItems: "center",
    flex: 1,
    gap: 16,
    justifyContent: "center",
    paddingVertical: 18,
  },
  promiseTitle: {
    color: branchSurfaces.ink,
    fontFamily: fontFamilies.extraBold,
    fontSize: 33,
    lineHeight: 39,
    textAlign: "center",
  },
  promiseBody: {
    color: branchSurfaces.body,
    fontFamily: fontFamilies.body,
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 345,
    textAlign: "center",
  },
  promiseArt: {
    alignItems: "center",
    height: 278,
    justifyContent: "center",
    marginTop: 6,
    width: "100%",
  },
  promiseBlob: {
    backgroundColor: "#FDEEF2",
    borderRadius: 999,
    height: 214,
    position: "absolute",
    width: 338,
  },
  promiseKiko: { height: 188, position: "absolute", width: 188 },
  ack: { alignItems: "center", gap: 18, paddingVertical: 28 },
  ackTitle: {
    color: branchSurfaces.ink,
    fontFamily: fontFamilies.extraBold,
    fontSize: 29,
    lineHeight: 36,
    textAlign: "center",
  },
  ackBody: {
    color: branchSurfaces.body,
    fontFamily: fontFamilies.body,
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 340,
    textAlign: "center",
  },
  ackArt: {
    alignItems: "center",
    height: 190,
    justifyContent: "center",
    width: "100%",
  },
  ackBlob: {
    backgroundColor: "#FDEEF2",
    borderRadius: 999,
    height: 150,
    position: "absolute",
    width: 300,
  },
  ackSticker: { height: 184, width: 184 },
  priorityWrap: { flexGrow: 1, gap: 8, paddingTop: 8, width: '100%' },
  priorityTitle: {
    color: branchSurfaces.ink,
    fontFamily: fontFamilies.extraBold,
    fontSize: 29,
    lineHeight: 36,
    textAlign: "center",
  },
  prioritySub: {
    color: branchSurfaces.body,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    textAlign: "center",
  },
  priorityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    paddingTop: 4,
    width: "100%",
  },
  priorityTile: {
    alignItems: "center",
    backgroundColor: branchSurfaces.card,
    borderColor: branchSurfaces.cardBorder,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    minHeight: 108,
    paddingHorizontal: 10,
    paddingVertical: 15,
    width: "48%",
  },
  priorityTileActive: {
    backgroundColor: "#FFF0F4",
    borderColor: "#F58CAF",
    borderWidth: 2,
  },
  priorityText: {
    color: branchSurfaces.body,
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    textAlign: "center",
  },
  priorityTextActive: { color: colors.coralDark },
  selectionHint: {
    color: branchSurfaces.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    textAlign: "center",
  },
  targetWrap: { gap: 15, paddingTop: 20 },
  estimateWrap: { gap: 30, paddingBottom: 24, paddingTop: 8 },
  estimateHeader: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
  },
  targetTitle: {
    color: branchSurfaces.ink,
    fontFamily: fontFamilies.extraBold,
    fontSize: 30,
    lineHeight: 37,
    textAlign: "center",
  },
  targetSub: {
    color: branchSurfaces.body,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 330,
    textAlign: "center",
  },
  aboutSection: { gap: 18 },
  aboutTitle: {
    color: branchSurfaces.ink,
    fontFamily: fontFamilies.bold,
    fontSize: 19,
  },
  agePrivacyNote: {
    color: branchSurfaces.muted,
    fontFamily: fontFamilies.body,
    fontSize: 11,
    lineHeight: 16,
  },
  chips: { gap: 8 },
  chipsLabel: {
    color: branchSurfaces.ink,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  chipRows: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    backgroundColor: "#F8F7F5",
    borderColor: "#ECE8E1",
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipSelected: { backgroundColor: "#EAF8F9", borderColor: "#8AD5DD" },
  chipText: {
    color: branchSurfaces.body,
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  chipTextSelected: {
    color: "#278F9F",
    fontFamily: fontFamilies.semibold,
  },
  targetPayoff: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  targetEyebrow: {
    color: "#278F9F",
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    letterSpacing: 0.7,
  },
  targetPayoffValue: {
    color: "#278F9F",
    fontFamily: fontFamilies.extraBold,
    fontSize: 29,
    lineHeight: 35,
  },
  targetPayoffUnset: {
    color: branchSurfaces.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 17,
  },
  disclaimer: {
    color: branchSurfaces.muted,
    fontFamily: fontFamilies.body,
    fontSize: 11,
    textAlign: "center",
  },
});
export const MACROS_SCREEN_STEPS = MACROS_STEPS;
