import type { Recipe, RecipeQualityReport, SavedFoodIdea } from '../mocks';
import { buildSmartGrocerySummary } from './smartGrocery';

export type HomeCommandAction =
  | 'open_recipe'
  | 'open_food_idea'
  | 'open_scan'
  | 'open_grocery';

export type HomeCommandKind =
  | 'tonightPick'
  | 'foxFind'
  | 'useWhatYouHave'
  | 'saveIdea'
  | 'scan'
  | 'lowEffort'
  | 'askOkyo';

export type HomeCommandCard = {
  id: string;
  title: string;
  body: string;
  cta: string;
  action: HomeCommandAction;
  kind: HomeCommandKind;
  recipe?: Recipe;
  reason?: string;
  tone: 'coral' | 'green' | 'cream';
};

export type HomeCommandCenter = {
  headline: string;
  subheadline: string;
  tonightCard: HomeCommandCard;
  foxFind: HomeCommandCard;
  quickCards: HomeCommandCard[];
  tasteNote: string;
};

type HomeCommandInput = {
  latestScanRecipe?: Recipe | null;
  savedFoodIdeas: SavedFoodIdea[];
  savedRecipes: Recipe[];
};

export function deriveHomeCommandCenter(input: HomeCommandInput): HomeCommandCenter {
  const safeSavedRecipes = input.savedRecipes.filter((recipe) => recipe?.id && recipe?.title);
  const safeIdeas = input.savedFoodIdeas.filter((idea) => idea?.id && idea?.title);
  const latestIdeaRecipe = safeIdeas.find((idea) => idea.extractedRecipe)?.extractedRecipe;
  const quickRecipe = findQuickRecipe([
    input.latestScanRecipe,
    ...safeSavedRecipes,
    ...safeIdeas.map((idea) => idea.extractedRecipe ?? null),
  ]);
  const tonightRecipe = input.latestScanRecipe ?? safeSavedRecipes[0] ?? latestIdeaRecipe ?? quickRecipe ?? null;

  const tonightCard = buildTonightCard(tonightRecipe);
  const foodIdeaCard = buildFoodIdeaCard(safeIdeas);
  const scanCard = buildScanCard(Boolean(input.latestScanRecipe || safeSavedRecipes.length));
  const useWhatYouHaveCard = buildUseWhatYouHaveCard(tonightRecipe, latestIdeaRecipe, safeIdeas);
  const lowEffortCard = buildLowEffortCard(quickRecipe);
  const askOkyoCard = buildAskOkyoCard();
  const quickCards = [foodIdeaCard, scanCard, useWhatYouHaveCard, lowEffortCard, askOkyoCard].filter((card, index, cards) => (
    cards.findIndex((candidate) => candidate.id === card.id) === index
  ));

  return {
    headline: getHeadline(),
    subheadline: getSubheadline(),
    tonightCard,
    foxFind: buildFoxFind(input, quickRecipe),
    quickCards,
    tasteNote: buildTasteNote(input),
  };
}

function buildTonightCard(recipe: Recipe | null): HomeCommandCard {
  if (recipe) {
    return {
      id: `tonight-${recipe.id}`,
      title: recipe.title,
      body: `${recipe.difficulty} dinner, about ${getTotalMinutes(recipe)} min. Okyo can check, adapt, shop, and coach it.`,
      cta: 'Cook tonight',
      action: 'open_recipe',
      kind: 'tonightPick',
      recipe,
      reason: 'Picked from your latest scan, saved recipes, or saved ideas.',
      tone: 'coral',
    };
  }

  return {
    id: 'tonight-scan',
    title: 'Start with one craving',
    body: 'Scan a meal or save messy recipe text, then Okyo turns it into a cookable dinner path.',
    cta: 'Scan food',
    action: 'open_scan',
    kind: 'tonightPick',
    reason: 'No saved dinner signal yet, so the fastest path is a scan or saved food idea.',
    tone: 'coral',
  };
}

function buildFoodIdeaCard(savedFoodIdeas: SavedFoodIdea[]): HomeCommandCard {
  const latestIdea = savedFoodIdeas[0];

  if (latestIdea?.extractedRecipe) {
    return {
      id: `idea-${latestIdea.id}`,
      title: 'Check a saved idea',
      body: `${latestIdea.title} is ready for fixes, grocery, and cooking.`,
      cta: 'Open idea',
      action: 'open_recipe',
      kind: 'saveIdea',
      recipe: latestIdea.extractedRecipe,
      reason: 'Recent saved food idea with a local Recipe Check preview.',
      tone: 'cream',
    };
  }

  return {
    id: 'idea-new',
    title: 'Save food chaos',
    body: 'Paste a link, caption, or rough note and Okyo checks if it is cookable.',
    cta: 'Save idea',
    action: 'open_food_idea',
    kind: 'saveIdea',
    reason: 'Save Food Idea is the fastest non-photo entry into Okyo.',
    tone: 'cream',
  };
}

function buildScanCard(hasRecipe: boolean): HomeCommandCard {
  return {
    id: 'scan-photo',
    title: hasRecipe ? 'Scan another meal' : 'Scan your first meal',
    body: hasRecipe
      ? 'Turn a restaurant photo into an inspired-by recipe you can actually make.'
      : 'Photo scan is still the fastest way to teach Okyo what you crave.',
    cta: 'Open camera',
    action: 'open_scan',
    kind: 'scan',
    reason: 'Photo scan keeps the main Okyo loop close.',
    tone: 'green',
  };
}

