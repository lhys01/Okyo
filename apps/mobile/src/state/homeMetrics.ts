import type { CompletedMeal } from './completedMeals';
import type { CanonicalRecipe } from './canonicalRecipes';
import type { PrimaryGoal } from '../onboarding-v3/state/personalizedOnboarding';

export type HomeMetricKind = 'savings' | 'macros' | 'health';

export type HomeMetricStat = { label: string; value: string; icon?: 'protein' | 'fat' | 'carbs' };
export type HomeMetric = {
  accessibilityLabel: string;
  available: boolean;
  caption: string;
  kind: HomeMetricKind;
  label: string;
  progress: number | null;
  stats: readonly HomeMetricStat[];
  value: string;
};

export type HomeMetricInput = {
  completedMeals: readonly CompletedMeal[];
  recipesById: Record<string, CanonicalRecipe>;
  selectedDayKey?: string;
  now?: Date;
};

const emptyCopy = 'Cook a meal to see this. Your totals will appear here.';

export function selectHomeMetrics(input: HomeMetricInput): Record<HomeMetricKind, HomeMetric> {
  const selectedDayKey = input.selectedDayKey ?? toLocalDateKey((input.now ?? new Date()).toISOString()) ?? '';
  const dayMeals = input.completedMeals.filter((meal) => toLocalDateKey(meal.completedAt) === selectedDayKey);
  const dayLabel = formatDayLabel(selectedDayKey);
  return {
    savings: selectSavingsMetric(dayMeals, dayLabel),
    macros: selectMacrosMetric(dayMeals, selectedDayKey, dayLabel),
    health: selectHealthMetric(dayMeals, dayLabel),
  };
}

export function getHomeMetricOrder(primaryGoal: PrimaryGoal | null): readonly HomeMetricKind[] {
  if (primaryGoal === 'hit_macros') return ['macros', 'savings'];
  return ['savings', 'macros'];
}

/** Compare calendar days in the user's local timezone. */
export function isFutureDateKey(selectedDateKey: string, now: Date = new Date()): boolean {
  return selectedDateKey > toDateKey(now);
}

export function getHomeActivityDates(recipesById: Record<string, CanonicalRecipe>, completedMeals: readonly CompletedMeal[] = []): readonly string[] {
  const recipeDates = Object.values(recipesById).filter(isRealRecipe).flatMap((recipe) => (
    [recipe.scanCompletedAt, recipe.cookingCompletedAt, recipe.savedAt].filter((value): value is string => Boolean(value))
  ));
  return [...new Set([...recipeDates, ...completedMeals.map((meal) => meal.completedAt)]
    .map(toLocalDateKey).filter((value): value is string => Boolean(value)))];
}

function selectSavingsMetric(dayMeals: readonly CompletedMeal[], dayLabel: string): HomeMetric {
  const daySavings = sum(dayMeals.map((meal) => nonNegative(meal.estimatedSavings)));
  const validSavingsMeals = dayMeals.filter((meal) => meal.estimatedSavings !== undefined);
  const mealsMade = dayMeals.length;
  const available = mealsMade > 0;
  const average = validSavingsMeals.length > 0 ? daySavings / validSavingsMeals.length : 0;

  return available ? {
    accessibilityLabel: `Savings. ${formatDollars(daySavings)} estimated saved on ${dayLabel}.`,
    available: true,
    caption: `${dayLabel} · estimated`,
    kind: 'savings',
    label: 'Savings',
    // There is no user-defined savings target in the current product data.
    // A ring would imply one, so Savings intentionally uses an icon instead.
    progress: null,
    stats: [
      { label: 'meals made', value: String(mealsMade) },
      { label: 'avg saved', value: formatDollars(average) },
      { label: 'total saved', value: formatDollars(daySavings) },
    ],
    value: formatDollars(daySavings),
  } : emptyMetric('savings', 'Savings', 'estimated savings');
}

