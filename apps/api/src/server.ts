import { initializeCrashReporting, captureServerException } from './observability/sentry.js';
import { executeDurableRequest, DurableRequestPendingError, DurableRequestConflictError } from './persistence/idempotency.js';
import { productionReadiness } from './services/productionReadiness.js';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { cleanupPersistentRuntime, database } from './persistence/database.js';
import { ownerScope } from './persistence/runtimeStore.js';

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { getAiConfig, getPublicAiConfig } from './config/aiConfig.js';
import { isCorsOriginAllowed } from './config/cors.js';
import { getCostControlConfig } from './config/costControlConfig.js';
import { getRuntimeSafetyConfig } from './config/runtimeSafety.js';
import { isFableModelOptIn } from './config/modelAllowlist.js';
import { validateEpicureConfigAtStartup } from './config/openRouter.js';
import {
  AiDailyCapExceededError,
  checkAndIncrementFableCap,
  getClientIpForScope,
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
import { askOkyoWithOpenRouter, isRecipeValidationFailure, OpenRouterProviderError } from './services/openRouterProvider.js';
import {
  CURRENT_RECIPE_MODES,
  isLegacyRecipeMode,
  recipeModeInputSchema,
} from './services/recipeModes.js';
import {
  getRequestContext,
  requestContextMiddleware,
  runWithRequestControl,
} from './observability/requestContext.js';
import { renderPrometheusMetrics } from './observability/metrics.js';
import { logStructured } from './observability/structuredLogger.js';
import { executeIdempotent, IdempotencyConflictError, idempotencyScope } from './middleware/idempotency.js';
import {
  getInFlightRequestCount,
  isDraining,
  operationalSecurityHeaders,
  requestLoadSheddingMiddleware,
  setDraining,
} from './middleware/operationalSafety.js';
import { requestLifecycleMiddleware } from './middleware/requestLifecycle.js';
import { AiCircuitOpenError, AiSaturatedError, getAiExecutionSnapshot } from './services/aiExecutionGuard.js';
import { createMockLoadTestScan, isSafeLocalLoadTestEnvironment, MockLoadTestError, parseMockLoadTestScenario } from './services/loadTestMock.js';
import { AccountDeletionError, deleteAuthenticatedAccount } from './services/accountDeletion.js';
import { optionalAuthenticatedUser, requireAuthenticatedUser, requireAiUser } from './middleware/requireAuthenticatedUser.js';
import { getAccountCapabilities } from './services/accountCapabilities.js';
import { SharedAiQuotaUnavailableError } from './services/sharedAiQuota.js';
import type { ApiFailure, ApiResponse } from './types.js';

const port = Number(process.env.PORT ?? 8081);
initializeCrashReporting();
let runtimeCleanupTimer: NodeJS.Timeout | undefined;
export const app = express();
// Mobile bounds uploads below 2.5 MB data-URL bytes. Keep a small protocol
// allowance here and reject oversized payloads before they can pressure heap.
const maxImageDataUrlChars = 2_750_000;
const jsonBodyLimit = '3mb';

export class RequestDeadlineExceededError extends Error {
  constructor() {
    super('The request exceeded its processing deadline.');
    this.name = 'RequestDeadlineExceededError';
  }
}

export class ClientDisconnectedError extends Error {
  constructor() {
    super('The client disconnected.');
    this.name = 'ClientDisconnectedError';
  }
}

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
    trackingPreference: z.string().trim().min(1).max(320).optional(),
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
    trackingPreference: z.string().trim().min(1).max(320).optional(),
    nutritionTargets: z.object({
      calories: z.number().int().min(1000).max(5000), proteinGrams: z.number().int().min(20).max(350),
      carbsGrams: z.number().int().min(0).max(700), fatGrams: z.number().int().min(20).max(250),
    }).optional(),
  }).optional(),
}).strict();