function buildUseWhatYouHaveCard(recipe: Recipe | null, ideaRecipe: Recipe | undefined, savedFoodIdeas: SavedFoodIdea[]): HomeCommandCard {
  const sourceRecipe = recipe ?? ideaRecipe ?? null;
  const latestIdea = savedFoodIdeas[0];

  if (sourceRecipe) {
    const smartGrocery = buildSmartGrocerySummary(sourceRecipe);
    const pantryCount = smartGrocery.probablyHave.length;
    const needCount = smartGrocery.needToBuy.length;
    return {
      id: `pantry-${sourceRecipe.id}`,
      title: 'Use what I have',
      body: pantryCount > 0
        ? `Kiko found ${pantryCount} pantry ${pantryCount === 1 ? 'basic' : 'basics'} and ${needCount} likely ${needCount === 1 ? 'buy' : 'buys'} for this recipe.`
        : 'Open a grocery list that separates likely pantry staples from what to buy.',
      cta: 'Build list',
      action: 'open_grocery',
      kind: 'useWhatYouHave',
      recipe: sourceRecipe,
      reason: 'Based on the current best recipe and pantry-friendly grocery flow.',
      tone: 'green',
    };
  }

  return {
    id: 'pantry-idea',
    title: 'Use what I have',
    body: latestIdea
      ? 'Start with your saved idea, then Okyo can check it and build a practical list.'
      : 'Paste what you have or what you crave, then Okyo can turn it into a plan.',
    cta: latestIdea ? 'Open idea' : 'Add idea',
    action: 'open_food_idea',
    kind: 'useWhatYouHave',
    reason: 'No recipe is ready yet, so start from a saved or pasted idea.',
    tone: 'green',
  };
}

function buildLowEffortCard(recipe: Recipe | null): HomeCommandCard {
  if (recipe) {
    return {
      id: `low-${recipe.id}`,
      title: 'Low-effort dinner',
      body: `${recipe.title} has the cleanest path for tonight.`,
      cta: 'Open recipe',
      action: 'open_recipe',
      kind: 'lowEffort',
      recipe,
      reason: 'Lowest total time among your local recipes.',
      tone: 'green',
    };
  }

  return {
    id: 'low-idea',
    title: 'Low-effort dinner',
    body: 'Save a craving or rough note when the fridge is giving nothing.',
    cta: 'Save an idea',
    action: 'open_food_idea',
    kind: 'lowEffort',
    reason: 'Fallback when no local recipe is ready.',
    tone: 'green',
  };
}

function buildAskOkyoCard(): HomeCommandCard {
  return {
    id: 'ask-okyo',
    title: 'Ask Okyo',
    body: 'Drop a messy craving, link, caption, or note and let Okyo check it.',
    cta: 'Start note',
    action: 'open_food_idea',
    kind: 'askOkyo',
    reason: 'Food Idea is the local mock-first ask flow for now.',
    tone: 'cream',
  };
}

function buildFoxFind(input: HomeCommandInput, quickRecipe: Recipe | null): HomeCommandCard {
  const latestIdea = input.savedFoodIdeas[0];

  if (latestIdea?.qualityReport) {
    return {
      id: `fox-${latestIdea.id}`,
      title: 'Daily Fox Find',
      body: `${latestIdea.title} looks ${getCookabilityLabel(latestIdea.qualityReport.cookabilityStatus)}. Kiko would fix the vague bits before you cook.`,
      cta: 'Open idea',
      action: latestIdea.extractedRecipe ? 'open_recipe' : 'open_food_idea',
      kind: 'foxFind',
      recipe: latestIdea.extractedRecipe,
      reason: 'Based on the most recent saved food idea and its Recipe Check.',
      tone: 'cream',
    };
  }

  if (quickRecipe) {
    return {
      id: `fox-${quickRecipe.id}`,
      title: 'Daily Fox Find',
      body: `Kiko found ${quickRecipe.title}: about ${getTotalMinutes(quickRecipe)} minutes and easy to adapt tonight.`,
      cta: 'Open recipe',
      action: 'open_recipe',
      kind: 'foxFind',
      recipe: quickRecipe,
      reason: 'Fastest local recipe candidate.',
      tone: 'cream',
    };
  }

  return {
    id: 'fox-start',
    title: 'Daily Fox Find',
    body: 'Kiko is ready to turn one saved idea, photo, or craving into a cookable plan.',
    cta: 'Save idea',
    action: 'open_food_idea',
    kind: 'foxFind',
    reason: 'No local dinner signal yet.',
    tone: 'cream',
  };
}

function buildTasteNote(input: HomeCommandInput) {
  const count = input.savedRecipes.length + input.savedFoodIdeas.length;

  if (count <= 0) {
    return 'Okyo learns on this device from what you save and cook.';
  }

  return `Okyo noticed ${count} saved dinner signal${count === 1 ? '' : 's'} on this device.`;
}

function findQuickRecipe(recipes: Array<Recipe | null | undefined>) {
  return recipes
    .filter((recipe): recipe is Recipe => Boolean(recipe?.id && recipe?.title))
    .sort((left, right) => getTotalMinutes(left) - getTotalMinutes(right))[0] ?? null;
}

function getHeadline() {
  const hour = new Date().getHours();
  if (hour < 11) return 'What should we make today?';
  if (hour < 17) return 'What should we eat next?';
  return 'What should we cook tonight?';
}

function getSubheadline() {
  return 'Scan food, save messy ideas, or pick a dinner Okyo can check and adapt.';
}

function getTotalMinutes(recipe: Recipe) {
  return recipe.totalTimeMinutes ?? recipe.prepTimeMinutes + recipe.cookTimeMinutes;
}

function getCookabilityLabel(status: RecipeQualityReport['cookabilityStatus']) {
  switch (status) {
    case 'cookable':
      return 'cookable';
    case 'needs_quick_fix':
      return 'fixable';
    case 'too_vague_to_trust':
    default:
      return 'too vague to trust yet';
  }
}
