import type { Recipe, RecipeIngredient, RecipeStep } from '../mocks';
import { getRecipeStepTiming, type RecipeStepTiming } from './recipeIntegrity';

export type GuidedCookingStep = {
  chefTip?: string;
  estimatedMinutes: number | null;
  timing: RecipeStepTiming;
  elapsedMinutes?: number;
  ingredientsUsed: RecipeIngredient[];
  instruction: string;
  phase: string;
  phaseStepIndex: number;
  phaseStepCount: number;
  why?: string;
  commonMistake?: string;
  commonQuestion?: string;
  commonQuestionAnswer?: string;
  decisionPoint?: string;
  ifYes?: string;
  ifNo?: string;
  doneWhen?: string;
  safetyNote?: string;
  stepNumber: number;
  tip?: { title: string; body: string };
  title: string;
  toolsUsed: string[];
  visualCue?: string;
};

type DisplayRecipeStep = {
  phase?: number;
  title?: string;
  text: string;
  lookFor?: string;
  doneWhen?: string;
  chefTip?: string;
  ingredientsUsed?: string[];
  toolsUsed?: string[];
  why?: string;
  commonMistake?: string;
  commonQuestion?: string;
  commonQuestionAnswer?: string;
  decisionPoint?: string;
  ifYes?: string;
  ifNo?: string;
  estimatedMinutes?: number;
  activeMinutes?: number;
  passiveMinutes?: number;
  elapsedMinutes?: number;
  timeEstimate?: string;
  visualCue?: string;
  safetyNote?: string;
  flavorBoost?: string;
  cookingTerm?: NonNullable<Recipe['cookingTerms']>[number];
};

const GENERIC_WHY_TEXTS = new Set([
  'A flexible starter keeps the result useful without pretending to know the exact restaurant recipe.',
  'This step is important for the final dish.',
  'This ensures the best result.',
  'This is a key step in the recipe.',
  'This helps the dish come together.',
  'This step matters for the overall dish.',
  'Proper technique here improves the final result.',
]);

const RECIPE_PHASE_NAMES: Record<number, string> = {
  1: 'Preparation', 2: 'Setup', 3: 'Cooking', 4: 'Assembly', 5: 'Finishing', 6: 'Serving',
};

const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  scallion: ['green onion', 'spring onion'], 'green onion': ['scallion', 'spring onion'], 'spring onion': ['scallion', 'green onion'],
  cilantro: ['coriander', 'fresh coriander'], coriander: ['cilantro', 'fresh coriander'],
  cornstarch: ['corn starch', 'corn flour'], 'corn starch': ['cornstarch', 'corn flour'],
  chickpea: ['garbanzo bean', 'garbanzo'], garbanzo: ['chickpea', 'garbanzo bean'], 'garbanzo bean': ['chickpea', 'garbanzo'],
  'bell pepper': ['capsicum', 'sweet pepper'], capsicum: ['bell pepper', 'sweet pepper'],
  zucchini: ['courgette'], courgette: ['zucchini'], eggplant: ['aubergine'], aubergine: ['eggplant'],
};

const STEP_TOOL_PATTERNS: Array<[RegExp, string]> = [
  [/\b(chop|slice|dice|mince|trim|halve|quarter)\b/, 'cutting board'],
  [/\b(chop|slice|dice|mince|julienne)\b/, "chef's knife"],
  [/\b(whisk|beat)\b/, 'whisk'], [/\b(drain|strain)\b/, 'colander'], [/\b(grate|shred|zest)\b/, 'grater'],
  [/\b(sear|sauté|saute|pan.?fry|stir.?fry|fry|brown)\b/, 'skillet'], [/\bpreheat\b|\bheat oven\b/, 'oven'],
  [/\b(bake|roast|broil)\b/, 'baking dish'], [/\b(boil|simmer|blanch|poach|reduce)\b/, 'saucepan'],
  [/\b(blend|blitz|puree|purée)\b/, 'blender'], [/\b(stir|fold|combine|toss)\b/, 'wooden spoon'],
  [/\b(marinate|soak|coat)\b/, 'mixing bowl'],
];

