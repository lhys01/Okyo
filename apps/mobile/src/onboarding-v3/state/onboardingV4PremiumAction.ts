import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Recipe, ScanResult } from '../../mocks';
import type { CanonicalRecipe } from '../../state/canonicalRecipes';
import { isUsableCanonicalRecipe } from '../../state/canonicalRecipes';

export const ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY = 'okyo:onboarding-v4-pending-premium-action:v1';

export type OnboardingV4PremiumActionType = 'cook' | 'customize';
export type OnboardingV4PremiumActionStatus =
  | 'pending_entitlement'
  | 'paywall'
  | 'dismissed'
  | 'executing'
  | 'result_ready'
  | 'destination_ready'
  | 'failed'
  | 'completed';

export type OnboardingV4PendingPremiumAction = {
  actionId: string;
  type: OnboardingV4PremiumActionType;
  recipeId: string;
  customizationText?: string;
  status: OnboardingV4PremiumActionStatus;
  createdAt: string;
  correctedRecipe?: Recipe;
  correctedScan?: ScanResult;
  errorMessage?: string;
};

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;

function isScanResult(value: unknown): value is ScanResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const scan = value as Partial<ScanResult>;
  return typeof scan.id === 'string' && Boolean(scan.id.trim()) && typeof scan.dishName === 'string';
}