export function selectCompletedMacrosForDay(
  meals: readonly CompletedMeal[],
  selectedDayKey: string,
) {
  const completedMeals = meals.filter((meal) => toLocalDateKey(meal.completedAt) === selectedDayKey);
  const total = (key: 'calories' | 'proteinGrams' | 'carbohydratesGrams' | 'fatGrams') => (
    Math.round(sum(completedMeals.map((meal) => finiteOrZero(meal[key]))))
  );

  return {
    calories: total('calories'),
    carbs: total('carbohydratesGrams'),
    fat: total('fatGrams'),
    meals: completedMeals.length,
    protein: total('proteinGrams'),
  };
}

function selectMacrosMetric(dayMeals: readonly CompletedMeal[], selectedDayKey: string, dayLabel: string): HomeMetric {
  const totals = selectCompletedMacrosForDay(dayMeals, selectedDayKey);
  return {
    accessibilityLabel: `Macros. ${totals.calories} calories from ${totals.meals} completed meal${totals.meals === 1 ? '' : 's'} on ${dayLabel}.`,
    available: totals.meals > 0,
    caption: `calories · ${dayLabel}`,
    kind: 'macros',
    label: 'Macros',
    // Protein is an average, not progress toward a persisted target.
    progress: null,
    stats: [
      { icon: 'protein', label: 'Protein', value: `${totals.protein}g` },
      { icon: 'fat', label: 'Fat', value: `${totals.fat}g` },
      { icon: 'carbs', label: 'Carbs', value: `${totals.carbs}g` },
    ],
    value: String(totals.calories),
  };
}

function selectHealthMetric(dayMeals: readonly CompletedMeal[], dayLabel: string): HomeMetric {
  if (dayMeals.length === 0) return emptyMetric('health', 'Health', 'goal-friendly meals');
  const friendlier = dayMeals.filter((meal) => meal.goalFriendly);
  const completed = dayMeals.length;
  return {
    accessibilityLabel: `Health. ${friendlier.length} goal-friendly Okyo meals on ${dayLabel}.`,
    available: true,
    caption: `goal-friendly meals · ${dayLabel}`,
    kind: 'health',
    label: 'Health',
    progress: Math.min(1, friendlier.length / dayMeals.length),
    stats: [
      { label: 'healthier edits', value: String(friendlier.length) },
      { label: 'meals cooked', value: String(completed) },
      { label: 'goal-friendly meals', value: String(friendlier.length) },
    ],
    value: String(friendlier.length),
  };
}

function emptyMetric(kind: HomeMetricKind, label: string, subject: string): HomeMetric {
  return {
    accessibilityLabel: `${label}. No ${subject} yet. ${emptyCopy}`,
    available: false,
    caption: emptyCopy,
    kind,
    label,
    progress: kind === 'health' ? 0 : null,
    stats: emptyStats(kind),
    // A day/month with zero activity has a real, honest value of zero —
    // not "unknown" — so this shows "$0" / "0g" / "0" rather than an em dash.
    value: emptyValue(kind),
  };
}

function emptyValue(kind: HomeMetricKind): string {
  if (kind === 'savings') return formatDollars(0);
  if (kind === 'macros') return '0';
  return '0';
}

function emptyStats(kind: HomeMetricKind): readonly HomeMetricStat[] {
  if (kind === 'savings') {
    return [
      { label: 'meals made', value: '0' },
      { label: 'avg saved', value: formatDollars(0) },
      { label: 'total saved', value: formatDollars(0) },
    ];
  }
  if (kind === 'macros') {
    return [
      { icon: 'protein', label: 'Protein', value: '0g' },
      { icon: 'fat', label: 'Fat', value: '0g' },
      { icon: 'carbs', label: 'Carbs', value: '0g' },
    ];
  }
  return [
    { label: 'healthier edits', value: '0' },
    { label: 'meals cooked', value: '0' },
    { label: 'goal-friendly meals', value: '0' },
  ];
}

function isRealRecipe(recipe: CanonicalRecipe): boolean {
  return recipe.origin === 'scan' || recipe.origin === 'description';
}

function toLocalDateKey(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'selected day';
}

function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function nonNegative(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function finiteOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function formatDollars(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}