export function buildGuidedCookingSteps(recipe: Recipe | null): GuidedCookingStep[] {
  const displaySteps = getRecipeDisplaySteps(recipe);
  const recipeIngredients = getRecipeIngredients(recipe);
  const recipeTools = getSafeTextList(recipe?.equipment);
  const cookingTerms = getSafeCookingTerms(recipe?.cookingTerms);
  const spicePairings = getSafeTextList(recipe?.spicePairings);

  if (!recipe || displaySteps.length === 0) {
    return [{
      estimatedMinutes: null,
      timing: { activeMinutes: 1, passiveMinutes: 0, elapsedMinutes: 1, handsOnMinutes: 1 },
      ingredientsUsed: [],
      instruction: 'Okyo could not find detailed cooking steps for this recipe yet. Review the overview, then try another scan when you are ready.',
      phase: '', phaseStepIndex: 1, phaseStepCount: 1, stepNumber: 1,
      title: 'Review the recipe', toolsUsed: [],
    }];
  }

  const phaseTotals = new Map<string, number>();
  displaySteps.forEach((step) => {
    const phase = getStepPhaseName(step);
    phaseTotals.set(phase, (phaseTotals.get(phase) ?? 0) + 1);
  });
  const phaseRunning = new Map<string, number>();

  return displaySteps.map((step, index) => {
    const parsedStep = getStepCopy(step, index);
    const phase = getStepPhaseName(step);
    const phaseIndex = (phaseRunning.get(phase) ?? 0) + 1;
    phaseRunning.set(phase, phaseIndex);
    const timing = getRecipeStepTiming(step);
    const estimatedMinutes = timing.elapsedMinutes || null;
    const hasDecision = Boolean(step.decisionPoint && step.ifYes && step.ifNo);

    return {
      chefTip: step.chefTip ? cleanDisplayText(step.chefTip) : undefined,
      estimatedMinutes,
      elapsedMinutes: step.elapsedMinutes,
      timing,
      ingredientsUsed: step.ingredientsUsed?.length
        ? resolveIngredientsFromNames(step.ingredientsUsed, recipeIngredients)
        : getStepIngredients(step.text, recipeIngredients),
      instruction: parsedStep.body || step.text,
      phase,
      phaseStepIndex: phaseIndex,
      phaseStepCount: phaseTotals.get(phase) ?? 1,
      why: step.why,
      commonMistake: step.commonMistake,
      commonQuestion: step.commonQuestion,
      commonQuestionAnswer: step.commonQuestionAnswer,
      decisionPoint: hasDecision ? step.decisionPoint : undefined,
      ifYes: hasDecision ? step.ifYes : undefined,
      ifNo: hasDecision ? step.ifNo : undefined,
      doneWhen: step.doneWhen,
      safetyNote: step.safetyNote,
      stepNumber: index + 1,
      tip: getStepTip(step, index, displaySteps.length, cookingTerms, spicePairings) ?? undefined,
      title: parsedStep.title || `Step ${index + 1}`,
      toolsUsed: step.toolsUsed?.length ? step.toolsUsed.slice(0, 4) : getStepTools(step.text, recipeTools),
      visualCue: step.lookFor ?? step.visualCue,
    };
  });
}

function getRecipeDisplaySteps(recipe: Recipe | null): DisplayRecipeStep[] {
  const structuredSteps = (Array.isArray(recipe?.structuredSteps) ? recipe.structuredSteps : [])
    .map((step) => ({
      phase: step.phase, title: step.title, text: cleanDisplayText(step.text), lookFor: step.lookFor,
      doneWhen: step.doneWhen, chefTip: step.chefTip, ingredientsUsed: step.ingredientsUsed, toolsUsed: step.toolsUsed,
      commonQuestion: step.commonQuestion, commonQuestionAnswer: step.commonQuestionAnswer,
      why: step.why ?? (step.whyItMatters && !GENERIC_WHY_TEXTS.has(step.whyItMatters) ? cleanDisplayText(step.whyItMatters) : undefined),
      commonMistake: step.commonMistake ?? (step.safetyNote ? cleanDisplayText(step.safetyNote) : undefined),
      estimatedMinutes: step.estimatedMinutes, activeMinutes: step.activeMinutes, passiveMinutes: step.passiveMinutes,
      elapsedMinutes: step.elapsedMinutes, timeEstimate: step.timeEstimate?.trim(),
      visualCue: step.visualCue ? cleanDisplayText(step.visualCue) : undefined,
      safetyNote: step.safetyNote ? cleanDisplayText(step.safetyNote) : undefined,
      flavorBoost: step.flavorBoost ? cleanDisplayText(step.flavorBoost) : undefined,
      cookingTerm: step.cookingTerm && step.cookingTerm.term.trim() && step.cookingTerm.meaning.trim()
        ? { term: cleanDisplayText(step.cookingTerm.term), meaning: cleanDisplayText(step.cookingTerm.meaning) } : undefined,
    }))
    .filter((step) => step.text)
    .slice(0, 20);
  if (structuredSteps.length > 0) return structuredSteps;
  return (Array.isArray(recipe?.steps) ? recipe.steps : [])
    .map((step) => ({ text: cleanDisplayText(step) }))
    .filter((step) => step.text)
    .slice(0, 20);
}

