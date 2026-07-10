import type { Recipe, RecipeIngredient, RecipeStep } from '../types.js';
import type {
  RecipeAdaptationChange,
  RecipeAdaptationGoal,
  RecipeAdaptationPlan,
  RecipeAdaptationRequest,
} from '../types/recipeAdaptation.js';

type RecipeSnapshot = {
  title: string;
  text: string;
  ingredientNames: string[];
  stepTexts: string[];
  equipment: string[];
  substitutions: string[];
  totalTimeMinutes: number | null;
  estimatedHomemadeCost: number | null;
  difficulty: string;
};

type PlanBuckets = {
  changes: RecipeAdaptationChange[];
  tradeoffs: string[];
  warnings: string[];
  pantryIdeas: string[];
  budgetIdeas: string[];
  speedIdeas: string[];
  healthIdeas: string[];
  proteinIdeas: string[];
};

const spiceWords = ['chili', 'chilli', 'jalapeno', 'hot sauce', 'sriracha', 'cayenne', 'spicy', 'gochujang', 'harissa'];
const richWords = ['cream', 'butter', 'mayo', 'mayonnaise', 'cheese', 'fried', 'bacon', 'aioli', 'sour cream'];
const proteinWords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tofu', 'egg', 'eggs', 'beans', 'lentil', 'lentils', 'yogurt'];
const rawProteinWords = ['raw chicken', 'chicken', 'turkey', 'pork', 'fish', 'salmon', 'shrimp', 'egg', 'eggs'];
const pantryStapleWords = ['salt', 'pepper', 'oil', 'olive oil', 'garlic', 'onion', 'rice', 'pasta', 'flour', 'sugar', 'soy sauce', 'vinegar'];
const garnishWords = ['parsley', 'cilantro', 'scallion', 'sesame', 'parmesan', 'lime', 'lemon', 'chives'];

export function buildRecipeAdaptationPlan(
  recipe: Recipe,
  goals: RecipeAdaptationGoal[],
  context: RecipeAdaptationRequest['context'] = {},
): RecipeAdaptationPlan {
  const snapshot = getRecipeSnapshot(recipe);
  const uniqueGoals = unique(goals);
  const buckets = createEmptyBuckets();

  for (const goal of uniqueGoals) {
    applyGoal(goal, snapshot, context, buckets);
  }

  applyContextWarnings(snapshot, context, uniqueGoals, buckets);
  applyRecipeShapeWarnings(snapshot, buckets);

  return {
    version: 1,
    mode: 'plan',
    summary: getSummary(snapshot, uniqueGoals, buckets),
    goals: uniqueGoals,
    changes: buckets.changes.slice(0, 9),
    tradeoffs: unique(buckets.tradeoffs).slice(0, 4),
    warnings: unique(buckets.warnings).slice(0, 5),
    pantryIdeas: unique(buckets.pantryIdeas).slice(0, 5),
    budgetIdeas: unique(buckets.budgetIdeas).slice(0, 5),
    speedIdeas: unique(buckets.speedIdeas).slice(0, 5),
    healthIdeas: unique(buckets.healthIdeas).slice(0, 5),
    proteinIdeas: unique(buckets.proteinIdeas).slice(0, 5),
    confidence: getConfidence(snapshot, buckets),
  };
}

