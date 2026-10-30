import { resolveCanonicalRecipe } from './canonicalRecipes';
import { readNotificationPreferences } from './notificationPreferences';
import { useOkyoStore } from './useOkyoStore';
import { syncCookingStepReminder } from '../utils/notifications';
import { buildGuidedCookingSteps } from '../utils/guidedCookingSteps';

async function runSync(): Promise<void> {
  const preferences = await readNotificationPreferences();
  const state = useOkyoStore.getState();
  const session = state.activeCookingSession;
  const recipe = session ? resolveCanonicalRecipe(state.recipesById, session.recipeId) : null;
  const step = recipe && session
    ? buildGuidedCookingSteps(recipe)[session.currentStepIndex]
    : undefined;
  const stepStartedAt = session ? Date.parse(session.lastUpdatedAt) : Number.NaN;
  const elapsedSeconds = Number.isFinite(stepStartedAt) ? Math.max(0, (Date.now() - stepStartedAt) / 1000) : 0;
  const remainingSeconds = step ? step.timing.elapsedMinutes * 60 - elapsedSeconds : undefined;

  await syncCookingStepReminder({
    enabled: preferences.allowNotifications && preferences.cookingTimers,
    stepTitle: step?.title,
    remainingSeconds,
  });
}

export function startCookingReminderSync(): () => void {
  let lastSession = useOkyoStore.getState().activeCookingSession;
  void runSync();

  return useOkyoStore.subscribe((state) => {
    if (state.activeCookingSession !== lastSession) {
      lastSession = state.activeCookingSession;
      void runSync();
    }
  });
}

export function resyncCookingReminderNow(): void {
  void runSync();
}