function getSafeTextList(values: string[] | undefined) {
  return (Array.isArray(values) ? values : []).map(cleanDisplayText).filter(Boolean).slice(0, 6);
}

function getSafeCookingTerms(values: Recipe['cookingTerms']) {
  return (Array.isArray(values) ? values : [])
    .map((term) => ({ term: cleanDisplayText(term.term), meaning: cleanDisplayText(term.meaning) }))
    .filter((term) => term.term && term.meaning).slice(0, 5);
}

function getSafeIngredientGroups(recipe: Recipe | null) {
  return (Array.isArray(recipe?.ingredientGroups) ? recipe.ingredientGroups : [])
    .map((group) => ({ component: cleanDisplayText(group.component), items: Array.isArray(group.items) ? group.items : [] }))
    .filter((group) => group.component && group.items.length > 0).slice(0, 6);
}

function getRecipeIngredients(recipe: Recipe | null) {
  if (!recipe) return [];
  const grouped = getSafeIngredientGroups(recipe).flatMap((group) => group.items);
  return (grouped.length > 0 ? grouped : Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .filter((ingredient) => ingredient?.name?.trim()).slice(0, 40);
}

function getStepCopy(step: DisplayRecipeStep, index: number) {
  const text = cleanDisplayText(step.text);
  if (step.title) return { title: step.title, body: text };
  const [firstSentence, ...remaining] = text.split(/(?<=\.)\s+/);
  if (firstSentence && firstSentence.length <= 72 && remaining.length > 0) {
    return { title: firstSentence.replace(/\.$/, ''), body: remaining.join(' ').trim() };
  }
  const skip = new Set(['a', 'an', 'the', 'and', 'or', 'to', 'in', 'on', 'at', 'of', 'up', 'with', 'then', 'into', 'your', 'both', 'until', 'all', 'its', 'by', 'for', 'from']);
  const words = text.replace(/[.,!?;:]+/g, ' ').split(/\s+/).slice(0, 12).map((word) => word.replace(/[^a-zA-Z]/g, ''))
    .filter((word) => word.length > 1 && !skip.has(word.toLowerCase())).slice(0, 2);
  return { title: words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || `Step ${index + 1}`, body: text };
}

function getStepTip(step: DisplayRecipeStep, index: number, stepCount: number, terms: NonNullable<Recipe['cookingTerms']>, pairings: string[]) {
  if (step.flavorBoost) return { title: 'Flavor booster', body: step.flavorBoost };
  if (step.safetyNote && !step.commonMistake) return { title: 'Safety note', body: step.safetyNote };
  const normalized = step.text.toLowerCase();
  const term = step.cookingTerm ?? terms.find((candidate) => normalized.includes(candidate.term.toLowerCase()));
  if (term) return { title: term.term, body: term.meaning };
  const isFlavorStep = ['sauce', 'season', 'taste', 'finish', 'serve', 'garnish'].some((keyword) => normalized.includes(keyword));
  if ((isFlavorStep || index === stepCount - 1) && pairings.length > 0) {
    const pairing = pairings[index % pairings.length];
    if (pairing && pairing.length >= 25) return { title: 'Optional boost', body: pairing };
  }
  return null;
}

function getStepPhaseName(step: RecipeStep | DisplayRecipeStep) {
  if (step.phase && step.phase >= 1 && step.phase <= 6) return RECIPE_PHASE_NAMES[step.phase];
  const text = step.text.toLowerCase();
  if (/\b(serve|plate and serve|enjoy immediately|serve immediately|serve warm)\b/.test(text)) return 'Serving';
  if (/\bdrizzle\b|\bgarnish\b|\bfinish(?:ing)? with\b|\badd fresh (herbs?|basil|cilantro|parsley)\b/.test(text)) return 'Finishing';
  if (/\b(combine|build|assemble|layer|arrange|top with)\b/.test(text)) return 'Assembly';
  if (/\b(cook|fry|boil|roast|bake|sear|sauté|saute|grill|steam)\b/.test(text)) return 'Cooking';
  if (/\b(preheat|heat skillet|bring.*boil|bring.*to a boil)\b/.test(text)) return 'Setup';
  if (/\b(slice|chop|dice|mince|grate|shred|peel|trim|measure|wash|rinse)\b/.test(text)) return 'Preparation';
  return '';
}

function getStepIngredients(text: string, ingredients: RecipeIngredient[]) {
  const normalized = normalizeForMatching(text);
  const words = new Set(normalized.split(/\s+/).filter(Boolean));
  return ingredients.filter((ingredient) => {
    const name = normalizeForMatching(ingredient.name);
    if (normalized.includes(name)) return true;
    return name.split(' ').filter((part) => part.length >= 3).some((part) => words.has(part) || words.has(`${part}s`) || (part.endsWith('s') && words.has(part.slice(0, -1))));
  }).slice(0, 5);
}

function resolveIngredientsFromNames(names: string[], ingredients: RecipeIngredient[]) {
  return names.map((name) => {
    const normalized = normalizeForMatching(name);
    const exact = ingredients.find((ingredient) => normalizeForMatching(ingredient.name) === normalized);
    if (exact) return exact;
    const partial = ingredients.find((ingredient) => {
      const current = normalizeForMatching(ingredient.name);
      return current.includes(normalized) || normalized.includes(current);
    });
    if (partial) return partial;
    const words = normalized.split(' ').filter((word) => word.length >= 3);
    const wordMatch = ingredients.find((ingredient) => {
      const current = normalizeForMatching(ingredient.name);
      return words.length > 0 && words.every((word) => current.includes(word) || current.includes(`${word}s`) || (word.endsWith('s') && current.includes(word.slice(0, -1))));
    });
    if (wordMatch) return wordMatch;
    const key = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
    const synonyms = INGREDIENT_SYNONYMS[normalized] ?? INGREDIENT_SYNONYMS[key] ?? [];
    const synonym = ingredients.find((ingredient) => synonyms.some((value) => normalizeForMatching(ingredient.name).includes(normalizeForMatching(value))));
    return synonym ?? { name, quantity: '' };
  }).slice(0, 5);
}

function getStepTools(text: string, equipment: string[]) {
  const normalized = normalizeForMatching(text);
  const words = new Set(normalized.split(/\s+/).filter(Boolean));
  const fromEquipment = equipment.filter((tool) => {
    const parts = normalizeForMatching(tool).split(' ').filter((part) => part.length > 2);
    return parts.length > 0 && parts.every((part) => words.has(part));
  });
  const builtIn = STEP_TOOL_PATTERNS.filter(([pattern]) => pattern.test(normalized)).map(([, tool]) => tool);
  return [...new Set([...fromEquipment, ...builtIn])].slice(0, 4);
}

function parseEstimatedMinutes(value?: string) {
  const numbers = value?.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
  if (numbers.length === 0) return null;
  return numbers.length === 1 ? Math.max(1, numbers[0]) : Math.max(1, Math.round((numbers[0] + numbers[1]) / 2));
}

function normalizeForMatching(value: string) {
  return cleanDisplayText(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanDisplayText(value: string) {
  return value
    .replace(/\bAmercian\b/g, 'American').replace(/\bamer\s*cian\b/g, 'american')
    .replace(/\bcopycat(?:[-\s]?style)?\b/gi, 'homemade').replace(/\bcopy\s+cat(?:[-\s]?style)?\b/gi, 'homemade').trim();
}
