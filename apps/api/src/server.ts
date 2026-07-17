import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { getAiConfig, getPublicAiConfig } from './config/aiConfig.js';
import { validateSupabaseAuthConfigAtStartup } from './auth/config.js';
import { getScanRecipeDatabaseGateway } from './database/client.js';
import {
  SupabaseDatabaseConfigurationError,
  validateSupabaseDatabaseConfigAtStartup,
} from './database/config.js';
import { getCostControlConfig } from './config/costControlConfig.js';
import { isAiDebugRouteAvailable } from './config/debugRoute.js';
import { validateEpicureConfigAtStartup } from './config/openRouter.js';
import {
  checkAndIncrementFableCap,
  logCostEvent,
  scanRateLimitMiddleware,
} from './middleware/costControls.js';
import {
  createProviderQuota,
  getQuotaApiError,
} from './quota/providerQuota.js';
import { requestContextMiddleware } from './middleware/requestContext.js';
import { mountV1Authentication } from './middleware/supabaseAuth.js';
import { createAiScan, enrichRecipeCoaching, FoodRejectionError } from './services/aiService.js';
import {
  getScanDeadlineMs,
  ScanCancelledError,
  ScanDeadlineExceededError,
} from './services/scanDeadline.js';
import {
  createScanAggregateTiming,
  logScanAggregateTiming,
  logScanMetric,
  type ScanMetricStatus,
} from './telemetry/scanTelemetry.js';
import { validatePaidFallbackAtStartup } from './services/openRouterProvider.js';
import { getRecipeFailureApiError } from './services/recipeGenerationError.js';
import { buildRecipeAdaptationPlan } from './services/recipeAdaptationService.js';
import { buildRecipeQualityReport } from './services/recipeCheckService.js';
import { getAuthenticatedUserId } from './routes/ownedRecipe.js';
import { recipeCheckRecipeSchema } from './routes/recipeInput.js';
import { runPersistedScan } from './persistence/persistedScanService.js';
import {
  createScanRecipeRepository,
  InvalidPersistedRecipeError,
  PersistenceUnavailableError,
  type ScanRecipeRepository,
} from './persistence/scanRecipeRepository.js';
import type { ApiFailure, ApiResponse } from './types.js';
import type { Recipe } from './types.js';
import type { RecipeAdaptationResponse } from './types/recipeAdaptation.js';
import type { RecipeCheckResponse } from './types/recipeQuality.js';

const port = Number(process.env.PORT ?? 8081);
const app = express();
const maxImageDataUrlChars = 12_000_000;
const jsonBodyLimit = '16mb';
let scanRecipeRepository: ScanRecipeRepository | null = null;

const recipeModeSchema = z.enum(['Restaurant Copy', 'Budget', 'Healthy']);
const scanSourceSchema = z.enum(['camera', 'photos']);
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
  requestId: z.string().min(8).max(128).optional(),
  source: scanSourceSchema.optional().default('camera'),
  mode: recipeModeSchema.optional().default('Restaurant Copy'),
  image: scanImageMetadataSchema.optional(),
});
const recipeCheckSourceSchema = z.enum(['scan', 'foodIdea', 'savedRecipe', 'manual']);
const recipeCheckRequestSchema = z.object({
  recipe: recipeCheckRecipeSchema,
  context: z.object({
    source: recipeCheckSourceSchema.optional(),
    userGoal: z.string().min(1).max(240).optional(),
    timePreference: z.string().min(1).max(120).optional(),
    skillLevel: z.string().min(1).max(80).optional(),
  }).strict().optional(),
}).strict();
const recipeAdaptationGoalSchema = z.enum([
  'faster',
  'cheaper',
  'healthier',
  'lighter',
  'beginner',
  'higherProtein',
  'pantryFriendly',
  'leftovers',
  'lessSpicy',
  'moreSpicy',
  'moreFlavor',
]);
const recipeAdaptationSourceSchema = z.enum(['scan', 'foodIdea', 'savedRecipe', 'manual']);
const recipeAdaptationContextListSchema = z.array(z.string().min(1).max(120)).max(30);
const recipeAdaptationRequestSchema = z.object({
  recipe: recipeCheckRecipeSchema,
  goals: z.array(recipeAdaptationGoalSchema).min(1).max(4),
  context: z.object({
    source: recipeAdaptationSourceSchema.optional(),
    skillLevel: z.string().min(1).max(80).optional(),
    timePreference: z.string().min(1).max(120).optional(),
    budgetPreference: z.string().min(1).max(120).optional(),
    availableIngredients: recipeAdaptationContextListSchema.optional(),
    dislikes: recipeAdaptationContextListSchema.optional(),
    equipment: recipeAdaptationContextListSchema.optional(),
  }).strict().optional(),
}).strict();