function applyGoal(
  goal: RecipeAdaptationGoal,
  snapshot: RecipeSnapshot,
  context: RecipeAdaptationRequest['context'],
  buckets: PlanBuckets,
) {
  switch (goal) {
    case 'faster':
      addFasterIdeas(snapshot, context, buckets);
      break;
    case 'cheaper':
      addCheaperIdeas(snapshot, context, buckets);
      break;
    case 'healthier':
      addHealthierIdeas(snapshot, buckets);
      break;
    case 'lighter':
      addLighterIdeas(snapshot, buckets);
      break;
    case 'beginner':
      addBeginnerIdeas(snapshot, context, buckets);
      break;
    case 'higherProtein':
      addHigherProteinIdeas(snapshot, buckets);
      break;
    case 'pantryFriendly':
      addPantryFriendlyIdeas(snapshot, context, buckets);
      break;
    case 'leftovers':
      addLeftoverIdeas(snapshot, buckets);
      break;
    case 'lessSpicy':
      addLessSpicyIdeas(snapshot, buckets);
      break;
    case 'moreSpicy':
      addMoreSpicyIdeas(snapshot, buckets);
      break;
    case 'moreFlavor':
      addMoreFlavorIdeas(buckets);
      break;
  }
}

function addFasterIdeas(
  snapshot: RecipeSnapshot,
  context: RecipeAdaptationRequest['context'],
  buckets: PlanBuckets,
) {
  const timingDetail = snapshot.totalTimeMinutes && snapshot.totalTimeMinutes <= 25
    ? 'Keep the recipe in one board-and-bowl setup so cleanup does not slow dinner down.'
    : 'Prep the sauce, toppings, and any garnish while the pan or water heats.';
  addChange(buckets, 'faster-parallel-prep', 'timing', 'Stack the low-risk prep', timingDetail, 'primary', 'faster');
  addChange(
    buckets,
    'faster-ready-base',
    'ingredient',
    'Use a ready base when dinner needs to move',
    'Use microwave rice, quick noodles, canned beans, or pre-cut vegetables if they fit the dish.',
    'optional',
    'faster',
  );
  if (snapshot.stepTexts.length > 5) {
    addChange(
      buckets,
      'faster-combine-prep',
      'step',
      'Combine simple prep steps',
      'Group chopping, measuring, and sauce stirring before heat goes on.',
      'primary',
      'faster',
    );
  }
  if (context?.timePreference?.toLowerCase().includes('under30')) {
    buckets.speedIdeas.push('Keep optional toppings and long garnishes as nice-to-have extras.');
  }
  buckets.speedIdeas.push('Start the longest-cooking item first, then prep the rest while it cooks.');
  buckets.tradeoffs.push('A few garnishes may become optional, but the core meal stays intact.');
  addRawProteinSafetyWarning(snapshot, buckets, 'Speed tweaks should not remove doneness checks for meat, fish, or eggs.');
}

function addCheaperIdeas(
  snapshot: RecipeSnapshot,
  context: RecipeAdaptationRequest['context'],
  buckets: PlanBuckets,
) {
  const specialtySwap = getSpecialtySwap(snapshot);
  addChange(
    buckets,
    'cheaper-flexible-swap',
    'shopping',
    'Swap one flexible ingredient',
    specialtySwap ?? 'Swap a specialty ingredient for onion, frozen vegetables, beans, rice, noodles, or another pantry-friendly backup.',
    'primary',
    'cheaper',
  );
  addChange(
    buckets,
    'cheaper-stretch-protein',
    'ingredient',
    'Stretch the most expensive ingredient',
    'Use a little less premium protein and make the plate feel full with rice, noodles, beans, potatoes, or extra veg.',
    'optional',
    'cheaper',
  );
  buckets.budgetIdeas.push('Check pantry staples before buying duplicates.');
  buckets.budgetIdeas.push('Use frozen or seasonal produce where texture will still hold up.');
  if (context?.budgetPreference?.toLowerCase() === 'low') {
    buckets.budgetIdeas.push('Keep the cart focused on the ingredients that define the dish.');
  }
  buckets.tradeoffs.push('The result may taste a little more homey than restaurant-style.');
}