export function normalizeOnboardingV4PendingPremiumAction(value: unknown): OnboardingV4PendingPremiumAction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<OnboardingV4PendingPremiumAction>;
  if (typeof candidate.actionId !== 'string' || !candidate.actionId.trim()) return null;
  if (candidate.type !== 'cook' && candidate.type !== 'customize') return null;
  if (typeof candidate.recipeId !== 'string' || !candidate.recipeId.trim()) return null;
  const statuses: OnboardingV4PremiumActionStatus[] = ['pending_entitlement', 'paywall', 'dismissed', 'executing', 'result_ready', 'destination_ready', 'failed', 'completed'];
  if (!statuses.includes(candidate.status as OnboardingV4PremiumActionStatus)) return null;
  if (typeof candidate.createdAt !== 'string' || !Number.isFinite(Date.parse(candidate.createdAt))) return null;
  const customizationText = typeof candidate.customizationText === 'string' ? candidate.customizationText.trim() : '';
  if (candidate.type === 'customize' && !customizationText) return null;
  const hasCorrectionPayload = isUsableCanonicalRecipe(candidate.correctedRecipe) && isScanResult(candidate.correctedScan);
  if (candidate.type === 'customize' && ['result_ready', 'destination_ready', 'completed'].includes(candidate.status!) && !hasCorrectionPayload) return null;
  const errorMessage = typeof candidate.errorMessage === 'string' && candidate.errorMessage.trim() ? candidate.errorMessage.trim() : undefined;
  return {
    actionId: candidate.actionId.trim(),
    type: candidate.type,
    recipeId: candidate.recipeId.trim(),
    ...(candidate.type === 'customize' ? { customizationText } : {}),
    status: candidate.status as OnboardingV4PremiumActionStatus,
    createdAt: candidate.createdAt,
    ...(hasCorrectionPayload ? { correctedRecipe: candidate.correctedRecipe, correctedScan: candidate.correctedScan } : {}),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

export function createOnboardingV4PremiumActionPersistence(storage: Storage) {
  return {
    async create(type: OnboardingV4PremiumActionType, recipeId: string, customizationText?: string) {
      const action = normalizeOnboardingV4PendingPremiumAction({
        actionId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        type,
        recipeId,
        customizationText,
        status: 'pending_entitlement',
        createdAt: new Date().toISOString(),
      });
      if (!action) throw new Error('Invalid premium action.');
      await storage.setItem(ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY, JSON.stringify(action));
      return action;
    },
    async read(): Promise<OnboardingV4PendingPremiumAction | null> {
      const raw = await storage.getItem(ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY);
      if (!raw) return null;
      try { return normalizeOnboardingV4PendingPremiumAction(JSON.parse(raw)); } catch { return null; }
    },
    async write(action: OnboardingV4PendingPremiumAction) {
      const normalized = normalizeOnboardingV4PendingPremiumAction(action);
      if (!normalized) throw new Error('Invalid premium action.');
      await storage.setItem(ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY, JSON.stringify(normalized));
      return normalized;
    },
    async clear() { await storage.removeItem(ONBOARDING_V4_PENDING_PREMIUM_ACTION_KEY); },
  };
}

export const onboardingV4PremiumActionPersistence = createOnboardingV4PremiumActionPersistence(AsyncStorage);

export function decideOnboardingV4PremiumAccess(entitlement: { status: 'loading' | 'unavailable' | 'error' | 'ready'; isEntitled?: boolean }): 'wait' | 'fail_closed' | 'paywall' | 'resume' {
  if (entitlement.status === 'loading') return 'wait';
  if (entitlement.status !== 'ready') return 'fail_closed';
  return entitlement.isEntitled === true ? 'resume' : 'paywall';
}

type PremiumActionPersistence = ReturnType<typeof createOnboardingV4PremiumActionPersistence>;
export type OnboardingV4CorrectionResult = { recipe: Recipe; scan: ScanResult };
export type OnboardingV4PremiumActionDependencies = {
  persistence: PremiumActionPersistence;
  getRecipe: (recipeId: string) => CanonicalRecipe | null;
  startCook: (recipe: CanonicalRecipe) => boolean;
  requestCorrection: (action: OnboardingV4PendingPremiumAction, recipe: CanonicalRecipe) => Promise<OnboardingV4CorrectionResult>;
  isCorrectionApplied: (action: OnboardingV4PendingPremiumAction, result: OnboardingV4CorrectionResult) => boolean;
  applyCorrection: (recipeId: string, result: OnboardingV4CorrectionResult) => boolean;
};

const executionLocks = new Map<string, Promise<OnboardingV4PendingPremiumAction>>();

function safeFailureMessage(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message : 'Okyo couldn’t finish that action. Try again.';
}

/**
 * Durable Step 10 transaction. The correction response is persisted before
 * canonical application, so a restart can compare its stable revision/scan
 * IDs and skip an update that already landed. Cook uses the same boundaries:
 * claim, establish the idempotent destination, then complete.
 */
export function resumeOnboardingV4PremiumAction(
  action: OnboardingV4PendingPremiumAction,
  dependencies: OnboardingV4PremiumActionDependencies,
): Promise<OnboardingV4PendingPremiumAction> {
  const existing = executionLocks.get(action.actionId);
  if (existing) return existing;
  const run = (async () => {
    let latest = await dependencies.persistence.read();
    if (!latest || latest.actionId !== action.actionId) throw new Error('The pending action is no longer available.');
    if (latest.status === 'completed') return latest;
    try {
      if (latest.type === 'cook') {
        if (latest.status !== 'destination_ready') latest = await dependencies.persistence.write({ ...latest, status: 'executing', errorMessage: undefined });
        const recipe = dependencies.getRecipe(latest.recipeId);
        if (!recipe) throw new Error('The free recipe is not available.');
        if (latest.status !== 'destination_ready') {
          if (!dependencies.startCook(recipe)) throw new Error('Okyo couldn’t restore Cook Mode for this recipe.');
          latest = await dependencies.persistence.write({ ...latest, status: 'destination_ready' });
        }
        return dependencies.persistence.write({ ...latest, status: 'completed' });
      }

      const recipe = dependencies.getRecipe(latest.recipeId);
      if (!recipe) throw new Error('The free recipe is not available.');
      let result = latest.correctedRecipe && latest.correctedScan
        ? { recipe: latest.correctedRecipe, scan: latest.correctedScan }
        : null;
      if (!result) {
        latest = await dependencies.persistence.write({ ...latest, status: 'executing', errorMessage: undefined });
        result = await dependencies.requestCorrection(latest, recipe);
        if (!isUsableCanonicalRecipe(result.recipe) || !isScanResult(result.scan)) throw new Error('Okyo returned an incomplete customization. Try again.');
        latest = await dependencies.persistence.write({ ...latest, status: 'result_ready', correctedRecipe: result.recipe, correctedScan: result.scan });
      }
      if (!dependencies.isCorrectionApplied(latest, result)) {
        if (!dependencies.applyCorrection(latest.recipeId, result)) throw new Error('Okyo couldn’t safely save that customization. Try again.');
      }
      latest = await dependencies.persistence.write({ ...latest, status: 'destination_ready' });
      return dependencies.persistence.write({ ...latest, status: 'completed' });
    } catch (error) {
      const failed = { ...latest, status: 'failed' as const, errorMessage: safeFailureMessage(error) };
      try { await dependencies.persistence.write(failed); } catch { /* preserve the last durable boundary */ }
      throw error;
    }
  })().finally(() => executionLocks.delete(action.actionId));
  executionLocks.set(action.actionId, run);
  return run;
}

export function isCompletedCustomizationDestinationReady(action: OnboardingV4PendingPremiumAction, recipe: CanonicalRecipe | null): boolean {
  return Boolean(
    action.type === 'customize' &&
    action.status === 'completed' &&
    recipe &&
    action.correctedRecipe &&
    action.correctedScan &&
    recipe.sourceRecipeId === action.correctedRecipe.id &&
    recipe.scanResult?.id === action.correctedScan.id,
  );
}

export function getCompletedCookRecovery(input: { storeHydrated: boolean; recipeExists: boolean; recipeCompleted: boolean; activeRecipeId: string | null; expectedRecipeId: string }): 'wait' | 'ready' | 'start' | 'meal_completed' | 'mismatch' | 'missing_recipe' {
  if (!input.storeHydrated) return 'wait';
  if (!input.recipeExists) return 'missing_recipe';
  if (input.activeRecipeId === input.expectedRecipeId) return 'ready';
  if (input.activeRecipeId) return 'mismatch';
  if (input.recipeCompleted) return 'meal_completed';
  return 'start';
}
