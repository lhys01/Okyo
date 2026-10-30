export type GoalBranch = 'save_money' | 'eat_healthier' | 'hit_macros';

/** Persisted, behavior-focused objective shared by the three preview branches. */
export type OnboardingGoal = Readonly<{
  goalBranch: GoalBranch;
  goalType: string;
  targetValue: number;
  targetUnit: string;
  startDate: string;
  targetDate: string;
  durationDays?: number;
  weeklyTarget?: number;
  displayTitle: string;
  estimatedWeeklySavingsCents?: number;
}>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addLocalDays(startDate: string, days: number): string {
  const [year, month, day] = startDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Math.max(0, Math.round(days)));
  return localDateKey(date);
}

export function formatGoalDate(dateKey: string): string {
  if (!DATE_KEY.test(dateKey)) return dateKey;
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day));
}

export function normalizeOnboardingGoal(value: unknown): OnboardingGoal | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<OnboardingGoal>;
  if (raw.goalBranch !== 'save_money' && raw.goalBranch !== 'eat_healthier' && raw.goalBranch !== 'hit_macros') return null;
  if (typeof raw.goalType !== 'string' || typeof raw.targetValue !== 'number' || !Number.isFinite(raw.targetValue) || raw.targetValue <= 0) return null;
  if (typeof raw.targetUnit !== 'string' || typeof raw.startDate !== 'string' || !DATE_KEY.test(raw.startDate) || typeof raw.targetDate !== 'string' || !DATE_KEY.test(raw.targetDate)) return null;
  if (typeof raw.displayTitle !== 'string' || !raw.displayTitle.trim()) return null;
  return {
    goalBranch: raw.goalBranch,
    goalType: raw.goalType,
    targetValue: raw.targetValue,
    targetUnit: raw.targetUnit,
    startDate: raw.startDate,
    targetDate: raw.targetDate,
    ...(typeof raw.durationDays === 'number' && raw.durationDays > 0 ? { durationDays: raw.durationDays } : {}),
    ...(typeof raw.weeklyTarget === 'number' && raw.weeklyTarget > 0 ? { weeklyTarget: raw.weeklyTarget } : {}),
    displayTitle: raw.displayTitle.trim(),
    ...(typeof raw.estimatedWeeklySavingsCents === 'number' && raw.estimatedWeeklySavingsCents > 0 ? { estimatedWeeklySavingsCents: raw.estimatedWeeklySavingsCents } : {}),
  };
}

export function createSavingsGoal(amountCents: number, weeklySavingsCents: number, startDate = localDateKey()): OnboardingGoal {
  const safeWeekly = Math.min(100_000, Math.max(2_000, Math.round(weeklySavingsCents)));
  const durationDays = Math.max(1, Math.ceil((Math.max(1, amountCents) / safeWeekly) * 7));
  return {
    goalBranch: 'save_money', goalType: 'savings', targetValue: Math.max(1, amountCents), targetUnit: 'usd_cents',
    startDate, targetDate: addLocalDays(startDate, durationDays), durationDays,
    displayTitle: `Save $${Math.round(amountCents / 100).toLocaleString()}`,
    weeklyTarget: safeWeekly, estimatedWeeklySavingsCents: safeWeekly,
  };
}

export function createHealthGoal(title: string, targetValue: number, durationDays: number, startDate = localDateKey(), targetUnit: 'meal_per_day' | 'meals_per_week' | 'takeout_meals_per_week' | 'change_per_day' | 'custom' = 'meal_per_day'): OnboardingGoal {
  return {
    goalBranch: 'eat_healthier', goalType: 'healthier_meals', targetValue, targetUnit,
    startDate, targetDate: addLocalDays(startDate, durationDays), durationDays, displayTitle: title,
  };
}

export function createMacrosGoal(daysPerWeek: number, durationWeeks: number, startDate = localDateKey()): OnboardingGoal {
  return {
    goalBranch: 'hit_macros', goalType: 'macro_adherence', targetValue: daysPerWeek, targetUnit: 'days_per_week',
    startDate, targetDate: addLocalDays(startDate, durationWeeks * 7), durationDays: durationWeeks * 7, weeklyTarget: daysPerWeek,
    displayTitle: `Hit your macro plan ${daysPerWeek} days a week for ${durationWeeks} weeks`,
  };
}