function addHealthierIdeas(snapshot: RecipeSnapshot, buckets: PlanBuckets) {
  const rich = containsAny(snapshot.text, richWords);
  addChange(
    buckets,
    'healthier-balanced-plate',
    'ingredient',
    'Make it feel more balanced',
    rich
      ? 'Keep the richness, but loosen heavy sauces with yogurt, citrus, broth, herbs, or extra vegetables.'
      : 'Add color with extra vegetables, herbs, citrus, or a crisp side.',
    'primary',
    'healthier',
  );
  buckets.healthIdeas.push('Use filling bases and bright finishes rather than calorie or macro math.');
  buckets.healthIdeas.push('Finish with acid, herbs, or toasted spices before adding more salt or fat.');
  buckets.tradeoffs.push('This is a practical dinner tweak, not nutrition tracking.');
}

function addLighterIdeas(snapshot: RecipeSnapshot, buckets: PlanBuckets) {
  const rich = containsAny(snapshot.text, richWords);
  addChange(
    buckets,
    'lighter-brighter-finish',
    'ingredient',
    'Make it feel brighter',
    rich
      ? 'Use yogurt, citrus, broth, herbs, or extra vegetables to lighten rich sauces without making the meal feel skimpy.'
      : 'Add a fresh crunchy side, herbs, citrus, or extra veg so the plate feels brighter.',
    'primary',
    'lighter',
  );
  buckets.healthIdeas.push('Keep this about balance and feel, not calorie math.');
  buckets.healthIdeas.push('Use acid, herbs, and texture to make the meal feel fresher.');
  buckets.tradeoffs.push('The plate may feel brighter and less rich, while the core meal stays familiar.');
}

function addBeginnerIdeas(
  snapshot: RecipeSnapshot,
  context: RecipeAdaptationRequest['context'],
  buckets: PlanBuckets,
) {
  addChange(
    buckets,
    'beginner-mise-en-place',
    'step',
    'Prep before heat',
    'Chop, measure, and place ingredients near the stove before turning on heat.',
    'primary',
    'beginner',
  );
  addChange(
    buckets,
    'beginner-smaller-actions',
    'step',
    'Break the hardest step into smaller actions',
    'Pause at the busiest step and split it into add, stir, taste, and check-for-doneness moments.',
    'primary',
    'beginner',
  );
  if (snapshot.equipment.length > 2 || context?.skillLevel?.toLowerCase().includes('beginner')) {
    addChange(
      buckets,
      'beginner-one-pan',
      'equipment',
      'Reduce juggling',
      'Use one clear pan setup where possible before adding extra bowls or tools.',
      'optional',
      'beginner',
    );
  }
  buckets.warnings.push('Beginner-friendly changes may add a few calm minutes instead of making the recipe faster.');
}

function addHigherProteinIdeas(snapshot: RecipeSnapshot, buckets: PlanBuckets) {
  const hasProtein = containsAny(snapshot.text, proteinWords);
  addChange(
    buckets,
    'protein-satisfying-add',
    'ingredient',
    hasProtein ? 'Keep the protein central' : 'Add a satisfying protein',
    hasProtein
      ? 'Keep the current protein central and avoid hiding it completely in sauce.'
      : 'Add eggs, beans, tofu, chicken, fish, lentils, or Greek yogurt if it fits the dish.',
    'primary',
    'higherProtein',
  );
  buckets.proteinIdeas.push('Make the plate more filling without tracking macros.');
  buckets.proteinIdeas.push('Pair protein with a grain or vegetable that reheats well.');
}

function addPantryFriendlyIdeas(
  snapshot: RecipeSnapshot,
  context: RecipeAdaptationRequest['context'],
  buckets: PlanBuckets,
) {
  const available = normalizeList(context?.availableIngredients);
  const matched = snapshot.ingredientNames.filter((ingredient) => available.some((item) => ingredient.includes(item) || item.includes(ingredient)));
  addChange(
    buckets,
    'pantry-check-first',
    'shopping',
    'Check what you probably have first',
    matched.length > 0
      ? `You may already have ${formatList(matched.slice(0, 3))}; verify amounts before shopping.`
      : 'Treat basics like salt, pepper, oil, garlic, onion, rice, pasta, and simple spices as check-first items.',
    'primary',
    'pantryFriendly',
  );
  buckets.pantryIdeas.push('Separate must-buys from flexible pantry swaps before building the grocery list.');
  buckets.pantryIdeas.push('Buy the ingredients that define the dish; keep basic seasonings flexible.');
  buckets.warnings.push('Pantry ideas are suggestions only; Okyo has not confirmed what is in your kitchen.');
}