app.set('trust proxy', getRuntimeSafetyConfig().trustProxy);
app.use(requestContextMiddleware);
app.use(requestLifecycleMiddleware);
app.use(operationalSecurityHeaders);
app.use(requestLoadSheddingMiddleware);
app.use(cors({
  origin: (origin, callback) => callback(null, isCorsOriginAllowed(origin)),
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Okyo-Anon-Id', 'X-Okyo-Request-Id', 'X-Okyo-Model'],
  maxAge: 86_400,
}));
app.use(express.json({ limit: jsonBodyLimit }));

// Only the isolated local harness may hold read requests open to model a slow
// dependency. Production requests never enter this path.
app.use((request, _response, next) => {
  if (!isSafeLocalLoadTestEnvironment(process.env) || request.method !== 'GET' ||
      request.path.startsWith('/internal/')) { next(); return; }
  const rawDelay = request.get('x-okyo-load-delay-ms');
  if (rawDelay === undefined) { next(); return; }
  const delayMs = Number(rawDelay);
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 5_000) {
    next(new MockLoadTestError(400, 'invalid_load_test_delay'));
    return;
  }
  setTimeout(next, delayMs);
});

const ideaSubmissionSchema = z.object({
  category: z.enum(['idea', 'improvement', 'bug']),
  message: z.string().trim().min(8).max(1000),
}).strict();

app.post('/v1/ideas', optionalAuthenticatedUser, async (request, response) => {
  const parsed = ideaSubmissionSchema.safeParse(request.body);
  if (!parsed.success) {
    sendError(response.status(400), 'validation_error', 'Add a little more detail before sending your idea.');
    return;
  }
  try {
    // A hashed server-derived scope limits spam without storing a person's IP.
    const quota = await database().query(
      'SELECT okyo_private.okyo_reserve_quota($1::text[], $2::integer[]) AS accepted',
      [[`ideas:${ownerScope()}`], [5]],
    );
    if (quota.rows[0]?.accepted !== true) {
      sendError(response.status(429), 'idea_limit_reached', 'You’ve sent a few ideas today. Please come back tomorrow.');
      return;
    }
    const id = randomUUID();
    await database().query(
      'INSERT INTO okyo_private.idea_submissions (id, category, message) VALUES ($1, $2, $3)',
      [id, parsed.data.category, parsed.data.message],
    );
    sendOk(response.status(201), { id });
  } catch {
    sendError(response.status(503), 'idea_board_unavailable', 'We couldn’t send your idea right now. Try again in a moment.');
  }
});

app.get('/health', (_request, response) => {
  sendOk(response, {
    status: 'ok',
    service: 'okyo-api',
    readinessPath: '/ready',
    timestamp: new Date().toISOString(),
  });
});

