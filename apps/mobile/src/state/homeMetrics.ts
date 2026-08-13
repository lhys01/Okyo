import type { CompletedChallenge } from './useOkyoStore';
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
  completedChallenges: readonly CompletedChallenge[];
  recipesById: Record<string, CanonicalRecipe>;
  selectedDayKey?: string;
  totalMoneySaved: number;
  now?: Date;
};

const emptyCopy = 'Cook a meal to see this. Your totals will appear here.';

export function selectHomeMetrics(input: HomeMetricInput): Record<HomeMetricKind, HomeMetric> {
  const recipes = Object.values(input.recipesById).filter(isRealRecipe);
  const allCanonicalRecipes = Object.values(input.recipesById);
  const selectedDayKey = input.selectedDayKey ?? toLocalDateKey((input.now ?? new Date()).toISOString()) ?? '';
  return {
    savings: selectSavingsMetric(recipes, input.completedChallenges, input.totalMoneySaved, input.now ?? new Date()),
    macros: selectMacrosMetric(allCanonicalRecipes, selectedDayKey),
    health: selectHealthMetric(recipes),
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

export function getHomeActivityDates(recipesById: Record<string, CanonicalRecipe>): readonly string[] {
  return [...new Set(Object.values(recipesById).filter(isRealRecipe).flatMap((recipe) => (
    [recipe.scanCompletedAt, recipe.cookingCompletedAt, recipe.savedAt].filter((value): value is string => Boolean(value))
  )).map(toLocalDateKey).filter((value): value is string => Boolean(value)))];
}

function selectSavingsMetric(recipes: readonly CanonicalRecipe[], challenges: readonly CompletedChallenge[], totalMoneySaved: number, now: Date): HomeMetric {
  const monthlyChallenges = challenges.filter((challenge) => isSameMonth(challenge.completedAt, now));
  const completedRecipes = recipes.filter((recipe) => recipe.completionState === 'completed');
  const monthlyRecipes = completedRecipes.filter((recipe) => isSameMonth(recipe.cookingCompletedAt, now));
  const challengeSavings = sum(monthlyChallenges.map((challenge) => positive(challenge.moneySaved)));
  const recipeSavings = sum(monthlyRecipes.map((recipe) => positive(recipe.estimatedSavings)));
  const monthlySavings = challengeSavings > 0 ? challengeSavings : recipeSavings;
  const mealsMade = monthlyChallenges.length > 0 ? monthlyChallenges.length : monthlyRecipes.length;
  const available = mealsMade > 0 && monthlySavings > 0;
  const lifetime = Math.max(positive(totalMoneySaved), sum(challenges.map((challenge) => positive(challenge.moneySaved))));
  const average = mealsMade > 0 ? monthlySavings / mealsMade : 0;

  return available ? {
    accessibilityLabel: `Savings. ${formatDollars(monthlySavings)} estimated saved this month.`,
    available: true,
    caption: 'this month · estimated',
    kind: 'savings',
    label: 'Savings',
    // There is no user-defined savings target in the current product data.
    // A ring would imply one, so Savings intentionally uses an icon instead.
    progress: null,
    stats: [
      { label: 'meals made', value: String(mealsMade) },
      { label: 'avg saved', value: formatDollars(average) },
      { label: 'total saved', value: formatDollars(lifetime || monthlySavings) },
    ],
    value: formatDollars(monthlySavings),
  } : emptyMetric('savings', 'Savings', 'estimated savings');
}

export function selectCompletedMacrosForDay(
  recipes: readonly CanonicalRecipe[],
  selectedDayKey: string,
) {
  const completedRecipes = recipes.filter((recipe) => (
    recipe.completionState === 'completed' &&
    Boolean(recipe.cookingCompletedAt) &&
    toLocalDateKey(recipe.cookingCompletedAt!) === selectedDayKey
  ));
  const total = (key: 'calories' | 'proteinGrams' | 'carbohydratesGrams' | 'fatGrams') => (
    Math.round(sum(completedRecipes.map((recipe) => finiteOrZero(recipe.nutritionEstimate?.[key]))))
  );

  return {
    calories: total('calories'),
    carbs: total('carbohydratesGrams'),
    fat: total('fatGrams'),
    meals: completedRecipes.length,
    protein: total('proteinGrams'),
  };
}

function selectMacrosMetric(recipes: readonly CanonicalRecipe[], selectedDayKey: string): HomeMetric {
  const totals = selectCompletedMacrosForDay(recipes, selectedDayKey);
  return {
    accessibilityLabel: `Macros. ${totals.calories} calories from ${totals.meals} completed meal${totals.meals === 1 ? '' : 's'} today.`,
    available: totals.meals > 0,
    caption: 'calories today',
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

function selectHealthMetric(recipes: readonly CanonicalRecipe[]): HomeMetric {
  if (recipes.length === 0) return emptyMetric('health', 'Health', 'goal-friendly meals');
  const friendlier = recipes.filter((recipe) => (
    recipe.selectedPresentationMode === 'Healthier' ||
    recipe.selectedPresentationMode === 'More Protein' ||
    recipe.mode === 'Healthier' ||
    recipe.mode === 'More Protein'
  ));
  const completed = recipes.filter((recipe) => recipe.completionState === 'completed');
  return {
    accessibilityLabel: `Health. ${friendlier.length} goal-friendly Okyo meals.`,
    available: true,
    caption: 'goal-friendly meals · estimated',
    kind: 'health',
    label: 'Health',
    progress: Math.min(1, friendlier.length / Math.max(recipes.length, 1)),
    stats: [
      { label: 'healthier edits', value: String(friendlier.length) },
      { label: 'meals cooked', value: String(completed.length) },
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

function isSameMonth(value: string | undefined, now: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function toLocalDateKey(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
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