app.use(requestContextMiddleware());
app.use(cors());
app.use(express.json({ limit: jsonBodyLimit }));
app.use((request, _response, next) => {
  if (request.path === '/v1/scans' && request.scanContext) {
    logScanMetric({
      requestId: request.scanContext.requestId,
      stage: 'api_ingress',
      durationMs: Date.now() - request.scanContext.ingressStartedAt,
    });
  }
  next();
});

// Minimal manual security headers — no dependency needed for this small a surface.
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.get('/health', (_request, response) => {
  const aiConfig = getPublicAiConfig();

  sendOk(response, {
    status: 'ok',
    service: 'okyo-api',
    aiEnabled: aiConfig.aiEnabled,
    databaseEnabled: true,
    timestamp: new Date().toISOString(),
  });
});

app.get('/debug/ai-config', (_request, response) => {
  if (!isAiDebugRouteAvailable(process.env.NODE_ENV)) {
    sendError(response.status(404), 'not_found', 'Not found.');
    return;
  }
  sendOk(response, getPublicAiConfig());
});

// All current /v1 routes are user-specific or spend provider capacity. Keep
// the public health/debug endpoints above this single authentication boundary.
mountV1Authentication(app);

app.post('/v1/scans', scanRateLimitMiddleware, async (request, response, next) => {
  const requestId = request.scanContext?.requestId ?? 'missing-request-id';
  const timing = createScanAggregateTiming({
    requestId,
    startedAt: request.scanContext?.ingressStartedAt,
    recipeContract: getAiConfig().compactRecipeEnabled ? 'compact-v1' : 'full-core-v2',
  });
  let aggregateStatus: ScanMetricStatus = 'failure';
  const controller = new AbortController();
  const deadlineAt = (request.scanContext?.ingressStartedAt ?? Date.now()) + getScanDeadlineMs();
  const deadlineTimer = setTimeout(
    () => controller.abort(new ScanDeadlineExceededError()),
    Math.max(0, deadlineAt - Date.now()),
  );
  const cancelForClientDisconnect = () => {
    if (!response.writableEnded && !controller.signal.aborted) {
      controller.abort(new ScanCancelledError());
    }
  };
  request.once('aborted', cancelForClientDisconnect);
  response.once('close', cancelForClientDisconnect);

  try {
    const body = parseRequest(scanRequestSchema, normalizeScanRequestInput(request.body));
    const userId = getAuthenticatedUserId(request);

    // Configurable image size guard (secondary check; Zod schema is the primary).
    const imageSizeBytes = body.image?.dataUrlSizeBytes ?? body.image?.dataUrl?.length ?? 0;
    const maxScanImageBytes = getCostControlConfig().maxScanImageBytes;
    if (imageSizeBytes > maxScanImageBytes) {
      logCostEvent('scan_image_too_large', { requestId, imageSizeBytes, maxScanImageBytes });
      sendError(response.status(413), 'image_payload_too_large', 'This photo was too large to scan. Try a smaller image.');
      return;
    }

    // Fable 5 opt-in — private header only, never a user-facing toggle.
    // Missing/mismatched header always falls through to the default
    // OpenRouter path unchanged.
    const fableRequested = request.get('x-okyo-model') === 'fable';
    const fableEnabled = getAiConfig().fableEnabled;

    if (fableRequested && !fableEnabled) {
      console.log('[fable_route]', { requestId, requested: true, enabled: false, active: false, model: 'default', failClosed: true });
      sendError(response.status(403), 'fable_not_enabled', 'Fable 5 is not enabled.');
      return;
    }

    let fableActive = false;
    if (fableRequested && fableEnabled) {
      if (!checkAndIncrementFableCap(requestId)) {
        console.log('[fable_route]', { requestId, requested: true, enabled: true, active: false, model: 'default', failClosed: true });
        sendError(response.status(429), 'fable_daily_cap_exceeded', "Fable 5's daily limit has been reached. Try again tomorrow.");
        return;
      }
      fableActive = true;
    }
    console.log('[fable_route]', {
      requestId,
      requested: fableRequested,
      enabled: fableEnabled,
      active: fableActive,
      model: fableActive ? getAiConfig({ fableActive: true }).fableModel : 'default',
      failClosed: false,
    });

    logScanRequest(body, request.get('content-type'));
    const result = await runPersistedScan({
      userId,
      repository: getScanRecipeRepository(),
      requestId,
      signal: controller.signal,
      deadlineAt,
      timing,
      generate: () => createAiScan({
        image: body.image,
        mode: body.mode,
        source: body.source,
        fableActive,
        cacheScope: userId,
        quota: createProviderQuota({ userId, requestId }),
        requestId,
        signal: controller.signal,
        deadlineAt,
        timing,
      }),
    });

    sendOk(response.status(201), {
      ...result,
      image: getResponseImageMetadata(body.image),
      source: body.source,
    });
    aggregateStatus = 'success';
  } catch (error) {
    aggregateStatus = error instanceof ScanCancelledError ? 'cancelled' : 'failure';
    next(error);
  } finally {
    logScanAggregateTiming(timing, aggregateStatus);
    clearTimeout(deadlineTimer);
    request.off('aborted', cancelForClientDisconnect);
    response.off('close', cancelForClientDisconnect);
  }
});

