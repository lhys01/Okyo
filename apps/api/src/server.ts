import { randomUUID } from 'node:crypto';

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { getAiConfig, getPublicAiConfig } from './config/aiConfig.js';
import { getCostControlConfig } from './config/costControlConfig.js';
import { validateEpicureConfigAtStartup } from './config/openRouter.js';
import {
  checkAndIncrementFableCap,
  checkAndIncrementGlobalAiCap,
  logCostEvent,
  scanRateLimitMiddleware,
} from './middleware/costControls.js';
import {
  awardXp,
  createChallenge,
  getLibrary,
  getRecipe,
  getRestaurantPack,
  getRestaurantPacks,
  getSavingsSummary,
  getScan,
  getWeeklyRankings,
  getXpDefinitions,
  saveRecipe,
} from './store.js';
import {
  AnalysisExpiredError,
  AnalysisNotFoundError,
  analyzePreparedDish,
  createAiRecipeCorrection,
  createAiScan,
  createAiTextRecipe,
  enrichRecipeCoaching,
  FoodRejectionError,
  generateRecipeForAnalysis,
  type RecipeGenerationPreferences,
} from './services/aiService.js';
import { CorrectionValidationError } from './services/correctionIntent.js';
import {
  createCorrectionDiagnostics,
  getCorrectionHttpStatus,
  logCorrectionRequest,
} from './services/correctionReliability.js';
import { askOkyoWithOpenRouter, isRecipeValidationFailure } from './services/openRouterProvider.js';
import {
  CURRENT_RECIPE_MODES,
  isLegacyRecipeMode,
  recipeModeInputSchema,
} from './services/recipeModes.js';
import type { ApiFailure, ApiResponse } from './types.js';

const port = Number(process.env.PORT ?? 8081);
export const app = express();
const maxImageDataUrlChars = 12_000_000;
const jsonBodyLimit = '16mb';

const recipeModeSchema = z.enum(['Normal', 'Lighter', 'Healthier', 'More Protein']);
const correctionRecipeSchema = z.object({
  id: z.string().trim().min(1).max(240),
  scanResultId: z.string().trim().min(1).max(240),
  title: z.string().trim().min(1).max(180),
  mode: recipeModeInputSchema,
  description: z.string().max(2000),
  prepTimeMinutes: z.number().nonnegative(),
  cookTimeMinutes: z.number().nonnegative(),
  totalTimeMinutes: z.number().nonnegative().optional(),
  activeTimeMinutes: z.number().nonnegative().optional(),
  passiveTimeMinutes: z.number().nonnegative().optional(),
  servings: z.number().int().min(1).max(100),
  skillLevel: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  estimatedHomemadeCost: z.number().nonnegative(),
  restaurantPriceEstimate: z.number().nonnegative().optional(),
  estimatedSavings: z.number(),
  ingredients: z.array(z.object({
    id: z.string().optional(), name: z.string().min(1), quantity: z.string().min(1),
    optional: z.boolean().optional(), pantryItem: z.boolean().optional(),
  }).passthrough()).min(1).max(100),
  steps: z.array(z.string().min(1)).min(1).max(100),
  structuredSteps: z.array(z.object({ text: z.string().min(1) }).passthrough()).max(100).optional(),
  substitutions: z.array(z.string()).max(100),
  pantryNote: z.string(),
  confidenceNote: z.string(),
  equipment: z.array(z.string()).max(100).optional(),
  nutritionEstimate: z.object({
    calories: z.number().nonnegative(), proteinGrams: z.number().nonnegative(),
    carbohydratesGrams: z.number().nonnegative(), fatGrams: z.number().nonnegative(),
    fiberGrams: z.number().nonnegative().optional(),
  }).optional(),
}).passthrough();
const scanSourceSchema = z.enum(['camera', 'photos', 'description']);
const imageDataUrlSchema = z.string()
  .min(1)
  .max(maxImageDataUrlChars)
  .refine((value) => /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value), {
    message: 'Image data URL must be a base64 jpeg, png, or webp data URL.',
  });
