import { deriveDishAnatomy, hasExplicitUnfilledPastry } from './dishAnatomy.js';

export type FlavorPlan = {
  aromatics: Array<{ ingredient: string; quantity: string; stage: string }>;
  coreSeasonings: Array<{ ingredient: string; quantity: string; purpose: string; stage: string }>;
  balancingElements: Array<{ ingredient: string; role: 'acid' | 'sweetness' | 'salt' | 'richness' | 'heat' | 'umami'; quantity: string; stage: string }>;
  finishingElements: Array<{ ingredient: string; quantity: string; stage: string }>;
};

type AnalysisLike = {
  dishName: string;
  broadDishCategory: string;
  cuisine: string;
  confidence: number;
  visibleIngredients: string[];
  likelyIngredients: string[];
  visibleComponents: Record<string, string>;
  mealDescription?: string;
};

const emptyPlan = (): FlavorPlan => ({ aromatics: [], coreSeasonings: [], balancingElements: [], finishingElements: [] });
const has = (value: string, terms: string[]) => terms.some((term) => value.includes(term));

export function deriveFlavorPlan(input: AnalysisLike): FlavorPlan {
  const value = [input.dishName, input.broadDishCategory, input.cuisine, input.mealDescription, ...input.visibleIngredients, ...input.likelyIngredients].filter(Boolean).join(' ').toLowerCase();
  const plan = emptyPlan();
  if (hasExplicitUnfilledPastry(input) || deriveDishAnatomy(input).dishFamily === 'pastry') return plan;
  const addCore = (ingredient: string, quantity: string, purpose: string, stage: string) => plan.coreSeasonings.push({ ingredient, quantity, purpose, stage });
  const addBalance = (ingredient: string, role: FlavorPlan['balancingElements'][number]['role'], quantity: string, stage: string) => plan.balancingElements.push({ ingredient, role, quantity, stage });

  if (has(value, ['tiramisu'])) {
    plan.aromatics.push({ ingredient: 'vanilla extract', quantity: '1 tsp', stage: 'whisking the mascarpone cream' });
    addCore('espresso or strong coffee', '1 cup', 'soak the ladyfingers', 'before assembly');
    plan.finishingElements.push({ ingredient: 'unsweetened cocoa powder', quantity: '2 tbsp', stage: 'dusting before serving' });
  } else if (has(value, ['croissant', 'danish', 'pastry'])) {
    if (has(value, ['fruit', 'berry', 'cherry', 'plum', 'apple', 'peach'])) addBalance('lemon juice', 'acid', '1 tsp', 'cooking the fruit filling');
    if (has(value, ['fruit', 'berry', 'cherry', 'plum', 'apple', 'peach'])) addBalance('granulated sugar', 'sweetness', '2 tbsp', 'cooking the fruit filling');
    plan.finishingElements.push({ ingredient: 'powdered sugar', quantity: '1 tbsp', stage: 'dusting after baking' });
  } else if (has(value, ['shrimp scampi', 'scampi'])) {
    plan.aromatics.push({ ingredient: 'garlic', quantity: '3 cloves', stage: 'sautéing before the sauce' });
    addCore('black pepper', '1/4 tsp', 'add gentle warmth', 'seasoning the shrimp');
    addBalance('lemon juice', 'acid', '2 tbsp', 'finishing the sauce');
    addBalance('butter or olive oil', 'richness', '2 tbsp', 'emulsifying the sauce');
    plan.finishingElements.push({ ingredient: 'parsley', quantity: '2 tbsp', stage: 'folding in off heat' });
  } else if (has(value, ['tikka masala', 'curry'])) {
    plan.aromatics.push({ ingredient: 'onion', quantity: '1 medium', stage: 'sautéing until softened' }, { ingredient: 'garlic', quantity: '3 cloves', stage: 'sautéing with the aromatics' });
    addCore('ground cumin', '1 tsp', 'earthy base note', 'blooming with the aromatics');
    addCore('garam masala', '1 tsp', 'warm Indian spice profile', 'blooming before the tomato');
    addCore('ground coriander', '1 tsp', 'citrusy depth', 'blooming before the tomato');
    addBalance('plain yogurt or heavy cream', 'richness', '1/2 cup', 'rounding out the sauce');
    plan.finishingElements.push({ ingredient: 'cilantro', quantity: '2 tbsp', stage: 'garnishing at the end' });
  } else if (has(value, ['dessert', 'cake', 'cookie', 'sweet'])) {
    plan.aromatics.push({ ingredient: 'vanilla extract', quantity: '1 tsp', stage: 'mixing the batter' });
    addBalance('granulated sugar', 'sweetness', '1/2 cup', 'mixing the batter');
  }

  return trimFlavorPlan(plan);
}

export function trimFlavorPlan(plan: FlavorPlan): FlavorPlan {
  const all = [...plan.aromatics, ...plan.coreSeasonings, ...plan.balancingElements, ...plan.finishingElements];
  const seen = new Set<string>();
  const allowed = new Set(all.slice(0, 5).map((item) => item.ingredient.toLowerCase()));
  const keep = <T extends { ingredient: string }>(items: T[]) => items.filter((item) => {
    const key = item.ingredient.toLowerCase();
    if (seen.has(key) || !allowed.has(key)) return false;
    seen.add(key); return true;
  });
  return { aromatics: keep(plan.aromatics), coreSeasonings: keep(plan.coreSeasonings), balancingElements: keep(plan.balancingElements), finishingElements: keep(plan.finishingElements) };
}

export function flavorPlanPrompt(plan: FlavorPlan): string {
  const entries = [...plan.aromatics, ...plan.coreSeasonings, ...plan.balancingElements, ...plan.finishingElements];
  if (entries.length === 0) return 'FLAVOR PLAN: Use only the dish-appropriate flavor system visible or implied by the dish; do not add random spices.';
  return `FLAVOR PLAN (2-5 deliberate elements; every listed ingredient must appear in ingredients and an instruction): ${JSON.stringify(plan)}`;
}

export function findFlavorPlanIssues(plan: FlavorPlan, ingredients: string[], steps: string[]): string[] {
  const ingredientText = ingredients.join(' ').toLowerCase();
  const stepText = steps.join(' ').toLowerCase();
  return [...new Set([...plan.aromatics, ...plan.coreSeasonings, ...plan.balancingElements, ...plan.finishingElements].flatMap((item) => {
    const issues: string[] = [];
    const alternatives = item.ingredient.toLowerCase().split(/\s+or\s+/).map((value) => value.trim());
    if (!alternatives.some((alternative) => ingredientText.includes(alternative))) issues.push(`flavor_missing_ingredient:${item.ingredient}`);
    if (!alternatives.some((alternative) => stepText.includes(alternative))) issues.push(`flavor_unused:${item.ingredient}`);
    return issues;
  }))];
}
