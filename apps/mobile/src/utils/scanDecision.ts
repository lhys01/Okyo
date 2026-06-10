import type { CreateScanResult, ScanStatus } from '../api/types';
import type { Recipe, ScanResult, ScanState } from '../mocks';

const foodScanStates = new Set<ScanState>([
  'clear_food',
  'food_present_uncertain_dish',
  'partial_food',
]);

type ScanDecisionInput = {
  latestScanRecipe?: Recipe | null;
  recipes?: Recipe[] | null;
  result?: Partial<CreateScanResult> | null;
  scan?: Partial<ScanResult> | null;
  status?: ScanStatus | 'pending' | null;
};

export function isFoodScanState(scanState: string | null | undefined) {
  return scanState === 'clear_food' ||
    scanState === 'food_present_uncertain_dish' ||
    scanState === 'partial_food';
}

export function hasFoodEvidence(input: ScanDecisionInput) {
  const result = input.result;
  const scan = input.scan ?? result?.scan;
  const scanState = scan?.scanState ?? result?.scanState;
  const recipes = input.recipes ?? result?.recipes ?? [];

  return Boolean(
    isFoodScanState(scanState) ||
    getUsefulText(scan?.dishName) ||
    getUsefulText(scan?.bestGuessDishName) ||
    getUsefulText(getUnknownField(result, 'dishName')) ||
    getUsefulText(getUnknownField(result, 'dishCategory')) ||
    getUsefulText(getUnknownField(result, 'broadDishCategory')) ||
    hasUsefulList(getUnknownField(result, 'visibleIngredients')) ||
    hasUsefulComponents(getUnknownField(result, 'visibleComponents')) ||
    recipes.length > 0 ||
    result?.recipe ||
    input.latestScanRecipe
  );
}

export function isUsableScan(input: ScanDecisionInput) {
  const result = input.result;
  const status = input.status ?? result?.status ?? null;
  const scan = input.scan ?? result?.scan;
  const recipes = input.recipes ?? result?.recipes ?? [];
  const foodEvidence = hasFoodEvidence({ ...input, recipes, scan });

  if (status === 'success') {
    return true;
  }

  if (status === 'partial' && foodEvidence) {
    return true;
  }

  return Boolean(
    foodEvidence &&
    (
      scan ||
      recipes.length > 0 ||
      result?.recipe ||
      input.latestScanRecipe
    )
  );
}

export function shouldRejectScan(input: ScanDecisionInput) {
  const result = input.result;
  const status = input.status ?? result?.status ?? null;
  const scanState = input.scan?.scanState ?? result?.scan?.scanState ?? result?.scanState;
  const foodEvidence = hasFoodEvidence(input);

  return Boolean(
    !foodEvidence &&
    (
      scanState === 'not_food' ||
      result?.rejectionType === 'not_food' ||
      status === 'rejected'
    )
  );
}

export function shouldRetryScan(input: ScanDecisionInput) {
  const result = input.result;
  const status = input.status ?? result?.status ?? null;
  const scanState = input.scan?.scanState ?? result?.scan?.scanState ?? result?.scanState;
  const foodEvidence = hasFoodEvidence(input);

  return Boolean(
    !foodEvidence &&
    (
      scanState === 'too_unclear' ||
      status === 'failed' ||
      result?.rejectionType === 'ai_failed' ||
      result?.rejectionType === 'unclear_image'
    )
  );
}

function getUsefulText(value: unknown) {
  return typeof value === 'string' &&
    value.trim().length > 0 &&
    !['unknown', 'unknown dish', 'unclear dish', 'not food'].includes(value.trim().toLowerCase());
}

function hasUsefulList(value: unknown) {
  return Array.isArray(value) && value.some(getUsefulText);
}

function hasUsefulComponents(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const componentKeys = [
    'protein',
    'sauce',
    'baseStarch',
    'base',
    'starch',
    'vegetables',
    'toppingsGarnish',
    'toppings',
    'garnish',
    'cookingMethod',
  ];
  const record = value as Record<string, unknown>;
  return componentKeys.some((key) => getUsefulText(record[key]));
}

function getUnknownField(value: unknown, key: string) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}