const scanImageMetadataSchema = z.object({
  uri: z.string().min(1).max(2000).optional(),
  dataUrl: imageDataUrlSchema.optional(),
  fileName: z.string().min(1).max(255).optional(),
  mimeType: z.string().min(1).max(120).regex(/^image\/(?:jpeg|jpg|png|webp)$/).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  dataUrlSizeBytes: z.number().int().nonnegative().max(maxImageDataUrlChars).optional(),
  source: scanSourceSchema.optional(),
  placeholder: z.boolean().optional(),
  conversionError: z.string().min(1).max(120).optional(),
}).strict();
const scanRequestSchema = z.object({
  source: scanSourceSchema.optional().default('camera'),
  mode: recipeModeInputSchema.optional().default('Normal'),
  image: scanImageMetadataSchema.optional(),
  mealDescription: z.string().trim().min(1).max(240).optional(),
  // Onboarding-collected personalization — all optional so older clients
  // keep working unchanged. See RecipeGenerationPreferences in aiService.ts.
  recipePriority: z.string().trim().min(1).max(60).optional(),
  cookingFrictionFollowUp: z.string().trim().min(1).max(60).optional(),
  dietaryAllergies: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  dietaryRestrictions: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  dietaryDislikes: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
}).superRefine((value, context) => {
  if (value.source === 'description' && !value.mealDescription) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A meal description is required for description scans.', path: ['mealDescription'] });
  }
  if (value.source === 'description' && value.image) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Description scans cannot include an image.', path: ['image'] });
  }
  if (value.source !== 'description' && value.mealDescription) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Meal descriptions require source description.', path: ['source'] });
  }
});
const analyzeScanRequestSchema = z.object({
  source: scanSourceSchema,
  mode: recipeModeInputSchema.optional().default('Normal'),
  image: scanImageMetadataSchema.optional(),
  mealDescription: z.string().trim().min(1).max(240).optional(),
}).superRefine((value, context) => {
  if (value.source === 'description' && !value.mealDescription) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A meal description is required for description scans.', path: ['mealDescription'] });
  }
  if (value.source === 'description' && value.image) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Description scans cannot include an image.', path: ['image'] });
  }
  if (value.source !== 'description' && value.mealDescription) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Meal descriptions require source description.', path: ['source'] });
  }
});
const analysisRecipeRequestSchema = z.object({
  mode: recipeModeInputSchema.optional().default('Normal'),
  dietaryAllergies: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  dietaryRestrictions: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  dietaryDislikes: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  recipeRequestId: z.string().trim().min(1).max(120).optional(),
  goalContext: z.object({
    primaryGoal: z.string().trim().min(1).max(60).optional(),
    secondaryGoals: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
    handsOnTimeMinutes: z.number().int().min(5).max(180).optional(),
    defaultServings: z.number().int().min(1).max(12).optional(),
    cookingPriority: z.string().trim().min(1).max(80).optional(),
    orderingFriction: z.string().trim().min(1).max(80).optional(),
    healthPriorities: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
    trackingPreference: z.string().trim().min(1).max(80).optional(),
    nutritionTargets: z.object({
      calories: z.number().int().min(1000).max(5000),
      proteinGrams: z.number().int().min(20).max(350),
      carbsGrams: z.number().int().min(0).max(700),
      fatGrams: z.number().int().min(20).max(250),
    }).optional(),
  }).optional(),
}).strict();
const challengeRequestSchema = z.object({
  recipeId: z.string().min(1),
  mode: recipeModeSchema.optional().default('Normal'),
  rating: z.enum(['Nailed it', 'Pretty close', 'Needs work', 'Not close']),
  matchScore: z.number().min(0).max(10).optional(),
});
const xpEventRequestSchema = z.object({
  eventType: z.string().min(1),
  sourceId: z.string().min(1).optional(),
});
const recipeCorrectionRequestSchema = z.object({
  correctionRequestId: z.string().trim().min(1).max(120).optional(),
  correctionNote: z.string().min(1).max(300).refine((value) => value.trim().length > 0, {
    message: 'Correction note is required.',
  }),
  dishNameOverride: z.string().trim().min(1).max(120).optional(),
  expectedSourceRecipeId: z.string().trim().min(1).max(240).optional(),
  canonicalRecipeId: z.string().trim().min(1).max(240).optional(),
  scanSessionId: z.string().trim().min(1).max(240).optional(),
  mode: recipeModeInputSchema.optional().default('Normal'),
  currentRecipe: correctionRecipeSchema.optional(),
  dietaryAllergies: z.preprocess(
    (value) => value == null ? undefined : value,
    z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  ),
  dietaryRestrictions: z.preprocess(
    (value) => value == null ? undefined : value,
    z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  ),
  dietaryDislikes: z.preprocess(
    (value) => value == null ? undefined : value,
    z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  ),
  goalContext: z.object({
    primaryGoal: z.string().trim().min(1).max(60).optional(),
    secondaryGoals: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
    handsOnTimeMinutes: z.number().int().min(5).max(180).optional(),
    defaultServings: z.number().int().min(1).max(12).optional(),
    cookingPriority: z.string().trim().min(1).max(80).optional(),
    orderingFriction: z.string().trim().min(1).max(80).optional(),
    healthPriorities: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
    trackingPreference: z.string().trim().min(1).max(80).optional(),
    nutritionTargets: z.object({
      calories: z.number().int().min(1000).max(5000), proteinGrams: z.number().int().min(20).max(350),
      carbsGrams: z.number().int().min(0).max(700), fatGrams: z.number().int().min(20).max(250),
    }).optional(),
  }).optional(),
}).strict();