function addLeftoverIdeas(snapshot: RecipeSnapshot, buckets: PlanBuckets) {
  addChange(
    buckets,
    'leftovers-store-separate',
    'leftovers',
    'Store texture-sensitive parts separately',
    'Keep sauce, crisp toppings, herbs, and crunchy garnishes separate until serving.',
    'primary',
    'leftovers',
  );
  addChange(
    buckets,
    'leftovers-double-base',
    'leftovers',
    'Cook once, eat twice',
    'Double the base or protein if it reheats well, then refresh tomorrow with herbs, citrus, or a small splash of sauce.',
    'optional',
    'leftovers',
  );
  buckets.tradeoffs.push('The first serving may need one extra container, but tomorrow gets easier.');
  if (containsAny(snapshot.text, garnishWords)) {
    buckets.pantryIdeas.push('Hold fresh garnish back until the meal is reheated.');
  }
}

function addLessSpicyIdeas(snapshot: RecipeSnapshot, buckets: PlanBuckets) {
  const hasSpice = containsAny(snapshot.text, spiceWords);
  addChange(
    buckets,
    'less-spicy-control-heat',
    'flavor',
    'Dial heat down gradually',
    hasSpice
      ? 'Start with half the chili, hot sauce, or spicy paste, then taste before adding more.'
      : 'Keep peppery heat optional at the table.',
    'primary',
    'lessSpicy',
  );
  buckets.healthIdeas.push('Use dairy, citrus, broth, or a little sweetness if the sauce gets too sharp.');
  buckets.tradeoffs.push('The recipe may taste gentler, so add herbs, acid, or toasted spices for flavor.');
}

function addMoreSpicyIdeas(snapshot: RecipeSnapshot, buckets: PlanBuckets) {
  const hasSpice = containsAny(snapshot.text, spiceWords);
  addChange(
    buckets,
    'more-spicy-gradual-heat',
    'flavor',
    'Build heat in small rounds',
    hasSpice
      ? 'Bloom the existing chili or spice in oil for a deeper kick, then taste.'
      : 'Add chili crisp, hot sauce, sliced jalapeno, or crushed red pepper at the end.',
    'primary',
    'moreSpicy',
  );
  buckets.warnings.push('Heat builds fast, so keep spicy finishes optional if not everyone wants them.');
}

function addMoreFlavorIdeas(buckets: PlanBuckets) {
  addChange(
    buckets,
    'more-flavor-brown-finish',
    'flavor',
    'Make the finish pop',
    'Brown the main ingredient a little harder, then finish with acid, herbs, crunch, or a small pinch of salt after tasting.',
    'primary',
    'moreFlavor',
  );
  buckets.healthIdeas.push('Use citrus, herbs, toasted spices, or crunch before adding more salt or fat.');
  buckets.tradeoffs.push('Bolder flavor may add one small finishing step.');
}

