export type RecipeMode = 'Restaurant Copy' | 'Budget' | 'Healthy';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type RecipeImageStatus =
  | 'ready'
  | 'loading'
  | 'missing'
  | 'failed'
  | 'unavailable'
  | (string & {});

export type ScanState =
  | 'clear_food'
  | 'food_present_uncertain_dish'
  | 'partial_food'
  | 'not_food'
  | 'too_unclear';

export type ScanResult = {
  id: string;
  dishName: string;
  bestGuessDishName?: string;
  bestGuessNote?: string;
  possibleDishNames?: string[];
  scanState?: ScanState;
  restaurantStyle: string;
  restaurantPrice: number;
  homemadeCost: number;
  estimatedSavings: number;
  confidence: number;
  matchScore: number;
  difficulty: Difficulty;
  modes: RecipeMode[];
  recipeId: string;
  groceryListId: string;
  shareCardId: string;
};

export type RecipeIngredient = {
  name: string;
  quantity: string;
  pantryItem?: boolean;
};

export type RecipeIngredientGroup = {
  component: string;
  items: RecipeIngredient[];
};

export type CookingTerm = {
  term: string;
  meaning: string;
};

export type RecipeStep = {
  text: string;
  timeEstimate?: string;
  visualCue?: string;
  whyItMatters?: string;
  safetyNote?: string;
  flavorBoost?: string;
  cookingTerm?: CookingTerm;
};

export type GroceryCategory =
  | 'Produce'
  | 'Protein'
  | 'Bakery / Bread'
  | 'Dairy'
  | 'Sauces / Condiments'
  | 'Pantry'
  | 'Spices'
  | 'Noodles / Grains'
  | 'Garnish'
  | 'Other'
  | 'Bakery'
  | 'Beverages';

export type GroceryListItem = {
  name: string;
  quantity: string;
  category: GroceryCategory;
  pantryItem?: boolean;
  pantryStaple?: boolean;
  sourceIngredient?: string;
  shoppingNote?: string;
};

export type Recipe = {
  id: string;
  scanResultId: string;
  // Generated/hosted recipe image when available. Mock recipes may use local
  // bundled asset URIs so cards can exercise the same image path as production.
  imageUrl?: string;
  imageStatus?: RecipeImageStatus;
  // Snapshot of the user's real scan photo, attached when the recipe is saved so
  // the library card can show the actual meal. Only ever a real uploaded image.
  imageUri?: string;
  title: string;
  mode: RecipeMode;
  description: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes?: number;
  activeTimeMinutes?: number;
  servings: number;
  skillLevel?: Difficulty;
  difficulty: Difficulty;
  estimatedHomemadeCost: number;
  estimatedSavings: number;
  ingredients: RecipeIngredient[];
  ingredientGroups?: RecipeIngredientGroup[];
  steps: string[];
  structuredSteps?: RecipeStep[];
  substitutions: string[];
  pantryNote: string;
  confidenceNote: string;
  mainIngredientsSummary?: string;
  equipment?: string[];
  bestFor?: string;
  avoidMistake?: string;
  mistakeWarning?: string;
  storageAndReheating?: string;
  storage?: string;
  groceryItems?: GroceryListItem[];
  spicePairings?: string[];
  cookingTerms?: CookingTerm[];
};

export type GroceryList = {
  id: string;
  recipeId: string;
  title: string;
  items: GroceryListItem[];
};

export type ShareCard = {
  id: string;
  scanResultId?: string;
  kind: 'scan-result' | 'ranking' | 'badge';
  headline: string;
  subheadline: string;
  savedAmount?: number;
  matchScore?: number;
  footer: string;
};

export type RestaurantPackDish = {
  id: string;
  dishName: string;
  restaurantPrice: number;
  homemadeCost: number;
  estimatedSavings: number;
  difficulty: Difficulty;
};

export type RestaurantPack = {
  id: string;
  name: string;
  dishes: RestaurantPackDish[];
};

export type XpEvent = {
  id: string;
  label: string;
  points: number;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
};

export type LeaderboardEntry = {
  id: string;
  rank: number;
  displayName: string;
  category: string;
  value: string;
  xp: number;
};
