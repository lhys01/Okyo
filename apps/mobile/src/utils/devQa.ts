import { sampleFoodImageUrls } from '../data/sampleFoodImages';
import { recommendedRecipes } from '../data/recommendedRecipes';
import { defaultScanResult, getSafeRecipeForMode } from '../mocks';
import { useOkyoStore } from '../state/useOkyoStore';

export type DevQaScreen =
  | 'analysis'
  | 'analysis-timeout'
  | 'completion'
  | 'grocery'
  | 'grocery-empty'
  | 'home'
  | 'home-empty'
  | 'onboarding'
  | 'recipe'
  | 'result'
  | 'result-error'
  | 'saved'
  | 'saved-empty'
  | 'settings'
  | 'share'
  | 'steps';

const allowedScreens = new Set<DevQaScreen>([
  'analysis',
  'analysis-timeout',
  'completion',
  'grocery',
  'grocery-empty',
  'home',
  'home-empty',
  'onboarding',
  'recipe',
  'result',
  'result-error',
  'saved',
  'saved-empty',
  'settings',
  'share',
  'steps',
]);

export const devQaScreen = getDevQaScreen();

export function seedDevQaState(screen: DevQaScreen) {
  const state = useOkyoStore.getState();
  const mode = state.selectedMode;
  const needsSavedRecipes = screen === 'grocery' || screen === 'saved';
  const needsSuccessfulScan = ['completion', 'home', 'recipe', 'result', 'share', 'steps'].includes(screen);

  state.clearSavedData();

  if (screen === 'onboarding') {
    state.resetOnboarding();
    return;
  }

  if (needsSavedRecipes) {
    recommendedRecipes.slice(0, 4).forEach((recipe) => state.saveRecipe(recipe));
  }

  if (screen === 'analysis' || screen === 'analysis-timeout') {
    state.beginLatestScanSession({
      scanSessionId: `dev-qa-${screen}-v1`,
      latestScanStatus: 'pending',
      latestScanFailure: null,
      latestScanResult: null,
      latestScanRecipe: null,
      selectedScanImage: {
        mimeType: 'image/jpeg',
        placeholder: false,
        source: 'mock',
        uri: sampleFoodImageUrls.pasta,
      },
      latestAiDebugMetadata: null,
      source: 'mock',
      reason: 'devQa.analysis',
    });
    return;
  }

  if (screen === 'result-error') {
    state.beginLatestScanSession({
      scanSessionId: 'dev-qa-result-error-v1',
      latestScanStatus: 'failed',
      latestScanFailure: {
        status: 'failed',
        rejectionReason: 'The food analysis service did not return a trusted result.',
        rejectionType: 'ai_failed',
      },
      latestScanResult: null,
      latestScanRecipe: null,
      selectedScanImage: {
        mimeType: 'image/jpeg',
        placeholder: false,
        source: 'mock',
        uri: sampleFoodImageUrls.pasta,
      },
      latestAiDebugMetadata: null,
      source: 'mock',
      reason: 'devQa.resultError',
    });
    return;
  }

  if (needsSuccessfulScan) {
    state.beginLatestScanSession({
      scanSessionId: `dev-qa-${screen}-v1`,
      latestScanStatus: 'success',
      latestScanFailure: null,
      latestScanResult: defaultScanResult,
      latestScanRecipe: getSafeRecipeForMode(mode),
      selectedScanImage: { placeholder: true, source: 'mock' },
      latestAiDebugMetadata: {
        aiSource: 'mock_ai',
        confidence: defaultScanResult.confidence,
        fallbackReason: `dev_qa_${screen}`,
      },
      source: 'mock',
      reason: `devQa.${screen}`,
    });
  }
}

function getDevQaScreen(): DevQaScreen | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return null;
  }

  const value = process.env.EXPO_PUBLIC_OKYO_QA_SCREEN;
  return value && allowedScreens.has(value as DevQaScreen) ? value as DevQaScreen : null;
}