app.use(cors());
app.use(express.json({ limit: jsonBodyLimit }));

app.get('/health', (_request, response) => {
  const aiConfig = getPublicAiConfig();

  sendOk(response, {
    status: 'ok',
    service: 'okyo-api',
    mode: 'mock',
    realAiEnabled: aiConfig.aiEnabled,
    databaseEnabled: false,
    timestamp: new Date().toISOString(),
  });
});
const askOkyoRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  recipe: z.custom<import('./types.js').Recipe>((value) => Boolean(value && typeof value === 'object')),
  currentStep: z.custom<import('./types.js').RecipeStep>((value) => value === undefined || Boolean(value && typeof value === 'object')).optional(),
  dietaryAllergies: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  dietaryRestrictions: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  dietaryDislikes: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  goalContext: z.object({
    primaryGoal: z.string().trim().min(1).max(60).optional(),
    secondaryGoals: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
    handsOnTimeMinutes: z.number().int().min(5).max(180).optional(),
    defaultServings: z.number().int().min(1).max(12).optional(),
    cookingPriority: z.string().trim().min(1).max(80).optional(),
    orderingFriction: z.string().trim().min(1).max(80).optional(),
    healthPriorities: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
    trackingPreference: z.string().trim().min(1).max(80).optional(),
    nutritionTargets: z.object({
      calories: z.number().int().min(1000).max(5000),
      proteinGrams: z.number().int().min(20).max(350),
      carbsGrams: z.number().int().min(0).max(700),
      fatGrams: z.number().int().min(20).max(250),
    }).optional(),
  }).strict().optional(),
}).strict();

app.get('/debug/ai-config', (_request, response) => {
  if (process.env.NODE_ENV === 'production') {
    sendError(response.status(404), 'not_found', 'Not found.');
    return;
  }
  sendOk(response, getPublicAiConfig());
});

