export type RecipeMode = 'Restaurant Copy' | 'Budget' | 'Healthy';

export type DetectedComponent = {
  name: string;
  confidence: number;
  estimatedQuantity?: number;
};

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type ScanSource = 'camera' | 'photos';

export type ScanState =
  | 'clear_food'
  | 'food_present_uncertain_dish'
  | 'partial_food'
  | 'not_food'
  | 'too_unclear';

export type ScanImageMetadata = {
  uri?: string;
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  dataUrlSizeBytes?: number;
  source?: ScanSource;
  placeholder?: boolean;
  conversionError?: string;
};

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

export type StepImagePromptData = {
  subject: string;    // e.g. "chicken thighs"
  action: string;     // e.g. "searing"
  vessel: string;     // e.g. "cast iron skillet"
  visualState: string; // e.g. "golden brown crust forming"
  cameraAngle: string; // e.g. "45 degree"
  style: string;      // e.g. "professional food photography"
};

export type RecipeStep = {
  phase?: number; // 1-6 AI-assigned cooking phase (1=Prep, 2=Setup, 3=Cook, 4=Assemble, 5=Finish, 6=Serve)
  title?: string;
  text: string;
  creates?: string[]; // State tags this step produces (e.g. ["cooked_chicken", "sauce"])
  requires?: string[]; // State tags from earlier steps this step depends on
  lookFor?: string; // Visual/sensory cue during the step ("Chicken edges turn golden brown.")
  doneWhen?: string; // Definitive completion signal ("No pink remains, internal temp 165°F / 74°C.")
  chefTip?: string; // Food-specific technique advice ("Pat chicken dry so skin browns rather than steams.")
  ingredientsUsed?: string[];    // Names of recipe ingredients actively handled in this step
  toolsUsed?: string[];          // Equipment/tools needed for this step
  stepImagePrompt?: string;      // Visual description for AI image generation (Sprint C)
  stepImagePromptData?: StepImagePromptData; // Structured form — preparation for Sprint C image generation
  commonQuestion?: string;       // Beginner question answered by this step (Sprint D)
  commonQuestionAnswer?: string; // Answer to commonQuestion
  decisionPoint?: string; // A yes/no sensory check the cook makes at this step (e.g. "Is the chicken golden brown yet?")
  ifYes?: string;         // What to do when the answer is yes (e.g. "Flip it now.")
  ifNo?: string;          // What to do when the answer is no (e.g. "Cook another 1–2 minutes.")
  why?: string; // Reason this step matters ("Searing locks in moisture and builds flavor.")
  commonMistake?: string; // What to avoid ("Moving the chicken too early prevents browning.")
  estimatedMinutes?: number; // Numeric time estimate from AI (preferred over timeEstimate string)
  timeEstimate?: string;
  visualCue?: string;
  whyItMatters?: string; // legacy — prefer `why`
  safetyNote?: string; // legacy — prefer `commonMistake`
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
  isCompactRecipe?: boolean;
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

export type XpEventDefinition = {
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

export type CompletedChallenge = {
  id: string;
  recipeId: string;
  recipeTitle: string;
  mode: RecipeMode;
  rating: 'Nailed it' | 'Pretty close' | 'Needs work' | 'Not close';
  completedAt: string;
  matchScore: number;
  moneySaved: number;
  xpEarned: number;
  badgeUnlocked?: string;
};

export type AwardedXpEvent = {
  id: string;
  eventType: string;
  points: number;
  awardedAt: string;
  sourceId?: string;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
