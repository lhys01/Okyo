export type ActiveCookingSession = {
  recipeId: string;
  recipeRevisionId: string;
  currentStepIndex: number;
  totalStepCount: number;
  startedAt: string;
  lastUpdatedAt: string;
  completionStatus: 'active';
};

export function createActiveCookingSession(
  recipeId: string,
  recipeRevisionId: string,
  totalStepCount: number,
  now = new Date().toISOString(),
): ActiveCookingSession {
  return {
    recipeId,
    recipeRevisionId,
    currentStepIndex: 0,
    totalStepCount: Math.max(0, Math.floor(totalStepCount)),
    startedAt: now,
    lastUpdatedAt: now,
    completionStatus: 'active',
  };
}

export function updateActiveCookingSession(
  session: ActiveCookingSession,
  currentStepIndex: number,
  totalStepCount: number,
  now = new Date().toISOString(),
): ActiveCookingSession {
  const safeTotal = Math.max(0, Math.floor(totalStepCount || session.totalStepCount));
  return {
    ...session,
    currentStepIndex: Math.max(0, Math.min(Math.floor(currentStepIndex), Math.max(0, safeTotal - 1))),
    totalStepCount: safeTotal,
    lastUpdatedAt: now,
  };
}

export function canStartCookingSession(session: ActiveCookingSession | null, recipeId: string) {
  return !session || session.recipeId === recipeId;
}

export function resolveActiveCookingStep<T>(steps: readonly T[], currentStepIndex: number): T | undefined {
  if (steps.length === 0) return undefined;
  const safeIndex = Math.max(0, Math.min(Math.floor(currentStepIndex), steps.length - 1));
  return steps[safeIndex];
}

export function clearActiveCookingSession(session: ActiveCookingSession | null, recipeId: string): ActiveCookingSession | null {
  return session?.recipeId === recipeId ? null : session;
}

export function isActiveCookingSession(value: unknown): value is ActiveCookingSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as Partial<ActiveCookingSession>;
  return typeof session.recipeId === 'string' &&
    session.recipeId.length > 0 &&
    typeof session.recipeRevisionId === 'string' &&
    typeof session.currentStepIndex === 'number' &&
    typeof session.totalStepCount === 'number' &&
    typeof session.startedAt === 'string' &&
    typeof session.lastUpdatedAt === 'string' &&
    session.completionStatus === 'active';
}
