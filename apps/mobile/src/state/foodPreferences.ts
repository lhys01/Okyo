import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export const FOOD_PREFERENCES_STORAGE_KEY = 'okyo:dietary:v1';

export type FoodPreferences = {
  allergies: string[];
  restrictions: string[];
  avoidances: string[];
  dislikes: string[];
};

export const EMPTY_FOOD_PREFERENCES: FoodPreferences = Object.freeze({
  allergies: [], restrictions: [], avoidances: [], dislikes: [],
});

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
const listeners = new Set<(preferences: FoodPreferences) => void>();

export function normalizeFoodPreferences(value: unknown): FoodPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_FOOD_PREFERENCES };
  const candidate = value as Partial<FoodPreferences> & { restrictions?: unknown; dislikes?: unknown };
  const legacyRestrictions = normalizeList(candidate.restrictions);
  const explicitAllergies = normalizeList(candidate.allergies);
  const migratedAllergies = legacyRestrictions.filter((item) => /\ballerg(?:y|ic)\b/i.test(item));
  return {
    allergies: unique([...explicitAllergies, ...migratedAllergies.map(stripAllergySuffix)]),
    restrictions: legacyRestrictions.filter((item) => !/\ballerg(?:y|ic)\b/i.test(item)),
    avoidances: normalizeList(candidate.avoidances),
    dislikes: normalizeList(candidate.dislikes),
  };
}

export function createFoodPreferencesPersistence(storage: Storage) {
  return {
    async read(): Promise<FoodPreferences> {
      const raw = await storage.getItem(FOOD_PREFERENCES_STORAGE_KEY);
      if (!raw) return { ...EMPTY_FOOD_PREFERENCES };
      try { return normalizeFoodPreferences(JSON.parse(raw)); } catch { return { ...EMPTY_FOOD_PREFERENCES }; }
    },
    async write(value: FoodPreferences): Promise<FoodPreferences> {
      const normalized = normalizeFoodPreferences(value);
      await storage.setItem(FOOD_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
      listeners.forEach((listener) => listener(normalized));
      return normalized;
    },
    async clear() { await storage.removeItem(FOOD_PREFERENCES_STORAGE_KEY); listeners.forEach((listener) => listener({ ...EMPTY_FOOD_PREFERENCES })); },
  };
}

export const foodPreferencesPersistence = createFoodPreferencesPersistence(AsyncStorage);

export function useFoodPreferences() {
  const [preferences, setPreferences] = useState<FoodPreferences | null>(null);
  const reload = useCallback(async () => setPreferences(await foodPreferencesPersistence.read()), []);
  useEffect(() => {
    const listener = (next: FoodPreferences) => setPreferences(next);
    listeners.add(listener);
    void reload();
    return () => { listeners.delete(listener); };
  }, [reload]);
  const save = useCallback(async (next: FoodPreferences) => {
    const saved = await foodPreferencesPersistence.write(next);
    setPreferences(saved);
    return saved;
  }, []);
  return { preferences, reload, save };
}

export function toApiFoodPreferences(preferences: FoodPreferences) {
  return {
    dietaryRestrictions: unique([...preferences.allergies, ...preferences.restrictions]),
    dietaryDislikes: unique([...preferences.avoidances, ...preferences.dislikes]),
  };
}

export type FoodPreferenceConflict = { category: 'allergy' | 'restriction' | 'avoidance' | 'dislike'; preference: string; ingredient: string };

export function findFoodPreferenceConflicts(ingredientNames: readonly string[], preferences: FoodPreferences): FoodPreferenceConflict[] {
  const groups: Array<[FoodPreferenceConflict['category'], string[]]> = [
    ['allergy', preferences.allergies], ['restriction', preferences.restrictions],
    ['avoidance', preferences.avoidances], ['dislike', preferences.dislikes],
  ];
  const conflicts: FoodPreferenceConflict[] = [];
  for (const ingredient of ingredientNames) {
    const normalizedIngredient = normalizeIngredient(ingredient);
    for (const [category, values] of groups) {
      for (const preference of values) {
        if (matchesPreference(normalizedIngredient, preference)) conflicts.push({ category, preference, ingredient });
      }
    }
  }
  return conflicts.filter((item, index) => conflicts.findIndex((other) => other.category === item.category && other.preference.toLowerCase() === item.preference.toLowerCase()) === index);
}

function matchesPreference(ingredient: string, preference: string) {
  const terms = allergenTerms(preference);
  return terms.some((term) => ingredient.includes(term));
}

function allergenTerms(value: string): string[] {
  const normalized = normalizeIngredient(value);
  const aliases: Record<string, string[]> = {
    'milk dairy': ['milk', 'dairy', 'cream', 'butter', 'cheese', 'whey', 'casein'],
    dairy: ['milk', 'dairy', 'cream', 'butter', 'cheese', 'whey', 'casein'],
    eggs: ['egg', 'mayonnaise', 'mayo'],
    wheat: ['wheat', 'flour', 'bread', 'pasta'],
    gluten: ['gluten', 'wheat', 'flour', 'bread', 'pasta'],
    shellfish: ['shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster'],
    fish: ['fish', 'salmon', 'tuna', 'cod', 'anchovy', 'tilapia'],
    'tree nuts': ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia'],
    peanuts: ['peanut'],
    soy: ['soy', 'tofu', 'tempeh', 'edamame'],
    sesame: ['sesame', 'tahini'],
    vegan: ['beef', 'pork', 'chicken', 'turkey', 'fish', 'shrimp', 'egg', 'milk', 'cream', 'butter', 'cheese', 'honey'],
    vegetarian: ['beef', 'pork', 'chicken', 'turkey', 'fish', 'shrimp', 'anchovy'],
    pescatarian: ['beef', 'pork', 'chicken', 'turkey'],
  };
  return aliases[normalized] ?? [normalized.replace(/\bfree\b/g, '').replace(/\bvegetarian\b|\bvegan\b|\bpescatarian\b|\bhalal\b|\bkosher\b|\blow carb\b|\bketo\b/g, '').trim()].filter(Boolean);
}

function normalizeIngredient(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function stripAllergySuffix(value: string) { return value.replace(/\s+allerg(?:y|ic)$/i, '').trim(); }
function normalizeList(value: unknown): string[] { return Array.isArray(value) ? unique(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)).slice(0, 30) : []; }
function unique(values: string[]) { return [...new Set(values.map((item) => item.trim()).filter(Boolean))]; }