app.get('/live', (_request, response) => {
  sendOk(response, { status: 'live', service: 'okyo-api', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_request, response, next) => {
  try {
    const dependencies = await productionReadiness();
    const ready = !isDraining() && (process.env.NODE_ENV !== 'production' || dependencies.productionAiEnabled);
    const requestIdHeader = response.getHeader('x-okyo-request-id');
    const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : randomUUID();
    response.setHeader('x-okyo-request-id', requestId);
    const payload = {
      status: ready ? 'ready' : 'not_ready',
      service: 'okyo-api',
      draining: isDraining(),
      ...dependencies,
      inFlightRequests: getInFlightRequestCount(),
      ai: getAiExecutionSnapshot(),
      requestId,
      timestamp: new Date().toISOString(),
    };
    if (ready) sendOk(response, payload);
    else sendError(response.status(503), 'not_ready', 'This instance is not ready to receive production traffic.', payload);
  } catch (error) { next(error); }
});

app.get('/internal/metrics', (request, response) => {
  const token = process.env.METRICS_TOKEN?.trim();
  const provided = request.get('authorization');
  if (process.env.NODE_ENV === 'production' && (!token || provided !== `Bearer ${token}`)) {
    sendError(response.status(404), 'not_found', 'Not found.');
    return;
  }
  response.type('text/plain').send(renderPrometheusMetrics());
});

app.get('/internal/load-test/status', (_request, response) => {
  if (!isSafeLocalLoadTestEnvironment(process.env)) {
    sendError(response.status(404), 'not_found', 'Not found.');
    return;
  }
  sendOk(response, {
    mode: 'local-mock', provider: 'synthetic', externalServices: false,
    rssBytes: process.memoryUsage().rss,
    heapUsedBytes: process.memoryUsage().heapUsed,
    cpuUsageMicros: process.cpuUsage(),
    inFlightRequests: getInFlightRequestCount(),
    ai: getAiExecutionSnapshot(),
  });
});

app.get('/internal/load-test/session', (request, response) => {
  if (!isSafeLocalLoadTestEnvironment(process.env)) {
    sendError(response.status(404), 'not_found', 'Not found.');
    return;
  }
  const user = request.get('x-okyo-load-user') ?? '';
  if (!/^load_[A-Za-z0-9_-]{4,80}$/.test(user) || request.get('authorization')) {
    sendError(response.status(400), 'invalid_load_test_identity', 'Synthetic identity required.');
    return;
  }
  sendOk(response, { active: true, user });
});

// Account creation is provided by Clerk in configured builds. Apple requires
// an in-app, server-side deletion path; this endpoint verifies the Clerk
// session itself and never trusts a user ID supplied by the mobile client.
app.delete('/v1/account', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const result = await deleteAuthenticatedAccount(request.get('authorization'));
    logStructured('info', 'account_deletion_completed', {
      revenuecat_customer_deletion_requested: result.revenueCatCustomerDeletionRequested,
      apple_authorization_revocation: result.appleAuthorizationRevocation,
    });
    sendOk(response, {
      deleted: true,
      appleAuthorizationRevocation: result.appleAuthorizationRevocation,
    });
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      sendError(response.status(error.status), error.code, error.userMessage, {
        requestId: getRequestContext()?.requestId,
        failureStep: error.failureStep,
      });
      return;
    }
    next(error);
  }
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
    trackingPreference: z.string().trim().min(1).max(320).optional(),
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

app.post('/v1/scans', requireAiUser, productionAiDisabled, scanRateLimitMiddleware, async (request, response, next) => {
  try {
    const body = parseRequest(scanRequestSchema, normalizeScanRequestInput(request.body));
    logRecipeModeMigration('/v1/scans', getRequestMode(request.body), body.mode);
    const result = await executeIdempotent({
      key: request.get('idempotency-key') ?? undefined,
      scope: isSafeLocalLoadTestEnvironment(process.env)
        ? `load:${request.get('x-okyo-load-user') ?? ''}`
        : idempotencyScope(null, getClientIpForScope(request)),
      fingerprintSource: body,
      operation: () => executeScanWork(request, response, body),
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

async function executeScanWork(
  request: Request,
  response: Response,
  body: z.infer<typeof scanRequestSchema>,
) {
  // Configurable image size guard (the schema is the first guard).
  const imageSizeBytes = body.image?.dataUrlSizeBytes ?? body.image?.dataUrl?.length ?? 0;
  const maxScanImageBytes = getCostControlConfig().maxScanImageBytes;
  if (imageSizeBytes > maxScanImageBytes) {
    logCostEvent('scan_image_too_large', { imageSizeBytes, maxScanImageBytes });
    throw new ImagePayloadTooLargeError();
  }

  if (isSafeLocalLoadTestEnvironment(process.env)) {
    const key = request.get('idempotency-key') ?? '';
    const syntheticUser = request.get('x-okyo-load-user') ?? '';
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(key) || !/^load_[A-Za-z0-9_-]{4,80}$/.test(syntheticUser) || request.get('authorization')) {
      throw new MockLoadTestError(400, 'invalid_load_test_identity');
    }
    const delayHeader = request.get('x-okyo-load-delay-ms');
    const delayMs = delayHeader === undefined ? undefined : Number(delayHeader);
    return runWithRequestDeadline(request, response, () => createMockLoadTestScan({
      scenario: parseMockLoadTestScenario(request.get('x-okyo-load-scenario')),
      delayMs,
      idempotencyKey: `${syntheticUser}:${key}`,
    }));
  }

  const fableRequested = isFableModelOptIn(request.get('x-okyo-model'));
  const fableEnabled = getAiConfig().fableEnabled;
  if (fableRequested && !fableEnabled) throw new FableNotEnabledError();

  let fableActive = false;
  if (fableRequested && fableEnabled) {
    if (!checkAndIncrementFableCap()) throw new FableDailyCapExceededError();
    fableActive = true;
  }
  logStructured('info', 'ai_model_route', {
    active: fableActive,
    requested: fableRequested,
    model: fableActive ? getAiConfig({ fableActive: true }).fableModel : getAiConfig().openRouterTextModel,
  });

  const preferences = getScanPreferencesFromBody(body);
  return runWithRequestDeadline(request, response, async () => {
    if (body.mealDescription) {
      return createAiTextRecipe({ mealDescription: body.mealDescription, mode: body.mode, fableActive, preferences });
    }
    logScanRequest(body, request.get('content-type'));
    return createAiScan({
      image: body.image,
      mode: body.mode,
      source: body.source,
      fableActive,
      preferences,
    });
  });
}

app.post('/v1/scans/analyze', requireAiUser, productionAiDisabled, scanRateLimitMiddleware, async (request, response, next) => {
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

    const fableRequested = isFableModelOptIn(request.get('x-okyo-model'));
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
    const result = await runWithRequestDeadline(request, response, () => analyzePreparedDish({
      image: body.image,
      mealDescription: body.mealDescription,
      mode: body.mode,
      source: body.source,
      fableActive,
    }));
    sendOk(response.status(201), result);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/scans/analyze/:analysisId/recipe', requireAiUser, productionAiDisabled, scanRateLimitMiddleware, async (request, response, next) => {
  try {
    const body = parseRequest(analysisRecipeRequestSchema, request.body);
    logRecipeModeMigration('/v1/scans/analyze/:analysisId/recipe', getRequestMode(request.body), body.mode);
    const result = await runWithRequestDeadline(request, response, () => generateRecipeForAnalysis({
      analysisId: request.params.analysisId,
      mode: body.mode,
      dietaryAllergies: body.dietaryAllergies,
      dietaryRestrictions: body.dietaryRestrictions,
      dietaryDislikes: body.dietaryDislikes,
      recipeRequestId: body.recipeRequestId,
      goalContext: body.goalContext,
    }));
    sendOk(response.status(201), result);
  } catch (error) {
    if (error instanceof AiDailyCapExceededError) {
      sendError(response.status(429), 'ai_daily_cap_exceeded', "Okyo has reached its daily scan limit. Try again tomorrow.");
      return;
    }
    if (error instanceof OpenRouterProviderError && error.failure.reason === 'openrouter_disabled') {
      sendError(response.status(503), 'ai_temporarily_unavailable', 'Okyo’s AI service is not available yet.');
      return;
    }
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

app.get('/v1/scans/:scanId', productionMockFixtureDisabled, (request, response) => {
  const scan = getScan(request.params.scanId);

  if (!scan) {
    sendNotFound(response, 'scan_not_found', 'Scan was not found in mock data.');
    return;
  }

  sendOk(response, { scan });
});

app.get('/v1/recipes/:recipeId', productionMockFixtureDisabled, (request, response) => {
  const recipe = getRecipe(request.params.recipeId);

  if (!recipe) {
    sendNotFound(response, 'recipe_not_found', 'Recipe was not found in mock data.');
    return;
  }

  sendOk(response, { recipe });
});

app.post('/v1/recipes/:recipeId/save', productionMockFixtureDisabled, requireAuthenticatedUser, (request, response) => {
  const recipe = getRecipe(request.params.recipeId);

  if (!recipe) {
    sendNotFound(response, 'recipe_not_found', 'Recipe was not found in mock data.');
    return;
  }

  const library = saveRecipe(recipe, authenticatedUserId(response));
  sendOk(response, { saved: true, recipe, library });
});

app.get('/v1/account/capabilities', requireAuthenticatedUser, (_request, response) => {
  sendOk(response, getAccountCapabilities(response.locals.authenticatedUserId));
});

app.get('/v1/library', requireAuthenticatedUser, (_request, response) => {
  sendOk(response, { recipes: getLibrary(authenticatedUserId(response)) });
});

app.get('/v1/savings', requireAuthenticatedUser, (_request, response) => {
  sendOk(response, getSavingsSummary(authenticatedUserId(response)));
});

app.post('/v1/challenges', productionMockFixtureDisabled, requireAuthenticatedUser, (request, response) => {
  const body = parseRequest(challengeRequestSchema, request.body);
  const challenge = createChallenge(body, authenticatedUserId(response));

  if (!challenge) {
    sendNotFound(response, 'recipe_not_found', 'Challenge recipe was not found in mock data.');
    return;
  }

  sendOk(response.status(201), { challenge });
});

app.post('/v1/xp-events', requireAuthenticatedUser, (request, response) => {
  const body = parseRequest(xpEventRequestSchema, request.body);
  const userId = authenticatedUserId(response);
  const event = awardXp(userId, body.eventType, body.sourceId);

  sendOk(response.status(201), {
    event,
    definitions: getXpDefinitions(),
  });
});

app.get('/v1/rankings/weekly', productionMockFixtureDisabled, requireAuthenticatedUser, (_request, response) => {
  sendOk(response, getWeeklyRankings(authenticatedUserId(response)));
});

app.post('/v1/recipes/:recipeId/coaching', requireAiUser, productionAiDisabled, scanRateLimitMiddleware, async (request, response, next) => {
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

app.post('/v1/recipes/:recipeId/ask', requireAiUser, productionAiDisabled, scanRateLimitMiddleware, async (request, response, next) => {
  try {
    const body = parseRequest(askOkyoRequestSchema, request.body);
    const result = await runWithRequestDeadline(request, response, () => askOkyoWithOpenRouter({ ...body, config: getAiConfig() }));
    sendOk(response, result);
  } catch (error) {
    next(error);
  }
});

// Regenerates a recipe from a user correction (e.g. wrong dish identified)
// without requiring a new photo/scan. Reuses the existing OpenRouter recipe
// pipeline via createAiRecipeCorrection — see aiService.ts for details.
app.post('/v1/recipes/:recipeId/correct', requireAiUser, productionAiDisabled, scanRateLimitMiddleware, async (request, response, next) => {
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
    const result = await runWithRequestDeadline(request, response, () => createAiRecipeCorrection({
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
    }));

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

    if (error instanceof AiDailyCapExceededError) {
      sendError(response.status(429), 'ai_daily_cap_exceeded', "Okyo has reached its daily scan limit. Try again tomorrow.");
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
  if (!(error instanceof MockLoadTestError)) captureServerException(error);
  if (response.headersSent || response.destroyed) {
    return;
  }

  if (error instanceof ClientDisconnectedError) {
    // The peer is already gone. Do not convert a cancelled request into an
    // artificial 500 or a noisy provider retry.
    return;
  }

  if (error instanceof MockLoadTestError) {
    if (error.status === 503) response.setHeader('Retry-After', '1');
    sendError(response.status(error.status), error.code, 'Synthetic provider scenario.');
    return;
  }

  if (error instanceof RequestDeadlineExceededError) {
    sendError(response.status(504), 'request_timeout', 'Okyo took too long to finish this. Try again.');
    return;
  }

  if (error instanceof AiSaturatedError || error instanceof AiCircuitOpenError) {
    response.setHeader('Retry-After', String(error.retryAfterSeconds));
    sendError(response.status(503), 'ai_temporarily_unavailable', 'Okyo is temporarily busy. Try again shortly.');
    return;
  }

  if (error instanceof AiDailyCapExceededError) {
    sendError(response.status(429), 'ai_daily_cap_exceeded', "Okyo has reached its daily scan limit. Try again tomorrow.");
    return;
  }

  if (error instanceof SharedAiQuotaUnavailableError) {
    sendError(response.status(503), 'ai_temporarily_unavailable', 'Okyo’s AI service is not available yet.');
    return;
  }

  if (error instanceof FableDailyCapExceededError) {
    sendError(response.status(429), 'fable_daily_cap_exceeded', "Fable 5's daily limit has been reached. Try again tomorrow.");
    return;
  }

  if (error instanceof FableNotEnabledError) {
    sendError(response.status(403), 'fable_not_enabled', 'Fable 5 is not enabled.');
    return;
  }

  if (error instanceof ImagePayloadTooLargeError) {
    sendError(response.status(413), 'image_payload_too_large', 'This photo was too large to scan. Try a smaller image.');
    return;
  }

  if (error instanceof DurableRequestPendingError || error instanceof DurableRequestConflictError) {
    sendError(response.status(409), 'request_in_progress_or_reused', 'This request was already submitted. Wait a moment or start a new scan.');
    return;
  }
  if (error instanceof IdempotencyConflictError) {
    sendError(response.status(409), 'idempotency_key_reused', 'This scan request was already used for a different photo. Try scanning again.');
    return;
  }

  if (error instanceof OpenRouterProviderError) {
    const status = error.failure.reason === 'openrouter_disabled' || error.failure.httpStatus === 429 || (error.failure.httpStatus ?? 0) >= 500 ? 503 : 502;
    sendError(response.status(status), 'ai_temporarily_unavailable', 'Okyo could not reach the scanner. Try again shortly.');
    return;
  }

  if (error instanceof Error && /^(?:AI_UNAVAILABLE|IMAGE_NOT_AVAILABLE|RECIPE_GENERATION_FAILED):/.test(error.message)) {
    sendError(response.status(503), 'ai_temporarily_unavailable', 'Okyo could not reach the scanner. Try again shortly.');
    return;
  }

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

  logStructured('error', 'unhandled_api_error', {
    error_name: error instanceof Error ? error.name : 'unknown',
    route: request.route?.path ?? 'unmatched',
  });
  sendError(response.status(500), 'internal_error', 'Unexpected API error.');
});

export function startServer(listenPort = port): Server {
  const localLoadTest = process.env.OKYO_LOAD_TEST_MODE === 'true';
  if (localLoadTest && !isSafeLocalLoadTestEnvironment(process.env)) {
    throw new Error('Local load-test mode refused: environment is not isolated.');
  }
  const onListening = () => {
    logStructured('info', 'api_listening', { port: listenPort });
    validateEpicureConfigAtStartup();
    void productionReadiness().then(async (readiness) => {
      logStructured('info', 'production_readiness_snapshot', {
        production_ai_enabled: readiness.productionAiEnabled,
        persistent_state_configured: readiness.persistentStateConfigured,
        persistent_state_healthy: readiness.persistentStateHealthy,
        shared_ai_quota_configured: readiness.sharedAiQuotaConfigured,
        clerk_secret_valid: readiness.clerkAuth.clerkSecretValid,
        authorized_parties_valid: readiness.clerkAuth.authorizedPartiesValid,
        provider_credential_valid: readiness.providerCredentialValid,
      });
      if (process.env.NODE_ENV === 'production' && (!readiness.clerkAuth.clerkSecretValid || !readiness.clerkAuth.authorizedPartiesValid)) {
        logStructured('error', 'production_auth_configuration_invalid', {
          clerk_secret_valid: readiness.clerkAuth.clerkSecretValid,
          authorized_parties_configured: readiness.clerkAuth.authorizedPartiesConfigured,
          authorized_parties_valid: readiness.clerkAuth.authorizedPartiesValid,
        });
      }
      if (process.env.NODE_ENV === 'production' && !readiness.sharedAiQuotaConfigured) {
        logStructured('error', 'production_ai_quota_storage_unavailable', { production_ai_enabled: false });
      }
      if (readiness.persistentStateHealthy) {
        try { await cleanupPersistentRuntime(); } catch { /* cleanup is retried on the interval */ }
        if (!runtimeCleanupTimer) {
          runtimeCleanupTimer = setInterval(() => {
            void cleanupPersistentRuntime().catch(() => undefined);
          }, 6 * 60 * 60 * 1000);
          runtimeCleanupTimer.unref();
        }
      }
    }).catch(() => {
      logStructured('error', 'production_readiness_check_failed', { production_ai_enabled: false });
    });
  };
  const server = localLoadTest
    ? app.listen(listenPort, '127.0.0.1', onListening)
    : app.listen(listenPort, onListening);

  const shutdown = (signal: string) => gracefulShutdown(server, signal);
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return server;
}

async function gracefulShutdown(server: Server, signal: string): Promise<void> {
  setDraining(true);
  if (runtimeCleanupTimer) clearInterval(runtimeCleanupTimer);
  logStructured('info', 'shutdown_started', { signal });
  const forceTimer = setTimeout(() => {
    logStructured('warn', 'shutdown_grace_expired', { in_flight_requests: getInFlightRequestCount() });
    process.exit(1);
  }, getRuntimeSafetyConfig().shutdownGracePeriodMs);
  forceTimer.unref();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  clearTimeout(forceTimer);
  logStructured('info', 'shutdown_completed', { in_flight_requests: getInFlightRequestCount() });
  process.exit(0);
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

class ImagePayloadTooLargeError extends Error {
  constructor() { super('Image payload exceeds the configured limit.'); this.name = 'ImagePayloadTooLargeError'; }
}

class FableDailyCapExceededError extends Error {
  constructor() { super('Fable daily capacity has been exhausted.'); this.name = 'FableDailyCapExceededError'; }
}

class FableNotEnabledError extends Error {
  constructor() { super('Fable is not enabled.'); this.name = 'FableNotEnabledError'; }
}

async function runWithRequestDeadline<T>(
  request: Request,
  response: Response,
  operation: () => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const deadlineAt = Date.now() + getRuntimeSafetyConfig().requestDeadlineMs;
  const timer = setTimeout(() => controller.abort(new RequestDeadlineExceededError()), Math.max(1, deadlineAt - Date.now()));
  const onClientDisconnect = () => {
    if (!controller.signal.aborted) controller.abort(new ClientDisconnectedError());
  };
  request.once('aborted', onClientDisconnect);
  response.once('close', onClientDisconnect);
  try {
    return await runWithRequestControl({ abortSignal: controller.signal, deadlineAt }, () => {
      if (process.env.NODE_ENV !== 'production') return operation();
      const key = request.get('idempotency-key') ?? request.body?.recipeRequestId ?? request.body?.correctionRequestId;
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) {
        throw new DurableRequestConflictError();
      }
      return executeDurableRequest({ key: `${request.path}:${key}`, fingerprintSource: request.body, operation });
    });
  } finally {
    clearTimeout(timer);
    request.off('aborted', onClientDisconnect);
    response.off('close', onClientDisconnect);
  }
}

function parseRequest<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  return schema.parse(value);
}

function authenticatedUserId(response: Response): string {
  const userId = response.locals.authenticatedUserId;
  if (typeof userId !== 'string') throw new Error('Authenticated user context is missing.');
  return userId;
}

async function productionAiDisabled(_request: Request, response: Response, next: NextFunction): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !(await productionReadiness()).productionAiEnabled) {
    sendError(response.status(503), 'ai_temporarily_unavailable', 'Okyo’s AI service is not available yet.');
    return;
  }
  next();
}

function productionMockFixtureDisabled(_request: Request, response: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production') {
    sendError(response.status(404), 'not_found', 'Not found.');
    return;
  }
  next();
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
    const fieldPath = issue.path.filter((part): part is string | number => typeof part !== 'symbol');
    const invalidField = fieldPath.length > 0 ? fieldPath.join('.') : 'request';
    const receivedValue = getValueAtPath(requestBody, fieldPath);
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
  if (process.env.NODE_ENV === 'production' && typeof value === 'string') return `[redacted string length=${value.length}]`;
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
  if (process.env.NODE_ENV === 'production') return undefined;
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