function applyContextWarnings(
  snapshot: RecipeSnapshot,
  context: RecipeAdaptationRequest['context'],
  goals: RecipeAdaptationGoal[],
  buckets: PlanBuckets,
) {
  if (goals.includes('lessSpicy') && goals.includes('moreSpicy')) {
    buckets.warnings.push('Both less spicy and more spicy were requested, so keep heat on the side and let each plate adjust.');
  }

  const dislikes = normalizeList(context?.dislikes);
  const dislikedMatches = snapshot.ingredientNames.filter((ingredient) =>
    dislikes.some((dislike) => ingredient.includes(dislike) || dislike.includes(ingredient)));
  for (const match of dislikedMatches.slice(0, 3)) {
    buckets.warnings.push(`${toTitleCase(match)} appears in the recipe; swap or leave it out if that dislike still applies.`);
  }

  const userEquipment = normalizeList(context?.equipment);
  if (userEquipment.length > 0) {
    const missingTools = snapshot.equipment.filter((tool) => !userEquipment.some((owned) => tool.includes(owned) || owned.includes(tool)));
    for (const tool of missingTools.slice(0, 2)) {
      buckets.warnings.push(`Check equipment before cooking; ${tool} may not be available.`);
    }
  }
}

function applyRecipeShapeWarnings(snapshot: RecipeSnapshot, buckets: PlanBuckets) {
  if (snapshot.ingredientNames.length === 0) {
    buckets.warnings.push('The recipe has no clear ingredient list, so this stays a general adaptation plan.');
  }
  if (snapshot.stepTexts.length === 0) {
    buckets.warnings.push('The recipe has no clear method yet; add steps before relying on this for cooking.');
  } else if (snapshot.stepTexts.length < 3) {
    buckets.warnings.push('The method is short, so keep extra doneness and timing cues visible while cooking.');
  }
}

function getSummary(snapshot: RecipeSnapshot, goals: RecipeAdaptationGoal[], buckets: PlanBuckets) {
  const title = snapshot.title === 'This recipe' ? 'this recipe' : snapshot.title;
  const readableGoals = goals.map(getGoalLabel);
  const goalPhrase = readableGoals.length > 1
    ? `${readableGoals.slice(0, -1).join(', ')} and ${readableGoals[readableGoals.length - 1]}`
    : readableGoals[0] ?? 'more personal';
  const caution = buckets.warnings.length > 0 ? ' Okyo will keep the original recipe unchanged while you check the details.' : '';
  return `Okyo can make ${title} feel ${goalPhrase} without rewriting the whole recipe.${caution}`;
}

function getConfidence(snapshot: RecipeSnapshot, buckets: PlanBuckets): RecipeAdaptationPlan['confidence'] {
  if (snapshot.ingredientNames.length === 0 || snapshot.stepTexts.length === 0) {
    return 'low';
  }
  if (buckets.warnings.length > 2 || snapshot.stepTexts.length < 3) {
    return 'medium';
  }
  return 'high';
}

function addRawProteinSafetyWarning(snapshot: RecipeSnapshot, buckets: PlanBuckets, warning: string) {
  if (containsAny(snapshot.text, rawProteinWords)) {
    buckets.warnings.push(warning);
  }
}

function addChange(
  buckets: PlanBuckets,
  id: string,
  type: RecipeAdaptationChange['type'],
  label: string,
  detail: string,
  priority: RecipeAdaptationChange['priority'],
  goal: RecipeAdaptationGoal,
) {
  if (buckets.changes.some((change) => change.id === id)) {
    return;
  }
  buckets.changes.push({ id, type, label, detail, priority, goal });
}

