import { useLaunchDestinationReady } from '../startup/LaunchScreen';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { resolveActiveOnboardingBranch } from '../onboarding/canonical/branchRegistry';
import { canonicalOnboardingConfig } from '../onboarding/canonical/config';
import { useOkyoStore } from '../state/useOkyoStore';
import { useChosenMascotName } from '../state/useMascotName';
import { getFoxDisplayName } from '../state/foxDisplayName';
import { colors } from '../theme/okyoTheme';
import { restorePurchases } from '../services/revenueCat';
import { useOnboardingV3Controller } from './controller/useOnboardingV3Controller';
import { OnboardingV4 } from './screens-v4/OnboardingV4';
import { AnalyzingScreen } from './screens/AnalyzingScreen';
import { CookingCompleteScreen } from './screens/CookingCompleteScreen';
import { OnboardingCookingScreen } from './screens/OnboardingCookingScreen';
import { OnboardingPaywallScreen } from './screens/OnboardingPaywallScreen';
import { OnboardingRecipePreview } from './screens/OnboardingRecipePreview';
import { NameFoxScreen } from './screens/NameFoxScreen';
import { PersonalizationChoiceScreen } from './screens/PersonalizationChoiceScreen';
import { SaveMoneyBranchScreen } from './screens/SaveMoneyBranchScreen';
import { HealthBranchScreen } from './screens/HealthBranchScreen';
import { MacrosBranchScreen } from './screens/MacrosBranchScreen';
import { BranchPersonalizedPlanScreen } from './screens/BranchPersonalizedPlanScreen';
import { FoxIntroductionScreen } from './screens/FoxIntroductionScreen';
import { NameFoxValueScreen } from './screens/NameFoxValueScreens';
import { BranchAccountScreen } from './screens/BranchAccountScreen';
import { BranchSignatureCommitmentScreen } from './screens/BranchSignatureCommitmentScreen';
import { isCommitmentBranch } from './state/branchCommitmentPersistence';
import { DEFAULT_MASCOT_NAME } from './state/mascotName';
import { PhotoConfirmScreen } from './screens/PhotoConfirmScreen';
import { PersonalizedOnboardingScreen } from './screens/PersonalizedOnboardingScreen';
import { ScanInputScreen } from './screens/ScanInputScreen';
import { SplashScreen } from './screens/SplashScreen';
import { OnboardingScreenTransition } from './components/OnboardingScreenTransition';
import { ShowcasePager } from './showcase/ShowcasePager';
import { resolveOnboardingActivation } from './state/onboardingV4Activation';
import type { OnboardingV4Assignment } from './state/onboardingV4Experiment';
import { shouldUseOnboardingV4 } from './state/onboardingV4Route';
import { onboardingQuestionExperiment, type OnboardingQuestionVariant } from './state/onboardingQuestionExperiment';

