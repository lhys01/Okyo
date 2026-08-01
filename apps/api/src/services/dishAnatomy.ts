import type { Recipe, RecipeIngredient, RecipeIngredientGroup, RecipeStep } from '../types.js';

export const dishFamilies = [
  'filled_pastry', 'pastry', 'pasta', 'curry', 'stir_fry', 'sandwich', 'soup',
  'grain_bowl', 'roasted_protein', 'seafood', 'dessert', 'other',
] as const;

export type DishFamily = typeof dishFamilies[number];
export type DishComponentRole = 'base' | 'filling' | 'sauce' | 'topping' | 'protein' | 'side';

export type DishAnatomy = {
  dishFamily: DishFamily;
  primaryComponents: Array<{ role: DishComponentRole; description: string; confidence: number }>;
  uncertainComponents: string[];
};

export type DishContract = {
  anatomy: DishAnatomy;
  requiredComponents: Array<{
    role: DishComponentRole;
    description: string;
    requiredLeafTerms: string[];
    requiredStepTerms: string[];
  }>;
  requiredTitleTerms: string[];
  signatureKey?: string;
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

const component = (role: DishComponentRole, description: string, confidence: number) => ({ role, description, confidence });

function text(input: AnalysisLike): string {
  return [input.dishName, input.broadDishCategory, input.cuisine, input.mealDescription, ...input.visibleIngredients, ...input.likelyIngredients, ...Object.values(input.visibleComponents)].filter(Boolean).join(' ').toLowerCase();
}

function hasAny(value: string, terms: string[]): boolean { return terms.some((term) => value.includes(term)); }

const fillingEvidenceTerms = [
  'filling', 'filled', 'stuffed', 'jam', 'preserves', 'preserve', 'compote',
  'fruit puree', 'fruit purée', 'puree', 'purée', 'custard', 'chocolate',
  'pastry cream', 'cream-filled', 'cream filled', 'interior', 'inside',
];

const negatedFillingPattern = /\b(?:no|without)\s+(?:(?:filling|jam|cream|custard|chocolate)(?:\s+or\s+(?:filling|jam|cream|custard|chocolate))?)(?:\s+(?:inside|within|in\s+the\s+center|in\s+the\s+centre))?\b|\bnot\s+(?:cream|chocolate|custard|jam)?-?filled\b|\b(?:unfilled|not\s+filled|not\s+stuffed)\b|\bplain\s+(?:butter\s+)?croissant\b/gi;

export function getNegationAwareFillingText(input: AnalysisLike): { text: string; explicitlyUnfilled: boolean } {
  const value = text(input);
  const matches = value.match(negatedFillingPattern) ?? [];
  return {
    text: value.replace(negatedFillingPattern, ' '),
    explicitlyUnfilled: matches.length > 0,
  };
}

export function hasExplicitUnfilledPastry(input: AnalysisLike): boolean {
  const result = getNegationAwareFillingText(input);
  // A specific positive filling after a negated alternative wins, e.g.
  // "not cream-filled; it has plum jam inside."
  return result.explicitlyUnfilled && !hasAny(result.text, fillingEvidenceTerms);
}

function hasFillingEvidence(input: AnalysisLike): boolean {
  const value = text(input);
  const pastry = hasAny(value, ['croissant', 'turnover', 'danish', 'pastry']);
  if (!pastry) return false;
  const negationAware = getNegationAwareFillingText(input);
  if (hasAny(negationAware.text, fillingEvidenceTerms)) return true;
  if (negationAware.explicitlyUnfilled) return false;
  return hasAny(value, fillingEvidenceTerms) || /\b(?:fruit|berry|berries)\s+(?:inside|center|centre|filling)\b/i.test(value);
}

function bestFruit(input: AnalysisLike): { description: string; uncertain: boolean } | undefined {
  const value = [...input.visibleIngredients, ...input.likelyIngredients, ...Object.values(input.visibleComponents)].join(' ').toLowerCase();
  const fruit = value.match(/\b(strawberr(?:y|ies)|raspberr(?:y|ies)|blueberr(?:y|ies)|blackberr(?:y|ies)|apple|peach|apricot|cherry|plum|berry|berries|fruit)\b/i)?.[1];
  if (!fruit && !value.includes('fruit')) return undefined;
  const confident = Boolean(fruit && !['fruit', 'berry', 'berries'].includes(fruit.toLowerCase()) && input.confidence >= 0.75);
  return { description: confident ? fruit! : 'dark fruit', uncertain: !confident };
}

export function deriveDishAnatomy(input: AnalysisLike): DishAnatomy {
  const value = text(input);
  const components: DishAnatomy['primaryComponents'] = [];
  const uncertainComponents: string[] = [];
  const add = (role: DishComponentRole, description: string, confidence = input.confidence) => {
    if (!description || components.some((item) => item.role === role && item.description === description)) return;
    components.push(component(role, description, Math.max(0, Math.min(1, confidence))));
  };

  const fruit = bestFruit(input);
  const pastry = hasAny(value, ['croissant', 'turnover', 'danish', 'pastry']);
  const filledPastry = pastry && hasFillingEvidence(input);
  if (filledPastry) {
    add('base', value.includes('croissant') ? 'croissant pastry' : 'pastry');
    if (fruit) {
      add('filling', `${fruit.description} fruit filling`, fruit.uncertain ? Math.min(input.confidence, 0.55) : input.confidence);
      if (fruit.uncertain) uncertainComponents.push('fruit filling identity');
    } else {
      add('filling', 'visible pastry filling', Math.min(input.confidence, 0.55));
      uncertainComponents.push('filling identity');
    }
  } else if (hasAny(value, ['tiramisu'])) {
    add('base', 'ladyfingers'); add('filling', 'mascarpone cream'); add('topping', 'cocoa dusting');
  } else if (hasAny(value, ['shrimp scampi', 'scampi'])) {
    add('protein', 'shrimp'); add('sauce', 'garlic lemon butter or olive-oil sauce');
    add('topping', 'parsley or fresh herb');
  } else if (hasAny(value, ['chicken tikka masala', 'tikka masala'])) {
    add('protein', 'chicken'); add('sauce', 'spiced tomato cream sauce');
  } else {
    const visible = input.visibleComponents;
    if (visible.baseStarch) add('base', visible.baseStarch);
    if (visible.protein) add('protein', visible.protein);
    if (visible.sauce) add('sauce', visible.sauce);
    if (visible.vegetables) add('side', visible.vegetables);
    if (visible.toppingsGarnish) add('topping', visible.toppingsGarnish);
    if (components.length === 0 && input.visibleIngredients.length > 0) add('base', input.visibleIngredients[0]);
  }

  if (pastry && !filledPastry && !components.some((item) => item.role === 'base')) {
    add('base', value.includes('croissant') ? 'croissant pastry' : 'pastry');
  }

  let dishFamily: DishFamily = 'other';
  if (filledPastry) dishFamily = 'filled_pastry';
  else if (pastry) dishFamily = 'pastry';
  else if (hasAny(value, ['pasta', 'noodle', 'spaghetti', 'fettuccine'])) dishFamily = 'pasta';
  else if (hasAny(value, ['curry', 'tikka masala'])) dishFamily = 'curry';
  else if (hasAny(value, ['stir fry', 'stir-fry'])) dishFamily = 'stir_fry';
  else if (hasAny(value, ['sandwich', 'burger', 'wrap'])) dishFamily = 'sandwich';
  else if (hasAny(value, ['soup', 'stew'])) dishFamily = 'soup';
  else if (hasAny(value, ['bowl', 'rice bowl', 'grain bowl'])) dishFamily = 'grain_bowl';
  else if (hasAny(value, ['shrimp', 'scampi', 'seafood', 'salmon', 'fish'])) dishFamily = 'seafood';
  else if (hasAny(value, ['dessert', 'tiramisu', 'cake', 'cookie', 'sweet'])) dishFamily = 'dessert';
  else if (hasAny(value, ['roast', 'roasted', 'chicken', 'steak'])) dishFamily = 'roasted_protein';

  return { dishFamily, primaryComponents: components, uncertainComponents };
}

export function deriveDishContract(input: AnalysisLike, anatomy = deriveDishAnatomy(input)): DishContract {
  const value = text(input);
  const fillingLeafTerms = [
    'plum', 'cherry', 'strawberry', 'raspberry', 'blueberry', 'blackberry',
    'mixed berries', 'berry', 'fruit puree', 'fruit purée', 'jam', 'preserves',
    'compote', 'custard', 'cream', 'chocolate',
  ];
  const requiredComponents = anatomy.primaryComponents.map((item) => ({
    ...item,
    requiredLeafTerms: item.role === 'filling' ? fillingLeafTerms : item.description.split(/\s+/).filter((term) => term.length > 3),
    requiredStepTerms: item.role === 'filling' && anatomy.dishFamily === 'filled_pastry' ? ['fill', 'assemble'] : item.role === 'base' && anatomy.dishFamily === 'filled_pastry' ? ['bake'] : [],
  }));
  const requiredTitleTerms = anatomy.primaryComponents.filter((item) => item.role === 'filling').flatMap((item) => item.description.split(/\s+/).filter((term) => term.length > 3 && term !== 'filling'));
  return {
    anatomy,
    requiredComponents,
    requiredTitleTerms,
    signatureKey: hasAny(value, ['shrimp scampi', 'scampi']) ? 'shrimp_scampi' : hasAny(value, ['tiramisu']) ? 'tiramisu' : hasAny(value, ['chicken tikka masala', 'tikka masala']) ? 'chicken_tikka_masala' : hasAny(value, ['vegan bowl', 'vegan grain bowl']) ? 'vegan_bowl' : undefined,
  };
}

function ingredientText(ingredients: RecipeIngredient[], groups: RecipeIngredientGroup[] = []): string {
  return [...ingredients.map((item) => item.name), ...groups.flatMap((group) => group.items.map((item) => item.name))].join(' ').toLowerCase();
}

export function findDishContractIssues(contract: DishContract, recipe: Recipe | { title: string; ingredients: RecipeIngredient[]; ingredientGroups?: RecipeIngredientGroup[]; structuredSteps?: RecipeStep[]; steps?: string[] }): string[] {
  const issues: string[] = [];
  const ingredients = ingredientText(recipe.ingredients, recipe.ingredientGroups);
  const groups = recipe.ingredientGroups ?? [];
  const steps = [...(recipe.structuredSteps?.map((step) => `${step.title ?? ''} ${step.text} ${(step.ingredientsUsed ?? []).join(' ')}`) ?? []), ...(recipe.steps ?? [])].join(' ').toLowerCase();
  for (const required of contract.requiredComponents) {
    if (required.requiredLeafTerms.length > 0 && !required.requiredLeafTerms.some((term) => ingredients.includes(term.toLowerCase()))) issues.push(`missing_component:${required.role}`);
    if (required.role === 'filling' && groups.some((group) => /filling/i.test(group.component)) && groups.find((group) => /filling/i.test(group.component))?.items.length === 0) issues.push('empty_filling_group');
    if (required.requiredStepTerms.length > 0 && !required.requiredStepTerms.every((term) => steps.includes(term))) issues.push(`missing_component_step:${required.role}`);
  }
  if (contract.anatomy.dishFamily === 'filled_pastry' && !/bake|oven/i.test(steps)) issues.push('missing_baking_step');
  if ([...recipe.ingredients, ...groups.flatMap((group) => group.items)].some((item) => isPlaceholderIngredientName(item.name))) issues.push('non_leaf_component_ingredient');
  return [...new Set(issues)];
}

const placeholderIngredientNames = new Set([
  'filling', 'cooked filling', 'finished filling', 'finished dish',
  'prepared dish', 'croissant', 'dumplings',
]);

export function isPlaceholderIngredientName(name: string): boolean {
  const normalized = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\s*(?:\d+(?:\.\d+)?(?:\/\d+)?|[¼½¾⅓⅔⅛⅜⅝]|a|an|one|two|three|half|pinch|dash)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return placeholderIngredientNames.has(normalized) || /^(?:cooked|finished|prepared)(?:\s+[a-z]+){0,2}\s+filling$/.test(normalized);
}

export function makeTruthfulDishName(input: AnalysisLike, anatomy = deriveDishAnatomy(input)): string {
  if (anatomy.dishFamily === 'filled_pastry' && anatomy.uncertainComponents.length > 0) return 'Dark Fruit-Filled Croissant';
  return input.dishName;
}
