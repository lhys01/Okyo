import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ONBOARDING_V4_ENABLED } from '../config/devFlags';
import { useOkyoStore } from '../state/useOkyoStore';
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
import { SaveMoneyBranchScreen } from './screens/SaveMoneyBranchScreen';
import { HealthBranchScreen } from './screens/HealthBranchScreen';
import { MacrosBranchScreen } from './screens/MacrosBranchScreen';
import { PhotoConfirmScreen } from './screens/PhotoConfirmScreen';
import { PersonalizedOnboardingScreen } from './screens/PersonalizedOnboardingScreen';
import { ScanInputScreen } from './screens/ScanInputScreen';
import { SplashScreen } from './screens/SplashScreen';
import { OnboardingScreenTransition } from './components/OnboardingScreenTransition';
import { ShowcasePager } from './showcase/ShowcasePager';
import { resolveOnboardingActivation } from './state/onboardingV4Activation';
import type { OnboardingV4Assignment } from './state/onboardingV4Experiment';
import { shouldUseOnboardingV4 } from './state/onboardingV4Route';
import { isSaveMoneyStage2PreviewEnabled } from './state/saveMoneyStage2Preview';
import { isEatHealthierStage2PreviewEnabled } from './state/eatHealthierStage2Preview';
import { isHitMacrosStage2PreviewEnabled } from './state/hitMacrosStage2Preview';

export function OnboardingV3({ appStartedAt, fontsLoaded }: { appStartedAt: number; fontsLoaded: boolean }) {
  const [assignment, setAssignment] = useState<OnboardingV4Assignment | null>(ONBOARDING_V4_ENABLED ? null : 'v3');

  useEffect(() => {
    if (!ONBOARDING_V4_ENABLED) return;
    let cancelled = false;
    resolveOnboardingActivation().then((decision) => {
      if (!cancelled) setAssignment(decision.assignment);
    });
    return () => { cancelled = true; };
  }, []);

  if (assignment === null) return <View style={styles.empty} />;
  if (shouldUseOnboardingV4({ enabled: ONBOARDING_V4_ENABLED, assignment })) {
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
  return <LegacyOnboardingV3 appStartedAt={appStartedAt} fontsLoaded={fontsLoaded} />;
}

function LegacyOnboardingV3({ appStartedAt, fontsLoaded }: { appStartedAt: number; fontsLoaded: boolean }) {
  const controller = useOnboardingV3Controller();
  const { state } = controller;
  const recipe = useOkyoStore((store) => state.recipeId ? store.recipesById[state.recipeId] ?? null : null);
  const activeCookingSession = useOkyoStore((store) => store.activeCookingSession);
  const [showcasePage, setShowcasePage] = useState(controller.showcaseInitialPage);

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
    case 'nameFox':
      return <NameFoxScreen initialName={state.mascotName} onBack={controller.back} onSubmit={controller.submitMascotName} />;
    case 'name':
    case 'primaryGoal':
    case 'branchIntro':
      if (state.step === 'branchIntro' && state.profile.primaryGoal === 'save_money' && isSaveMoneyStage2PreviewEnabled()) return <SaveMoneyBranchScreen onBack={controller.back} onComplete={controller.completeBranchPreview} />;
      if (state.step === 'branchIntro' && state.profile.primaryGoal === 'eat_healthier' && isEatHealthierStage2PreviewEnabled()) return <HealthBranchScreen onBack={controller.back} onComplete={controller.completeBranchPreview} userName={state.profile.name} />;
      if (state.profile.primaryGoal === 'hit_macros' && isHitMacrosStage2PreviewEnabled()) return <MacrosBranchScreen onBack={controller.back} onComplete={controller.completeBranchPreview} userName={state.profile.name} />;
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
          onHoldComplete={controller.completeHoldReveal}
          onName={controller.submitName}
          onSecondaryGoals={controller.submitSecondaryGoals}
          state={state}
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
      return <AnalyzingScreen mascotName={state.mascotName} photoUri={state.photoUri} onCancel={controller.cancelAnalysis} />;
    case 'recipe':
      return (
        <OnboardingRecipePreview
          dietaryPreferences={state.profile.dietaryPreferences}
          errorMessage={state.error?.message ?? null}
          mascotName={state.mascotName}
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
      return <CookingCompleteScreen mascotName={state.mascotName} onContinue={controller.continueToPaywall} />;
    case 'paywall':
      return (
        <OnboardingPaywallScreen
          error={state.error}
          isBusy={controller.isPurchaseBusy}
          onAlreadyEntitled={controller.acceptExistingEntitlement}
          onDevSkipToHome={controller.devCompleteOnboarding}
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

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.background, flex: 1 },
});