app.post('/v1/scans', scanRateLimitMiddleware, async (request, response, next) => {
  try {
    const body = parseRequest(scanRequestSchema, normalizeScanRequestInput(request.body));
    logRecipeModeMigration('/v1/scans', getRequestMode(request.body), body.mode);

    // Configurable image size guard (secondary check; Zod schema is the primary).
    const imageSizeBytes = body.image?.dataUrlSizeBytes ?? body.image?.dataUrl?.length ?? 0;
    const maxScanImageBytes = getCostControlConfig().maxScanImageBytes;
    if (imageSizeBytes > maxScanImageBytes) {
      logCostEvent('scan_image_too_large', { imageSizeBytes, maxScanImageBytes });
      sendError(response.status(413), 'image_payload_too_large', 'This photo was too large to scan. Try a smaller image.');
      return;
    }

    // Global daily AI request cap — only counts real uploaded images.
    const isRealAiScan = Boolean(body.image) && !body.image?.placeholder;
    if (isRealAiScan && !checkAndIncrementGlobalAiCap()) {
      sendError(response.status(429), 'ai_daily_cap_exceeded', "Okyo has reached its daily scan limit. Try again tomorrow.");
      return;
    }

    // Fable 5 opt-in — private header only, never a user-facing toggle.
    // Missing/mismatched header always falls through to the default
    // OpenRouter path unchanged.
    const fableRequested = request.get('x-okyo-model') === 'fable';
    const fableEnabled = getAiConfig().fableEnabled;

    if (fableRequested && !fableEnabled) {
      console.log('[fable_route]', { requested: true, enabled: false, active: false, model: 'default', failClosed: true });
      sendError(response.status(403), 'fable_not_enabled', 'Fable 5 is not enabled.');
      return;
    }

    let fableActive = false;
    if (fableRequested && fableEnabled) {
      if (!checkAndIncrementFableCap()) {
        console.log('[fable_route]', { requested: true, enabled: true, active: false, model: 'default', failClosed: true });
        sendError(response.status(429), 'fable_daily_cap_exceeded', "Fable 5's daily limit has been reached. Try again tomorrow.");
        return;
      }
      fableActive = true;
    }
    console.log('[fable_route]', {
      requested: fableRequested,
      enabled: fableEnabled,
      active: fableActive,
      model: fableActive ? getAiConfig({ fableActive: true }).fableModel : 'default',
      failClosed: false,
    });

    const preferences = getScanPreferencesFromBody(body);

    if (body.mealDescription) {
      const result = await createAiTextRecipe({ mealDescription: body.mealDescription, mode: body.mode, fableActive, preferences });
      sendOk(response.status(201), { ...result, source: body.source });
      return;
    }

    logScanRequest(body, request.get('content-type'));
    const result = await createAiScan({
      image: body.image,
      mode: body.mode,
      source: body.source,
      fableActive,
      preferences,
    });

    sendOk(response.status(201), {
      ...result,
      image: getResponseImageMetadata(body.image),
      source: body.source,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/v1/scans/analyze', scanRateLimitMiddleware, async (request, response, next) => {
  try {
    const body = parseRequest(analyzeScanRequestSchema, normalizeScanRequestInput(request.body));
    logRecipeModeMigration('/v1/scans/analyze', getRequestMode(request.body), body.mode);

    const imageSizeBytes = body.image?.dataUrlSizeBytes ?? body.image?.dataUrl?.length ?? 0;
    const maxScanImageBytes = getCostControlConfig().maxScanImageBytes;
    if (imageSizeBytes > maxScanImageBytes) {
      logCostEvent('scan_image_too_large', { imageSizeBytes, maxScanImageBytes });
      sendError(response.status(413), 'image_payload_too_large', 'This photo was too large to scan. Try a smaller image.');
      return;
    }

    const isRealAiScan = Boolean(body.image) && !body.image?.placeholder;
    if (isRealAiScan && !checkAndIncrementGlobalAiCap()) {
      sendError(response.status(429), 'ai_daily_cap_exceeded', "Okyo has reached its daily scan limit. Try again tomorrow.");
      return;
    }

    const fableRequested = request.get('x-okyo-model') === 'fable';
    const fableEnabled = getAiConfig().fableEnabled;
    if (fableRequested && !fableEnabled) {
      sendError(response.status(403), 'fable_not_enabled', 'Fable 5 is not enabled.');
      return;
    }

    let fableActive = false;
    if (fableRequested && fableEnabled) {
      if (!checkAndIncrementFableCap()) {
        sendError(response.status(429), 'fable_daily_cap_exceeded', "Fable 5's daily limit has been reached. Try again tomorrow.");
        return;
      }
      fableActive = true;
    }

    if (body.image) logScanRequest(body, request.get('content-type'));
    const result = await analyzePreparedDish({
      image: body.image,
      mealDescription: body.mealDescription,
      mode: body.mode,
      source: body.source,
      fableActive,
    });
    sendOk(response.status(201), result);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/scans/analyze/:analysisId/recipe', async (request, response, next) => {
  try {
    const body = parseRequest(analysisRecipeRequestSchema, request.body);
    logRecipeModeMigration('/v1/scans/analyze/:analysisId/recipe', getRequestMode(request.body), body.mode);
    const result = await generateRecipeForAnalysis({
      analysisId: request.params.analysisId,
      mode: body.mode,
      dietaryAllergies: body.dietaryAllergies,
      dietaryRestrictions: body.dietaryRestrictions,
      dietaryDislikes: body.dietaryDislikes,
      recipeRequestId: body.recipeRequestId,
      goalContext: body.goalContext,
    });
    sendOk(response.status(201), result);
  } catch (error) {
    if (error instanceof AnalysisExpiredError) {
      sendError(response.status(410), 'analysis_expired', error.message);
      return;
    }
    if (error instanceof AnalysisNotFoundError) {
      sendError(response.status(404), 'analysis_not_found', error.message);
      return;
    }
    if (error instanceof z.ZodError) {
      next(error);
      return;
    }
    sendError(response.status(502), 'recipe_generation_failed', "Okyo couldn't finish this recipe. Try again.");
  }
});

app.get('/v1/scans/:scanId', (request, response) => {
  const scan = getScan(request.params.scanId);

  if (!scan) {
    sendNotFound(response, 'scan_not_found', 'Scan was not found in mock data.');
    return;
  }

  sendOk(response, { scan });
});

app.get('/v1/recipes/:recipeId', (request, response) => {
  const recipe = getRecipe(request.params.recipeId);

  if (!recipe) {
    sendNotFound(response, 'recipe_not_found', 'Recipe was not found in mock data.');
    return;
  }

  sendOk(response, { recipe });
});

app.post('/v1/recipes/:recipeId/save', (request, response) => {
  const recipe = getRecipe(request.params.recipeId);

  if (!recipe) {
    sendNotFound(response, 'recipe_not_found', 'Recipe was not found in mock data.');
    return;
  }

  const library = saveRecipe(recipe);
  sendOk(response, { saved: true, recipe, library });
});

app.get('/v1/library', (_request, response) => {
  sendOk(response, { recipes: getLibrary() });
});

app.get('/v1/savings', (_request, response) => {
  sendOk(response, getSavingsSummary());
});

app.post('/v1/challenges', (request, response) => {
  const body = parseRequest(challengeRequestSchema, request.body);
  const challenge = createChallenge(body);

  if (!challenge) {
    sendNotFound(response, 'recipe_not_found', 'Challenge recipe was not found in mock data.');
    return;
  }

  sendOk(response.status(201), { challenge });
});

app.post('/v1/xp-events', (request, response) => {
  const body = parseRequest(xpEventRequestSchema, request.body);
  const event = awardXp(body.eventType, body.sourceId);

  sendOk(response.status(201), {
    event,
    definitions: getXpDefinitions(),
  });
});

app.get('/v1/rankings/weekly', (_request, response) => {
  sendOk(response, getWeeklyRankings());
});

app.post('/v1/recipes/:recipeId/coaching', async (request, response, next) => {
  try {
    const result = await enrichRecipeCoaching(request.params.recipeId);
    if (!result) {
      sendNotFound(response, 'recipe_not_found', 'Recipe not found or expired. Please scan again.');
      return;
    }
    sendOk(response, result);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/recipes/:recipeId/ask', scanRateLimitMiddleware, async (request, response, next) => {
  try {
    const body = parseRequest(askOkyoRequestSchema, request.body);
    const result = await askOkyoWithOpenRouter({ ...body, config: getAiConfig() });
    sendOk(response, result);
  } catch (error) {
    next(error);
  }
});

// Regenerates a recipe from a user correction (e.g. wrong dish identified)
// without requiring a new photo/scan. Reuses the existing OpenRouter recipe
// pipeline via createAiRecipeCorrection — see aiService.ts for details.
app.post('/v1/recipes/:recipeId/correct', async (request, response, next) => {
  const diagnostics = createCorrectionDiagnostics({
    correctionRequestId: typeof request.body?.correctionRequestId === 'string'
      ? request.body.correctionRequestId
      : randomUUID(),
    sourceRecipeId: request.params.recipeId,
  });
  try {
    const body = parseRequest(recipeCorrectionRequestSchema, request.body);
    logRecipeModeMigration(
      '/v1/recipes/:recipeId/correct',
      getRequestMode(request.body),
      body.mode,
    );
    diagnostics.canonicalRecipeId = body.canonicalRecipeId;
    diagnostics.scanSessionId = body.scanSessionId;
    diagnostics.requestedSourceRevisionId = body.expectedSourceRecipeId ?? request.params.recipeId;
    const result = await createAiRecipeCorrection({
      correctionNote: body.correctionNote,
      diagnostics,
      dishNameOverride: body.dishNameOverride,
      expectedSourceRecipeId: body.expectedSourceRecipeId,
      canonicalRecipeId: body.canonicalRecipeId,
      scanSessionId: body.scanSessionId,
      mode: body.mode,
      currentRecipe: body.currentRecipe,
      recipeId: request.params.recipeId,
      dietaryAllergies: body.dietaryAllergies,
      dietaryRestrictions: body.dietaryRestrictions,
      dietaryDislikes: body.dietaryDislikes,
      goalContext: body.goalContext,
    });

    if (!result) {
      diagnostics.failureCategory = 'source_recipe_missing';
      logCorrectionRequest(diagnostics, 404);
      sendNotFound(response, 'recipe_not_found', 'Recipe not found or expired. Please scan again.');
      return;
    }

    logCorrectionRequest(diagnostics, 201);
    sendOk(response.status(201), result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      diagnostics.failureCategory = 'malformed_client_request';
      logRequestValidationFailure(
        '/v1/recipes/:recipeId/correct',
        request.body,
        error,
      );
      logCorrectionRequest(diagnostics, 400, error);
      sendError(response.status(400), 'validation_error', 'Request validation failed.');
      return;
    }

    const status = getCorrectionHttpStatus(error);
    logCorrectionRequest(diagnostics, status, error);
    if (status === 409) {
      sendError(response.status(409), 'stale_recipe_revision', 'This recipe changed before the update finished. Try again.');
      return;
    }
    if (status === 422) {
      sendError(response.status(422), 'recipe_correction_failed', 'We couldn’t update the recipe. Try again.');
      return;
    }
    if (status === 502 || status === 503) {
      sendError(response.status(status), 'recipe_correction_unavailable', 'We couldn’t update the recipe. Try again.');
      return;
    }
    next(error);
  }
});

app.get('/v1/restaurant-packs', (_request, response) => {
  sendOk(response, { packs: getRestaurantPacks() });
});

app.get('/v1/restaurant-packs/:packId', (request, response) => {
  const pack = getRestaurantPack(request.params.packId);

  if (!pack) {
    sendNotFound(response, 'pack_not_found', 'Restaurant pack was not found in mock data.');
    return;
  }

  sendOk(response, { pack });
});

app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof FoodRejectionError) {
    sendError(
      response.status(422),
      error.rejectionType,
      error.message,
      { rejectionType: error.rejectionType, scanState: error.scanState, confidence: error.confidence },
    );
    return;
  }

  if (isPayloadTooLargeError(error)) {
    sendError(
      response.status(413),
      'image_payload_too_large',
      'This photo was too large to scan. Try a smaller image.',
    );
    return;
  }

  if (error instanceof z.ZodError) {
    logRequestValidationFailure(request.route?.path ?? request.path, request.body, error);
    sendError(response.status(400), 'validation_error', 'Request validation failed.');
    return;
  }

  if (error instanceof CorrectionValidationError) {
    sendError(
      response.status(422),
      'recipe_correction_failed',
      'We couldn’t update the recipe. Try again.',
    );
    return;
  }

  if (isRecipeValidationFailure(error)) {
    sendError(
      response.status(422),
      'recipe_validation_failed',
      'Okyo could not build a safe complete recipe from this scan. Try another photo or scan again.',
      getRecipeValidationErrorDetails(error),
    );
    return;
  }

  sendError(response.status(500), 'internal_error', 'Unexpected API error.');
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Okyo API listening on http://localhost:${port}`);
    // Best-effort startup warning if the Epicure enrichment layer is misconfigured.
    // Never fatal — the API boots regardless and enrichment simply stays off.
    validateEpicureConfigAtStartup();
  });
}

function parseRequest<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  return schema.parse(value);
}