app.post('/v1/recipes/check', (request, response) => {
  const body = parseRequest(recipeCheckRequestSchema, request.body);
  const report = buildRecipeQualityReport(coerceRecipeForCheck(body.recipe), body.context);
  const payload: RecipeCheckResponse = { ok: true, report };

  response.json(payload);
});

app.post('/v1/recipes/adapt', (request, response) => {
  const body = parseRequest(recipeAdaptationRequestSchema, request.body);
  const adaptation = buildRecipeAdaptationPlan(coerceRecipeForCheck(body.recipe), body.goals, body.context);
  const payload: RecipeAdaptationResponse = { ok: true, adaptation };

  response.json(payload);
});

app.post('/v1/recipes/:recipeId/coaching', scanRateLimitMiddleware, async (request, response, next) => {
  try {
    const userId = getAuthenticatedUserId(request);
    const recipe = await getScanRecipeRepository().findOwnedRecipe(
      userId,
      request.params.recipeId,
    );
    if (!recipe) {
      sendNotFound(response, 'recipe_not_found', 'Recipe not found or expired. Please scan again.');
      return;
    }
    const result = await enrichRecipeCoaching(
      recipe,
      createProviderQuota({ userId, requestId: request.scanContext!.requestId }),
      { requestId: request.scanContext!.requestId },
    );
    if (!result) {
      sendNotFound(response, 'recipe_not_found', 'Recipe not found or expired. Please scan again.');
      return;
    }
    sendOk(response, result);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof ScanDeadlineExceededError) {
    sendError(
      response.status(504),
      'scan_timeout',
      'This scan took too long. Please try again with a clear, well-lit food photo.',
    );
    return;
  }

  if (error instanceof ScanCancelledError) {
    if (!response.headersSent) {
      sendError(response.status(499), 'scan_cancelled', 'The scan request was cancelled.');
    }
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
    sendError(response.status(400), 'validation_error', 'Request validation failed.', error.flatten());
    return;
  }

  if (
    error instanceof PersistenceUnavailableError ||
    error instanceof InvalidPersistedRecipeError ||
    error instanceof SupabaseDatabaseConfigurationError
  ) {
    sendError(
      response.status(503),
      'persistence_unavailable',
      'Recipe storage is temporarily unavailable. Please try again.',
    );
    return;
  }

  const quotaError = getQuotaApiError(error);
  if (quotaError) {
    sendError(response.status(quotaError.status), quotaError.code, quotaError.message);
    return;
  }

  const recipeError = getRecipeFailureApiError(error);
  if (recipeError) {
    sendError(response.status(recipeError.status), recipeError.code, recipeError.message);
    return;
  }

  sendError(response.status(500), 'internal_error', 'Unexpected API error.');
});

validateSupabaseAuthConfigAtStartup();
validateSupabaseDatabaseConfigAtStartup();

app.listen(port, () => {
  console.log(`Okyo API listening on http://localhost:${port}`);
  // Best-effort startup warning if the Epicure enrichment layer is misconfigured.
  // Never fatal — the API boots regardless and enrichment simply stays off.
  validateEpicureConfigAtStartup();
  // Loud, non-fatal warning if a paid recipe fallback model is configured.
  validatePaidFallbackAtStartup();
});

function parseRequest<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  return schema.parse(value);
}

function getScanRecipeRepository() {
  scanRecipeRepository ??= createScanRecipeRepository(getScanRecipeDatabaseGateway());
  return scanRecipeRepository;
}


function coerceRecipeForCheck(value: z.infer<typeof recipeCheckRecipeSchema>): Recipe {
  return value as unknown as Recipe;
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
  console.log('api_scan_image_data_url_prefix', { prefix: body.image?.dataUrl?.slice(0, 30) ?? null });
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
