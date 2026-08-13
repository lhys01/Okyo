import type { GroceryList, Recipe, RecipeMode, ScanResult, ScanState, ShareCard } from '../mocks';

export type OkyoModelOverride = 'fable';

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };

export type ScanSource = 'camera' | 'photos' | 'description' | 'mock';

export type AiSource = 'openrouter_ai' | 'mock_ai' | 'fallback_ai';
export type ScanStatus = 'success' | 'partial' | 'rejected' | 'failed';
export type ScanRejectionType = 'ingredients_only' | 'not_food' | 'unclear_image' | 'ai_failed';

export type AiDebugMetadata = {
  aiSource: AiSource;
  aiProvider?: string;
  visionModel?: string;
  recipeModel?: string;
  fallbackReason?: string;
  confidence?: number;
};

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

export type CreateScanRequest = {
  source: ScanSource;
  mode?: RecipeMode;
  image?: ScanImageMetadata;
  mealDescription?: string;
  // Onboarding-collected personalization — all optional, mirrors the API's
  // RecipeGenerationPreferences. Older requests omit these unchanged.
  recipePriority?: string;
  cookingFrictionFollowUp?: string;
  dietaryRestrictions?: string[];
  dietaryDislikes?: string[];
  goalContext?: GoalContext;
};

export type GoalContext = {
  primaryGoal?: string;
  secondaryGoals?: string[];
  handsOnTimeMinutes?: number;
  defaultServings?: number;
  cookingPriority?: string;
  orderingFriction?: string;
  healthPriorities?: string[];
  trackingPreference?: string;
  nutritionTargets?: { calories: number; proteinGrams: number; carbsGrams: number; fatGrams: number };
};

export type AnalyzeScanRequest = Pick<CreateScanRequest, 'source' | 'mode' | 'image' | 'mealDescription'>;

export type AnalyzeScanResult = {
  analysisId: string;
  dishName: string;
  confidence: number;
  inputKind: 'prepared_dish' | 'raw_ingredients' | 'not_food' | 'unclear';
  scanState: ScanState;
  expiresAt: string;
};

export type GenerateRecipeFromAnalysisRequest = {
  mode?: RecipeMode;
  dietaryRestrictions?: string[];
  dietaryDislikes?: string[];
  recipeRequestId?: string;
  goalContext?: GoalContext;
};

export type GenerateRecipeFromAnalysisResult = Omit<CreateScanResult, 'source'> & {
  source?: ScanSource;
};

export type CorrectRecipeRequest = {
  correctionRequestId?: string;
  correctionNote: string;
  dishNameOverride?: string;
  expectedSourceRecipeId?: string;
  canonicalRecipeId?: string;
  scanSessionId?: string;
  mode?: RecipeMode;
  currentRecipe?: Recipe;
  dietaryRestrictions?: string[];
  dietaryDislikes?: string[];
  goalContext?: GoalContext;
};

export type AskOkyoRequest = {
  question: string;
  recipe: Recipe;
  currentStep?: Recipe['structuredSteps'] extends (infer T)[] | undefined ? T : never;
  dietaryRestrictions?: string[];
  dietaryDislikes?: string[];
  goalContext?: GoalContext;
};

export type AskOkyoResult = { answer: string; suggestedCorrection?: string };

export type CreateScanResult = {
  status?: ScanStatus;
  scan?: ScanResult;
  scanId?: string;
  recipe?: Recipe;
  recipes?: Recipe[];
  groceryList?: GroceryList;
  shareCard?: ShareCard;
  image?: ScanImageMetadata;
  note?: string;
  rejectionType?: ScanRejectionType;
  rejectionReason?: string;
  partialReason?: string;
  scanState?: ScanState;
  uploadedImage?: boolean;
  source: ScanSource;
} & Partial<AiDebugMetadata>;
