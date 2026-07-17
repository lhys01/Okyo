import type { Recipe, RecipeQualityReport } from '../mocks';
import { buildSmartGrocerySummary } from './smartGrocery';

export type RecipeAdaptationGoal =
  | 'faster'
  | 'cheaper'
  | 'beginner'
  | 'pantry'
  | 'healthier'
  | 'lighter'
  | 'higher_protein'
  | 'less_spicy'
  | 'more_spicy'
  | 'more_flavor'
  | 'leftovers';

export type RecipeAdaptationOption = {
  id: RecipeAdaptationGoal;
  label: string;
  shortLabel: string;
  helper: string;
  promise: string;
  previewTitle: string;
  changes: string[];
  tradeoff?: string;
  confidence: 'High' | 'Medium';
};

type MakeItMineContext = {
  qualityReport?: RecipeQualityReport | null;
  savedFoodIdeaCount?: number;
  savedRecipeCount?: number;
};

type ScoredOption = RecipeAdaptationOption & { score: number };

export function deriveAdaptationOptions(recipe: Recipe, context: MakeItMineContext = {}): RecipeAdaptationOption[] {
  const text = getRecipeText(recipe);
  const totalTime = getTotalTime(recipe);
  const stepCount = getStepCount(recipe);
  const hasSpice = containsAny(text, ['chili', 'jalapeno', 'hot sauce', 'sriracha', 'cayenne', 'spicy', 'gochujang']);
  const hasCreamyRichness = containsAny(text, ['cream', 'butter', 'mayo', 'cheese', 'fried', 'bacon', 'aioli']);
  const hasProtein = containsAny(text, ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tofu', 'egg', 'beans', 'lentil', 'yogurt']);
  const warningCount = (context.qualityReport?.whatCouldGoWrong?.length ?? 0) +
    (context.qualityReport?.vagueInstructions?.length ?? 0) +
    (context.qualityReport?.missingSteps?.length ?? 0);
  const smartGrocery = buildSmartGrocerySummary(recipe);
  const cheaperSwap = smartGrocery.swaps.find((swap) => swap.kind === 'cheaper');

  const options: ScoredOption[] = [
    {
      id: 'faster',
      label: 'Faster',
      shortLabel: 'Fast',
      helper: 'Trim the active cooking.',
      promise: 'Okyo would make this feel more weeknight-friendly.',
      previewTitle: 'A weeknight-speed version',
      changes: [
        totalTime > 25 ? 'Prep the sauce and toppings while the pan heats.' : 'Keep prep in one board-and-bowl setup.',
        stepCount > 5 ? 'Combine low-risk prep steps so the flow feels less stop-start.' : 'Use the current steps, but batch the chopping first.',
        'Lean on pre-cut produce or a ready grain when dinner needs to move.',
      ],
      tradeoff: 'A few garnishes may become optional, but the core flavor stays.',
      confidence: totalTime > 20 ? 'High' : 'Medium',
      score: totalTime + stepCount * 2,
    },
    {
      id: 'cheaper',
      label: 'Cheaper',
      shortLabel: 'Cheap',
      helper: 'Lower the shop cost.',
      promise: 'Okyo would protect the core flavor while lowering the cart.',
      previewTitle: 'A lower-cost cart',
      changes: [
        cheaperSwap ? cheaperSwap.reason : 'Swap one specialty ingredient for a pantry-friendly backup.',
        'Use frozen or seasonal produce where texture will still hold up.',
        'Stretch the main protein with rice, noodles, beans, or extra veg.',
      ],
      tradeoff: 'The plate may taste a little more homey than restaurant-style.',
      confidence: recipe.ingredients.length >= 6 ? 'High' : 'Medium',
      score: recipe.ingredients.length * 3,
    },
    {
      id: 'beginner',
      label: 'Beginner',
      shortLabel: 'Easy',
      helper: 'Make the steps calmer.',
      promise: 'Okyo would make the trickiest parts easier to trust.',
      previewTitle: 'A less fussy cooking path',
      changes: [
        warningCount > 0 ? 'Turn the vague spots into checkable cues before cooking.' : 'Add simple doneness cues to the trickiest step.',
        'Move all chopping and measuring before heat is on.',
        'Use one clear pan setup instead of juggling multiple tasks.',
      ],
      tradeoff: 'It may take a few extra minutes, but it should feel easier.',
      confidence: warningCount > 0 || recipe.difficulty !== 'Easy' ? 'High' : 'Medium',
      score: warningCount * 12 + (recipe.difficulty === 'Easy' ? 8 : 28),
    },
    {
      id: 'pantry',
      label: 'Pantry-friendly',
      shortLabel: 'Pantry',
      helper: 'Use what you probably have.',
      promise: 'Okyo would separate must-buys from flexible pantry swaps.',
      previewTitle: 'A pantry-first version',
      changes: [
        smartGrocery.probablyHave.length > 0
          ? `Check ${smartGrocery.probablyHave.length} pantry ${smartGrocery.probablyHave.length === 1 ? 'basic' : 'basics'} before buying duplicates.`
          : 'Treat salt, pepper, oil, garlic, and basic spices as probably-on-hand.',
        'Mark flexible produce and sauce swaps before building the grocery list.',
        'Buy only the ingredients that define the dish.',
      ],
      tradeoff: 'Okyo will keep swaps practical, not identical.',
      confidence: 'High',
      score: 18 + (context.savedFoodIdeaCount ?? 0) + (context.savedRecipeCount ?? 0),
    },
    {
      id: 'lighter',
      label: 'Lighter',
      shortLabel: 'Light',
      helper: 'Keep it balanced.',
      promise: 'Okyo would make this feel brighter and more balanced.',
      previewTitle: 'A brighter, balanced version',
      changes: [
        hasCreamyRichness ? 'Use yogurt, citrus, or broth to loosen rich sauces.' : 'Add a fresh crunchy side or extra veg.',
        'Keep flavor high with acid, herbs, and toasted spices.',
        'Serve with a filling base so it still eats like dinner.',
      ],
      tradeoff: 'This is about feel and balance, not calorie math.',
      confidence: hasCreamyRichness ? 'High' : 'Medium',
      score: hasCreamyRichness ? 28 : 12,
    },
    {
      id: 'healthier',
      label: 'Healthier',
      shortLabel: 'Health',
      helper: 'Make it feel better.',
      promise: 'Okyo would keep the language soft: more balanced, more filling, not calorie math.',
      previewTitle: 'A feel-good version',
      changes: [
        hasCreamyRichness ? 'Keep richness, but loosen heavy sauces with yogurt, citrus, or broth.' : 'Add color with extra veg, herbs, or a crisp side.',
        'Use a filling base so the meal still satisfies.',
        'Finish with acid and herbs instead of relying only on salt or fat.',
      ],
      tradeoff: 'This is a practical dinner tweak, not nutrition tracking.',
      confidence: hasCreamyRichness ? 'High' : 'Medium',
      score: hasCreamyRichness ? 24 : 10,
    },
    {
      id: 'higher_protein',
      label: 'More filling',
      shortLabel: 'Protein',
      helper: 'Add satisfying protein.',
      promise: 'Okyo would make the plate more satisfying without tracking macros.',
      previewTitle: 'A more filling plate',
      changes: [
        hasProtein ? 'Keep the current protein central and avoid hiding it in sauce.' : 'Add eggs, tofu, beans, yogurt, or chicken depending on the dish.',
        'Pair the protein with a grain or veg that reheats well.',
        'Use sauce at the end so the texture stays better.',
      ],
      confidence: !hasProtein ? 'High' : 'Medium',
      score: hasProtein ? 12 : 26,
    },
    {
      id: 'less_spicy',
      label: 'Less spicy',
      shortLabel: 'Mild',
      helper: 'Dial down heat.',
      promise: 'Okyo would keep the flavor but make the heat easier to control.',
      previewTitle: 'A gentler heat level',
      changes: [
        hasSpice ? 'Start with half the chili or hot sauce, then taste.' : 'Keep peppery heat optional at the table.',
        'Add dairy, citrus, or sweetness if the sauce gets too sharp.',
        'Separate spicy garnish so everyone can adjust their bowl.',
      ],
      confidence: hasSpice ? 'High' : 'Medium',
      score: hasSpice ? 24 : 8,
    },
    {
      id: 'more_spicy',
      label: 'More spicy',
      shortLabel: 'Spicy',
      helper: 'Turn up heat.',
      promise: 'Okyo would add heat gradually so dinner does not get wrecked.',
      previewTitle: 'A hotter version',
      changes: [
        hasSpice ? 'Bloom the existing chili or spice in oil for a deeper kick.' : 'Add chili crisp, hot sauce, sliced jalapeno, or crushed red pepper at the end.',
        'Keep dairy, citrus, or sweetness nearby to balance the heat.',
        'Make the spicy finish optional if not everyone wants it.',
      ],
      tradeoff: 'Heat builds fast, so Okyo would add it in small rounds.',
      confidence: hasSpice ? 'High' : 'Medium',
      score: hasSpice ? 18 : 10,
    },
    {
      id: 'more_flavor',
      label: 'More flavor',
      shortLabel: 'Flavor',
      helper: 'Make it pop.',
      promise: 'Okyo would make this taste more restaurant-style.',
      previewTitle: 'A louder flavor finish',
      changes: [
        'Brown the main ingredient a little harder before saucing.',
        'Finish with acid, herbs, or a crunchy topping.',
        'Taste once before serving and adjust salt in small pinches.',
      ],
      confidence: 'High',
      score: 16,
    },
    {
      id: 'leftovers',
      label: 'Use leftovers',
      shortLabel: 'Leftovers',
      helper: 'Cook once, eat twice.',
      promise: 'Okyo would make this friendlier for leftover rice, chicken, vegetables, or sauce.',
      previewTitle: 'A next-day friendly version',
      changes: [
        'Keep crisp toppings separate until serving.',
        'Store sauce apart if it could make the base soggy.',
        'Double the base or protein, then refresh with herbs or citrus tomorrow.',
      ],
      tradeoff: 'The first serving gets one extra container, but tomorrow gets easier.',
      confidence: 'Medium',
      score: recipe.servings >= 2 ? 20 : 12,
    },
  ];

  return options
    .sort((left, right) => right.score - left.score)
    .map(({ score: _score, ...option }) => option);
}

export function getDefaultAdaptationGoal(options: RecipeAdaptationOption[]) {
  return options[0]?.id ?? null;
}

function getRecipeText(recipe: Recipe) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const substitutions = Array.isArray(recipe.substitutions) ? recipe.substitutions : [];
  return [
    recipe.title,
    recipe.description,
    recipe.pantryNote,
    substitutions.join(' '),
    ingredients.map((ingredient) => `${ingredient.quantity ?? ''} ${ingredient.name ?? ''}`).join(' '),
    steps.join(' '),
  ].join(' ').toLowerCase();
}

function getStepCount(recipe: Recipe) {
  return Array.isArray(recipe.structuredSteps) && recipe.structuredSteps.length > 0
    ? recipe.structuredSteps.length
    : Array.isArray(recipe.steps) ? recipe.steps.length : 0;
}

function getTotalTime(recipe: Recipe) {
  if (typeof recipe.totalTimeMinutes === 'number' && Number.isFinite(recipe.totalTimeMinutes)) {
    return recipe.totalTimeMinutes;
  }
  const prep = typeof recipe.prepTimeMinutes === 'number' && Number.isFinite(recipe.prepTimeMinutes)
    ? recipe.prepTimeMinutes
    : 0;
  const cook = typeof recipe.cookTimeMinutes === 'number' && Number.isFinite(recipe.cookTimeMinutes)
    ? recipe.cookTimeMinutes
    : 0;
  return prep + cook;
}

function containsAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}