function logRecipeModeMigration(
  endpoint: string,
  receivedMode: unknown,
  normalizedMode: string,
) {
  if (!isLegacyRecipeMode(receivedMode)) {
    return;
  }
  console.log('recipe_mode_migrated', {
    endpoint,
    receivedMode,
    normalizedMode,
  });
}

function logRequestValidationFailure(
  endpoint: string,
  requestBody: unknown,
  error: z.ZodError,
) {
  for (const issue of error.issues) {
    const invalidField = issue.path.length > 0 ? issue.path.join('.') : 'request';
    const receivedValue = getValueAtPath(requestBody, issue.path);
    console.log('request_validation_failed', {
      endpoint,
      invalidField,
      receivedValue: getSafeValidationLogValue(invalidField, receivedValue),
      expectedCurrentValues: invalidField === 'mode' ? CURRENT_RECIPE_MODES : undefined,
      finalStatus: 400,
    });
  }
}

function getRequestMode(body: unknown): unknown {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>).mode
    : undefined;
}

function getValueAtPath(value: unknown, path: Array<string | number>): unknown {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

function getSafeValidationLogValue(field: string, value: unknown): unknown {
  if (/(?:correctionNote|mealDescription|dataUrl|image|uri)/i.test(field)) {
    return typeof value === 'string' ? `[redacted string length=${value.length}]` : '[redacted]';
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value;
  }
  return Array.isArray(value) ? `[array length=${value.length}]` : '[object]';
}

function sendOk<T>(response: Response, data: T) {
  const payload: ApiResponse<T> = { ok: true, data };
  response.json(payload);
}

function sendNotFound(response: Response, code: string, message: string) {
  sendError(response.status(404), code, message);
}

function sendError(response: Response, code: string, message: string, details?: unknown) {
  const payload: ApiFailure = {
    ok: false,
    error: { code, message, details },
  };
  response.json(payload);
}

function getRecipeValidationErrorDetails(error: unknown) {
  if (error && typeof error === 'object' && 'failure' in error) {
    const failure = (error as { failure?: { reason?: string; openRouterErrorMessage?: string } }).failure;
    return {
      reason: failure?.reason ?? 'recipe_validation_failed',
      validationMessage: failure?.openRouterErrorMessage,
    };
  }
  return undefined;
}

function getScanPreferencesFromBody(body: z.infer<typeof scanRequestSchema>): RecipeGenerationPreferences | undefined {
  if (
    !body.recipePriority &&
    !body.cookingFrictionFollowUp &&
    !body.dietaryAllergies?.length &&
    !body.dietaryRestrictions?.length &&
    !body.dietaryDislikes?.length
  ) {
    return undefined;
  }

  return {
    recipePriority: body.recipePriority,
    cookingFrictionFollowUp: body.cookingFrictionFollowUp,
    dietaryAllergies: body.dietaryAllergies,
    dietaryRestrictions: body.dietaryRestrictions,
    dietaryDislikes: body.dietaryDislikes,
  };
}

function logScanRequest(body: z.infer<typeof scanRequestSchema>, contentType: string | undefined) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log('api_scan_body_keys', {
    bodyKeys: Object.keys(body).sort(),
    imageKeys: body.image ? Object.keys(body.image).sort() : [],
  });
  console.log('api_scan_image_exists', { exists: Boolean(body.image) });
  console.log('api_scan_image_data_url_exists', { exists: Boolean(body.image?.dataUrl) });
  console.log('api_scan_image_data_url_length', { length: body.image?.dataUrl?.length ?? 0 });
  console.log('api_scan_provider_visible_start', {
    contentType,
    hasDataUrl: Boolean(body.image?.dataUrl),
    hasUri: Boolean(body.image?.uri),
    model: getPublicAiConfig().visionModel,
    placeholder: Boolean(body.image?.placeholder),
    provider: getPublicAiConfig().provider,
  });
  console.log('api_scan_provider_visible_result', {
    providerVisible: isProviderVisibleImage(body.image),
    reason: getProviderVisibleReason(body.image),
  });
  console.log('api_scan_request_received', {
    bodyKeys: Object.keys(body).sort(),
    contentType,
    source: body.source,
    timestamp: new Date().toISOString(),
    mode: body.mode,
    imageExists: Boolean(body.image),
    imageDataUrlExists: Boolean(body.image?.dataUrl),
    imageDataUrlLength: body.image?.dataUrl?.length ?? 0,
    imageDataUrlSizeBytes: body.image?.dataUrlSizeBytes,
    imageMimeType: body.image?.mimeType,
    imageConversionError: body.image?.conversionError,
    imageUriKind: body.image?.uri?.startsWith('http')
      ? 'remote_url'
      : body.image?.uri
        ? 'local_or_private_uri'
        : 'none',
    imageWidth: body.image?.width,
    imageHeight: body.image?.height,
    jsonBodyLimit,
    maxImageDataUrlChars,
  });
}

function normalizeScanRequestInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const body = value as Record<string, unknown>;
  const imageInput = body.image && typeof body.image === 'object' && !Array.isArray(body.image)
    ? body.image as Record<string, unknown>
    : {};
  const aliasedDataUrl = getStringValue(imageInput.dataUrl) ??
    getStringValue(imageInput.imageDataUrl) ??
    getStringValue(body.imageDataUrl) ??
    getStringValue(body.dataUrl);
  const normalizedImage = Object.fromEntries(
    Object.entries(imageInput).filter(([key]) => key !== 'imageDataUrl'),
  );

  if (aliasedDataUrl) {
    normalizedImage.dataUrl = aliasedDataUrl;
  }

  return {
    ...body,
    image: Object.keys(normalizedImage).length > 0 ? normalizedImage : body.image,
  };
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isProviderVisibleImage(image: z.infer<typeof scanImageMetadataSchema> | undefined) {
  return Boolean(
    image &&
    !image.placeholder &&
    (
      image.dataUrl?.startsWith('data:image/') ||
      image.uri?.startsWith('https://') ||
      image.uri?.startsWith('http://')
    ),
  );
}

function getProviderVisibleReason(image: z.infer<typeof scanImageMetadataSchema> | undefined) {
  if (!image) {
    return 'missing_image';
  }
  if (image.placeholder) {
    return 'placeholder_image';
  }
  if (image.dataUrl?.startsWith('data:image/')) {
    return 'data_url_visible';
  }
  if (image.uri?.startsWith('https://') || image.uri?.startsWith('http://')) {
    return 'remote_uri_visible';
  }
  if (image.conversionError) {
    return image.conversionError;
  }

  return 'no_provider_visible_image';
}

function isPayloadTooLargeError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typedError = error as { status?: number; type?: string };
  return typedError.status === 413 || typedError.type === 'entity.too.large';
}

function getResponseImageMetadata(image: z.infer<typeof scanImageMetadataSchema> | undefined) {
  if (!image) {
    return undefined;
  }

  const { dataUrl: _dataUrl, ...safeImage } = image;
  return {
    ...safeImage,
    hasDataUrl: Boolean(image.dataUrl),
  };
}