export function OnboardingV3({ appStartedAt, fontsLoaded }: { appStartedAt: number; fontsLoaded: boolean }) {
  const [assignment, setAssignment] = useState<OnboardingV4Assignment | null>(canonicalOnboardingConfig.v4Enabled ? null : 'v3');
  const [questionVariant, setQuestionVariant] = useState<OnboardingQuestionVariant | null>(null);

  useEffect(() => {
    let cancelled = false;
    void onboardingQuestionExperiment.getAssignment().then((variant) => {
      if (!cancelled) setQuestionVariant(variant);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!canonicalOnboardingConfig.v4Enabled) return;
    let cancelled = false;
    resolveOnboardingActivation().then((decision) => {
      if (!cancelled) setAssignment(decision.assignment);
    });
    return () => { cancelled = true; };
  }, []);

  if (assignment === null) return <View style={styles.empty} />;
  if (shouldUseOnboardingV4({ enabled: canonicalOnboardingConfig.v4Enabled, assignment })) {
    return (
      <OnboardingV4
        appStartedAt={appStartedAt}
        fontsLoaded={fontsLoaded}
        onRestore={() => { void restorePurchases().then((result) => {
          if (result.status === 'restored' && result.isEntitled) useOkyoStore.getState().setPremium(true);
        }); }}
      />
    );
  }
  if (questionVariant === null) return <View style={styles.empty} />;
  return <LegacyOnboardingV3 appStartedAt={appStartedAt} fontsLoaded={fontsLoaded} questionVariant={questionVariant} />;
}

function LegacyOnboardingV3({ appStartedAt, fontsLoaded, questionVariant }: { appStartedAt: number; fontsLoaded: boolean; questionVariant: OnboardingQuestionVariant }) {
  const controller = useOnboardingV3Controller();
  const { state } = controller;
  useLaunchDestinationReady(state.step !== 'splash' && state.step !== 'complete');
  const chosenMascotName = useChosenMascotName();
  const displayMascotName = getFoxDisplayName(state.mascotName !== DEFAULT_MASCOT_NAME ? state.mascotName : chosenMascotName);
  const recipe = useOkyoStore((store) => state.recipeId ? store.recipesById[state.recipeId] ?? null : null);
  const activeCookingSession = useOkyoStore((store) => store.activeCookingSession);
  const [showcasePage, setShowcasePage] = useState(controller.showcaseInitialPage);
  const activeBranch = resolveActiveOnboardingBranch(state.step, state.profile.primaryGoal);
  const commitmentBranch = isCommitmentBranch(state.profile?.primaryGoal) ? state.profile.primaryGoal : null;

  const renderCurrentScreen = () => {
    switch (state.step) {
    case 'splash':
      return <SplashScreen appStartedAt={appStartedAt} fontsLoaded={fontsLoaded} onFinished={controller.finishSplash} />;
    case 'showcase':
      return (
        <ShowcasePager
          attribution={state.attribution}
          initialPage={controller.showcaseInitialPage}
          onAttributionSelected={controller.selectAttribution}
          onAttributionSkipped={controller.skipAttribution}
          onPageChange={setShowcasePage}
          onFinished={controller.finishShowcase}
        />
      );
    case 'foxIntro':
      return <FoxIntroductionScreen onBack={controller.back} onContinue={controller.continuePersonalized} />;
    case 'name':
    case 'ageEligibility':
    case 'primaryGoal':
    case 'branchIntro':
      if (activeBranch === 'save_money') return <SaveMoneyBranchScreen variant={questionVariant} onBack={controller.back} onComplete={controller.beginBranchPlan} />;
      if (activeBranch === 'eat_healthier') return <HealthBranchScreen variant={questionVariant} onBack={controller.back} onComplete={controller.beginBranchPlan} userName={state.profile.name} />;
      if (activeBranch === 'hit_macros') return <MacrosBranchScreen variant={questionVariant} ageYears={state.profile.age ?? null} onAgeChange={controller.selectAgeValue} onBack={controller.back} onComplete={async (draft) => {
        const focus = draft.macroFocus === 'low_protein' ? 'Protein' : draft.macroFocus === 'calorie_inconsistency' ? 'Calories' : draft.macroFocus === 'meals_miss_targets' ? 'Balanced macros' : draft.macroFocus === 'portion_confusion' ? 'Portions' : 'Less tracking';
        const obstacle = draft.macroBarrier === 'boring' ? 'Boring meals' : draft.macroBarrier === 'time' ? 'Not enough time' : draft.macroBarrier === 'hunger' ? 'I get too hungry' : draft.macroBarrier === 'eating_out' ? 'Eating out throws me off' : draft.macroBarrier === 'planning' ? 'Planning takes too much effort' : 'Keeping it consistent';
        controller.setPersonalizedAnswer('macrosFocus', focus);
        controller.setPersonalizedAnswer('macrosObstacle', obstacle);
        controller.setPersonalizedAnswer('macrosRecipePriorities', draft.recipePriorities);
        controller.setPersonalizedAnswer('macrosTargetMode', draft.targetMode === 'calculate_estimate' ? 'estimate' : draft.targetMode === 'known_targets' ? 'known' : 'flexible');
        controller.setPersonalizedAnswer('macrosOwnTargets', draft.targetMode === 'known_targets' ? 'yes' : 'no');
        if (draft.proteinTargetGrams !== null) controller.setPersonalizedAnswer('macrosDailyProtein', draft.proteinTargetGrams);
        if (draft.calorieTarget !== null) controller.setPersonalizedAnswer('macrosDailyCalories', draft.calorieTarget);
        controller.beginBranchPlan();
      }} userName={state.profile.name} />;
      // No preview: render the normal name, age, goal, or branch intro below.
    case 'question1':
    case 'question2':
    case 'question3':
    case 'question4':
    case 'question5':
    case 'question6':
    case 'question7':
    case 'question8':
    case 'question9':
    case 'holdReveal':
    case 'branchReveal':
    case 'branchInsight':
    case 'nutritionTargets':
    case 'branchDemo':
    case 'secondaryGoals':
    case 'dietaryPreferences':
    case 'personalizedFuture':
    case 'planReady':
      return (
        <PersonalizedOnboardingScreen
          onAnswer={controller.setPersonalizedAnswer}
          onBack={controller.back}
          onContinue={controller.continuePersonalized}
          onDietary={controller.submitDietaryPreferences}
          onGoal={controller.selectPrimaryGoal}
          onSkipGoalPersonalization={controller.skipGoalPersonalization}
          onHoldComplete={controller.completeHoldReveal}
          onName={controller.submitName}
          onSkipName={controller.skipName}
          onAgeEligibility={controller.selectAgeEligibility}
          onAgeValue={controller.selectAgeValue}
          onSecondaryGoals={controller.submitSecondaryGoals}
          state={state}
        />
      );
    case 'branchPlan':
    case 'branchDietarySafety':
    case 'branchMacroResults':
      return commitmentBranch ? <BranchPersonalizedPlanScreen branch={commitmentBranch} variant={questionVariant} onBack={controller.back} onContinue={controller.continuePersonalized} onEditTargets={controller.editMacroPlanTargets} /> : <BranchRouteFallback />;
    case 'branchSignature':
      return commitmentBranch ? <BranchSignatureCommitmentScreen branch={commitmentBranch} onBack={controller.back} onContinue={controller.continueBranchSignature} /> : <BranchRouteFallback />;
    case 'branchAccount':
      return commitmentBranch ? <BranchAccountScreen branch={commitmentBranch} onBack={controller.back} onDone={() => { void controller.completeBranchAccount(); }} /> : <BranchRouteFallback />;
    case 'nameFox':
      return <NameFoxScreen initialName={state.mascotName !== DEFAULT_MASCOT_NAME ? state.mascotName : (chosenMascotName ?? '')} onBack={controller.back} onSkip={controller.skipMascotName} onSubmit={controller.submitMascotName} />;
    case 'foxExplainer1':
    case 'foxExplainer2':
      return <NameFoxValueScreen mascotName={displayMascotName} onBack={controller.back} onNext={controller.continuePersonalized} page={state.step === 'foxExplainer1' ? 0 : 1} />;
    case 'personalizationChoice':
      return (
        <PersonalizationChoiceScreen
          mascotName={displayMascotName}
          onBack={controller.back}
          onContinue={controller.continuePersonalization}
          onSkip={controller.skipPersonalization}
        />
      );
    case 'postPurchase':
    case 'input':
      return (
        <ScanInputScreen
          errorMessage={state.error?.message ?? null}
          userName={state.profile.name}
          onBack={controller.back}
          onDescriptionSubmitted={controller.submitDescription}
          onPermissionDenied={(message) => controller.permissionDenied(message)}
          onPhotoSelected={controller.selectPhoto}
        />
      );
    case 'photoConfirm':
      return <PhotoConfirmScreen photoUri={state.photoUri ?? ''} onBack={controller.back} onConfirm={controller.confirmPhoto} />;
    case 'analyzing':
      return <AnalyzingScreen mascotName={displayMascotName} photoUri={state.photoUri} onCancel={controller.cancelAnalysis} />;
    case 'recipe':
      return (
        <OnboardingRecipePreview
          dietaryPreferences={state.profile.dietaryPreferences}
          macroFocus={state.profile.primaryGoal === 'hit_macros' ? state.profile.macroPreferences?.focus ?? undefined : undefined}
          macroObstacle={state.profile.primaryGoal === 'hit_macros' ? state.profile.macroPreferences?.obstacle : undefined}
          macroRecipePriorities={state.profile.primaryGoal === 'hit_macros' ? state.profile.macroPreferences?.recipePriorities : undefined}
          errorMessage={state.error?.message ?? null}
          mascotName={displayMascotName}
          onBack={controller.back}
          onContinue={controller.continueToPaywall}
          onCook={controller.startCooking}
          onEditTitle={(title) => state.recipeId && controller.editRecipeTitle(state.recipeId, title)}
          onRetry={controller.retryRecipe}
          onStartOver={controller.startOver}
          photoUri={state.photoUri}
          recipe={recipe}
        />
      );
    case 'cooking':
      return recipe ? (
        <OnboardingCookingScreen
          initialIndex={activeCookingSession?.recipeId === recipe.id ? activeCookingSession.currentStepIndex : 0}
          onBack={controller.back}
          onComplete={controller.completeCooking}
          onExit={controller.exitCooking}
          onProgress={controller.updateCookingStep}
          recipe={recipe}
        />
      ) : <View style={styles.empty} />;
    case 'cookingComplete':
      return <CookingCompleteScreen mascotName={displayMascotName} onContinue={controller.continueToPaywall} />;
    case 'paywall':
      return (
        <OnboardingPaywallScreen
          error={state.error}
          isBusy={controller.isPurchaseBusy}
          onAlreadyEntitled={controller.acceptExistingEntitlement}
          onDevSkipToHome={controller.devCompleteOnboarding}
          onPaymentsUnavailable={controller.continueWithoutSubscription}
          onDismissError={controller.dismissPurchaseError}
          onPurchase={(pkg) => void controller.purchase(pkg)}
          onRestore={() => void controller.restore()}
          profile={state.profile}
        />
      );
      case 'complete':
        return <View style={styles.empty} />;
    }
  };

  return <OnboardingScreenTransition step={state.step}>{renderCurrentScreen()}</OnboardingScreenTransition>;
}

function BranchRouteFallback() {
  return <View accessibilityLabel="Preparing your plan" style={styles.branchFallback}><Text style={styles.branchFallbackText}>Preparing your plan…</Text></View>;
}

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.background, flex: 1 },
  branchFallback: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center', padding: 24 },
  branchFallbackText: { color: colors.body, fontSize: 16 },
});
