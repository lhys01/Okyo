import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useOkyoStore } from '../state/useOkyoStore';
import { colors } from '../theme/okyoTheme';
import { useOnboardingV3Controller } from './controller/useOnboardingV3Controller';
import { AnalyzingScreen } from './screens/AnalyzingScreen';
import { CookingCompleteScreen } from './screens/CookingCompleteScreen';
import { OnboardingCookingScreen } from './screens/OnboardingCookingScreen';
import { OnboardingPaywallScreen } from './screens/OnboardingPaywallScreen';
import { OnboardingRecipePreview } from './screens/OnboardingRecipePreview';
import { NameFoxScreen } from './screens/NameFoxScreen';
import { PhotoConfirmScreen } from './screens/PhotoConfirmScreen';
import { PersonalizedOnboardingScreen } from './screens/PersonalizedOnboardingScreen';
import { ScanInputScreen } from './screens/ScanInputScreen';
import { SplashScreen } from './screens/SplashScreen';
import { ShowcasePager } from './showcase/ShowcasePager';

export function OnboardingV3({ appStartedAt, fontsLoaded }: { appStartedAt: number; fontsLoaded: boolean }) {
  const controller = useOnboardingV3Controller();
  const { state } = controller;
  const recipe = useOkyoStore((store) => state.recipeId ? store.recipesById[state.recipeId] ?? null : null);
  const activeCookingSession = useOkyoStore((store) => store.activeCookingSession);
  const [showcasePage, setShowcasePage] = useState(controller.showcaseInitialPage);

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
}

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.background, flex: 1 },
});