function getRecipeSnapshot(recipe: Recipe): RecipeSnapshot {
  const title = cleanText(readString((recipe as { title?: unknown }).title)) || 'This recipe';
  const ingredientNames = normalizeIngredients((recipe as { ingredients?: unknown }).ingredients);
  const stepTexts = normalizeSteps(
    (recipe as { steps?: unknown }).steps,
    (recipe as { structuredSteps?: unknown }).structuredSteps,
  );
  const equipment = normalizeTextList((recipe as { equipment?: unknown }).equipment);
  const substitutions = normalizeTextList((recipe as { substitutions?: unknown }).substitutions);
  const totalTimeMinutes = readFiniteNumber((recipe as { totalTimeMinutes?: unknown }).totalTimeMinutes) ??
    sumNumbers(
      readFiniteNumber((recipe as { prepTimeMinutes?: unknown }).prepTimeMinutes),
      readFiniteNumber((recipe as { cookTimeMinutes?: unknown }).cookTimeMinutes),
    );
  const estimatedHomemadeCost = readFiniteNumber((recipe as { estimatedHomemadeCost?: unknown }).estimatedHomemadeCost);
  const difficulty = cleanText(readString((recipe as { difficulty?: unknown }).difficulty)) ||
    cleanText(readString((recipe as { skillLevel?: unknown }).skillLevel)) ||
    'Unknown';
  const text = [
    title,
    readString((recipe as { description?: unknown }).description),
    readString((recipe as { pantryNote?: unknown }).pantryNote),
    ingredientNames.join(' '),
    stepTexts.join(' '),
    substitutions.join(' '),
    equipment.join(' '),
  ].join(' ').toLowerCase();

  return {
    title,
    text,
    ingredientNames,
    stepTexts,
    equipment,
    substitutions,
    totalTimeMinutes,
    estimatedHomemadeCost,
    difficulty,
  };
}

function normalizeIngredients(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return unique(value
    .map((ingredient) => {
      if (typeof ingredient === 'string') {
        return cleanText(ingredient).toLowerCase();
      }
      const candidate = ingredient as Partial<RecipeIngredient> & { label?: unknown };
      return cleanText(readString(candidate.name) || readString(candidate.label)).toLowerCase();
    })
    .filter(Boolean));
}

function normalizeSteps(stepsValue: unknown, structuredStepsValue: unknown) {
  const plainSteps = normalizeTextList(stepsValue);
  const structuredSteps = Array.isArray(structuredStepsValue)
    ? structuredStepsValue
      .map((step) => {
        if (typeof step === 'string') {
          return cleanText(step);
        }
        const candidate = step as Partial<RecipeStep>;
        return cleanText(candidate.text);
      })
      .filter(Boolean)
    : [];
  return plainSteps.length > 0 ? plainSteps : structuredSteps;
}

function normalizeTextList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => cleanText(readString(item)))
    .filter(Boolean);
}

function normalizeList(value: unknown) {
  return normalizeTextList(value).map((item) => item.toLowerCase());
}

function getSpecialtySwap(snapshot: RecipeSnapshot) {
  if (snapshot.substitutions.length > 0) {
    return snapshot.substitutions[0];
  }
  if (snapshot.ingredientNames.some((ingredient) => ingredient.includes('shallot'))) {
    return 'Swap shallot for onion if that is what you already have.';
  }
  if (snapshot.ingredientNames.some((ingredient) => ingredient.includes('parmesan'))) {
    return 'Use a smaller amount of parmesan or swap in another salty cheese you already have.';
  }
  if (snapshot.estimatedHomemadeCost && snapshot.estimatedHomemadeCost > 8) {
    return 'Choose one premium ingredient to keep and make the rest pantry-friendly.';
  }
  return undefined;
}

function containsAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function getGoalLabel(goal: RecipeAdaptationGoal) {
  switch (goal) {
    case 'higherProtein':
      return 'more filling';
    case 'pantryFriendly':
      return 'pantry-friendly';
    case 'lessSpicy':
      return 'less spicy';
    case 'moreSpicy':
      return 'more spicy';
    case 'moreFlavor':
      return 'more flavorful';
    default:
      return goal;
  }
}

function createEmptyBuckets(): PlanBuckets {
  return {
    changes: [],
    tradeoffs: [],
    warnings: [],
    pantryIdeas: [],
    budgetIdeas: [],
    speedIdeas: [],
    healthIdeas: [],
    proteinIdeas: [],
  };
}

function formatList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? 'a few ingredients';
  }
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function readString(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function readFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sumNumbers(left: number | null, right: number | null) {
  if (left === null && right === null) {
    return null;
  }
  return (left ?? 0) + (right ?? 0);
}
