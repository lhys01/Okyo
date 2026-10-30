import { OKYO_API_BASE_URL, OKYO_API_TIMEOUT_MS, OKYO_DEV_MODEL_OVERRIDE } from './config';
import type {
  AnalyzeScanRequest,
  AnalyzeScanResult,
  AskOkyoRequest,
  AskOkyoResult,
  ApiResponse,
  CorrectRecipeRequest,
  CreateScanRequest,
  CreateScanResult,
  GenerateRecipeFromAnalysisRequest,
  GenerateRecipeFromAnalysisResult,
} from './types';
import { normalizeOutboundRecipeMode } from '../utils/recipeModes';
import { getAnonymousIdSync, uuidV4 } from '../analytics/identity';
import { scanTraceLog } from '../utils/uiDebug';

export const CORRECTION_FAILURE_MESSAGE = 'We couldn’t update the recipe. Try again.';
const REQUEST_FAILURE_MESSAGE = 'Okyo couldn’t complete that request. Try again.';
let optionalAuthTokenProvider: (() => Promise<string | null>) | null = null;

/** Register the current Clerk session used by authenticated production requests. */
export function setOptionalAuthTokenProvider(provider: (() => Promise<string | null>) | null): void {
  optionalAuthTokenProvider = provider;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export type ApiRequestOptions = {
  /** Stable for one user action; lets the API coalesce an ambiguous retry. */
  idempotencyKey?: string;
  /** Safe cross-layer correlation id for Development scan diagnostics. */
  requestId?: string;
  /** Cancels an in-flight scan request when the user leaves the processing screen. */
  signal?: AbortSignal;
};

export async function submitIdea(category: 'idea' | 'improvement' | 'bug', message: string): Promise<{ id: string }> {
  return postJson<{ id: string }>('/v1/ideas', { category, message });
}

export async function createMockScan(
  request: CreateScanRequest,
  options?: ApiRequestOptions,
): Promise<CreateScanResult> {
  return postJson<CreateScanResult>('/v1/scans', request, undefined, options?.signal, options);
}

export async function createTextRecipe(mealDescription: string, mode: CreateScanRequest['mode']): Promise<CreateScanResult> {
  return postJson<CreateScanResult>('/v1/scans', {
    mealDescription,
    mode,
    source: 'description',
  });
}

export async function analyzeScan(
  request: AnalyzeScanRequest,
  signal?: AbortSignal,
): Promise<AnalyzeScanResult> {
  return postJson<AnalyzeScanResult>('/v1/scans/analyze', request, undefined, signal);
}

export async function generateRecipeFromAnalysis(
  analysisId: string,
  request: GenerateRecipeFromAnalysisRequest,
  signal?: AbortSignal,
): Promise<GenerateRecipeFromAnalysisResult> {
  return postJson<GenerateRecipeFromAnalysisResult>(
    `/v1/scans/analyze/${encodeURIComponent(analysisId)}/recipe`,
    request,
    undefined,
    signal,
  );
}

// Regenerates a recipe from a user correction (wrong dish identified) without
// retaking the photo. Reuses the same scan-result shape as createMockScan so
// callers can treat the response identically.
export async function correctScanRecipe(recipeId: string, request: CorrectRecipeRequest, signal?: AbortSignal): Promise<CreateScanResult> {
  return postJson<CreateScanResult>(
    `/v1/recipes/${encodeURIComponent(recipeId)}/correct`,
    request,
    CORRECTION_FAILURE_MESSAGE,
    signal,
  );
}

export async function askOkyo(recipeId: string, request: AskOkyoRequest): Promise<AskOkyoResult> {
  return postJson<AskOkyoResult>(`/v1/recipes/${encodeURIComponent(recipeId)}/ask`, request);
}

/** Fetches account-scoped recipes with the active Clerk session token. */
export async function getAuthenticatedLibrary(token: string): Promise<{ recipes: unknown[] }> {
  if (!token) {
    throw new ApiClientError('Please sign in to access your saved recipes.', 'authentication_required', 401);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OKYO_API_TIMEOUT_MS);
  try {
    const response = await fetch(`${OKYO_API_BASE_URL}/v1/library`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-okyo-request-id': uuidV4(),
      },
      method: 'GET',
      signal: controller.signal,
    });
    const payload = parseApiResponse<{ recipes: unknown[] }>(await response.text());
    if (!response.ok || !payload?.ok) {
      const error = payload && !payload.ok ? payload.error : undefined;
      throw new ApiClientError(
        error?.message ?? 'Okyo couldn’t load your saved recipes. Try again.',
        error?.code ?? 'library_request_failed',
        response.status,
      );
    }
    return payload.data;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError('Okyo couldn’t load your saved recipes. Try again.', 'network_or_parse_failure', 0);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Starts permanent deletion for the account represented by this short-lived
 * Clerk session. The backend validates the token and derives the user ID; no
 * user identifier is ever accepted from the device for this destructive call.
 */
export async function checkAccountDeletionSession(token: string): Promise<void> {
  if (!token) throw new ApiClientError('Please sign in again.', 'authentication_required', 401);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OKYO_API_TIMEOUT_MS);
  try {
    const response = await fetch(`${OKYO_API_BASE_URL}/v1/account/session`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'x-okyo-request-id': uuidV4(),
      },
      method: 'GET',
      signal: controller.signal,
    });
    // The protected route authenticates before Express can emit a conditional
    // 304. Treat a legacy cache revalidation as a successful session check.
    if (response.status === 304) return;
    const payload = parseApiResponse<{ authenticated: boolean }>(await response.text());
    if (!response.ok || !payload?.ok || payload.data.authenticated !== true) {
      const error = payload && !payload.ok ? payload.error : undefined;
      throw new ApiClientError('Okyo couldn’t confirm your session yet.', error?.code ?? 'authentication_unavailable', response.status);
    }
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError('Okyo couldn’t confirm your session yet.', 'network_or_parse_failure', 0);
  } finally {
    clearTimeout(timeout);
  }
}

export async function deleteAuthenticatedAccount(token: string): Promise<{
  appleAuthorizationRevocation: 'not_applicable' | 'revoked' | 'manual_action_required' | 'unknown';
}> {
  if (!token) {
    throw new ApiClientError('Please sign in again before deleting your account.', 'authentication_required', 401);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OKYO_API_TIMEOUT_MS);
  try {
    const response = await fetch(`${OKYO_API_BASE_URL}/v1/account`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-okyo-request-id': uuidV4(),
      },
      method: 'DELETE',
      signal: controller.signal,
    });
    const payload = parseApiResponse<{
      deleted: boolean;
      appleAuthorizationRevocation: 'not_applicable' | 'revoked' | 'manual_action_required' | 'unknown';
    }>(await response.text());
    if (!response.ok || !payload?.ok || payload.data.deleted !== true) {
      const error = payload && !payload.ok ? payload.error : undefined;
      throw new ApiClientError(
        error?.message ?? 'We couldn’t delete your account yet. Please try again.',
        error?.code ?? 'account_deletion_failed',
        response.status,
        error?.details,
      );
    }
    const appleAuthorizationRevocation = payload.data.appleAuthorizationRevocation;
    return {
      appleAuthorizationRevocation:
        appleAuthorizationRevocation === 'not_applicable' || appleAuthorizationRevocation === 'revoked' ||
        appleAuthorizationRevocation === 'manual_action_required'
          ? appleAuthorizationRevocation
          : 'unknown',
    };
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError('We couldn’t delete your account yet. Please try again.', 'network_or_parse_failure', 0);
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson<T>(
  path: string,
  body: unknown,
  safeFailureMessage?: string,
  externalSignal?: AbortSignal,
  options?: ApiRequestOptions,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OKYO_API_TIMEOUT_MS);
  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
  const normalizedBody = normalizeRecipeApiRequestBody(path, body);
  const requestBody = JSON.stringify(normalizedBody);
  const requestId = isValidRequestId(options?.requestId) ? options.requestId : uuidV4();
  const startedAt = Date.now();
  logApiRequest(requestId, requestBody, normalizedBody);

  try {
    const correlationHeaders: Record<string, string> = { 'x-okyo-request-id': requestId, 'idempotency-key': uuidV4() };
    const anonId = getAnonymousIdSync();
    if (anonId) correlationHeaders['x-okyo-anon-id'] = anonId;
    if (isValidIdempotencyKey(options?.idempotencyKey)) {
      correlationHeaders['idempotency-key'] = options.idempotencyKey;
    }

    // Production AI endpoints verify the session before processing a dish.
    // Development can still exercise the local guest/demo flow.
    if (optionalAuthTokenProvider) {
      try {
        const token = await optionalAuthTokenProvider();
        if (token && /^[A-Za-z0-9._~-]+$/.test(token)) correlationHeaders.authorization = `Bearer ${token}`;
      } catch {
        // A transient auth SDK failure must not force guest users into sign-in.
      }
    }

    const response = await fetch(`${OKYO_API_BASE_URL}${path}`, {
      body: requestBody,
      headers: { ...getJsonHeaders(path), ...correlationHeaders },
      method: 'POST',
      signal: controller.signal,
    });

    const responseText = await response.text();
    const payload = parseApiResponse<T>(responseText);
    logApiResponse(response.status, payload, requestId, Date.now() - startedAt);

    if (!payload) {
      throw new Error(safeFailureMessage ?? REQUEST_FAILURE_MESSAGE);
    }

    if (!response.ok || !payload.ok) {
      if (!payload.ok) {
        throw new ApiClientError(
          safeFailureMessage ?? payload.error.message,
          payload.error.code,
          response.status,
          payload.error.details,
        );
      }
      throw new Error(safeFailureMessage ?? REQUEST_FAILURE_MESSAGE);
    }

    return payload.data;
  } catch (error) {
    if (path === '/v1/scans') {
      scanTraceLog('request_failed', {
        requestId,
        elapsedMs: Date.now() - startedAt,
        failureCode: getSafeScanFailureCode(error),
      });
    }
    if (safeFailureMessage) {
      if (error instanceof ApiClientError) {
        throw new ApiClientError(safeFailureMessage, error.code, error.status, error.details);
      }
      throw new ApiClientError(safeFailureMessage, 'network_or_parse_failure', 0);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(REQUEST_FAILURE_MESSAGE);
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

function isValidIdempotencyKey(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{8,128}$/.test(value));
}

export function normalizeRecipeApiRequestBody(path: string, body: unknown): unknown {
  const isScanRequest = path === '/v1/scans' || path === '/v1/scans/analyze';
  const isRecipeRequest = isScanRequest ||
    /^\/v1\/scans\/analyze\/[^/]+\/recipe$/.test(path) ||
    /^\/v1\/recipes\/[^/]+\/correct$/.test(path);
  if (
    !isRecipeRequest ||
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return body;
  }

  const request = body as Record<string, unknown>;
  const normalized: Record<string, unknown> = {
    ...request,
    mode: normalizeOutboundRecipeMode(request.mode),
  };
  // Local file paths and original filenames are useful only for the device
  // preview. The API needs the sanitized JPEG payload and basic dimensions;
  // dropping the rest prevents local paths and photo names leaving the device.
  if (isScanRequest && 'image' in request) {
    normalized.image = sanitizeOutboundScanImage(request.image);
  }
  return normalized;
}

function sanitizeOutboundScanImage(image: unknown): unknown {
  if (!image || typeof image !== 'object' || Array.isArray(image)) return image;
  const source = image as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of ['dataUrl', 'dataUrlSizeBytes', 'height', 'mimeType', 'placeholder', 'source', 'width', 'conversionError']) {
    if (source[key] !== undefined) safe[key] = source[key];
  }
  return safe;
}

export function parseApiResponse<T>(responseText: string): ApiResponse<T> | null {
  try {
    const value = JSON.parse(responseText) as unknown;
    if (!value || typeof value !== 'object' || !('ok' in value)) {
      return null;
    }

    const response = value as Partial<ApiResponse<T>>;
    if (response.ok === true && 'data' in response) {
      return response as ApiResponse<T>;
    }
    if (
      response.ok === false &&
      'error' in response &&
      response.error &&
      typeof response.error === 'object' &&
      'message' in response.error &&
      typeof response.error.message === 'string'
    ) {
      return response as ApiResponse<T>;
    }
    return null;
  } catch {
    return null;
  }
}

function getJsonHeaders(path: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if ((path === '/v1/scans' || path === '/v1/scans/analyze') && OKYO_DEV_MODEL_OVERRIDE === 'fable') {
    headers['x-okyo-model'] = 'fable';
  }

  return headers;
}

function logApiRequest(requestId: string, requestBody: string, body: unknown) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_scan_request_body_keys', {
    bodyKeys: body && typeof body === 'object' ? Object.keys(body).sort() : [],
    hasImageDataUrl: hasScanImageDataUrl(body),
    imageKeys: getScanImageKeys(body),
    requestBodyLength: requestBody.length,
  });
  console.log('okyo_api_request', {
    requestId,
    bodyLength: requestBody.length,
    hasImage: hasScanImageDataUrl(body),
  });
  if (body && typeof body === 'object' && 'source' in body) {
    scanTraceLog('request_sent', { requestId, source: (body as { source?: unknown }).source, stage: 'upload' });
  }
}

function logApiResponse(status: number, payload: unknown, requestId: string, elapsedMs: number) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const summary = getResponseSummary(payload);
  console.log('okyo_scan_api_response_status', { httpStatus: status, status: summary.status, ok: summary.ok });
  console.log('okyo_scan_api_response_scan_state', { scanState: summary.scanState });
  console.log('okyo_scan_api_response_food_detected', { foodDetected: summary.foodDetected });
  console.log('okyo_scan_api_response_recipes_length', { recipesLength: summary.recipesLength });
  scanTraceLog('response_received', {
    requestId,
    httpStatus: status,
    elapsedMs,
    status: summary.status,
    hasScan: summary.hasScan,
    hasRecipe: summary.hasRecipe,
    recipesLength: summary.recipesLength,
  });
}

function getScanImageKeys(body: unknown) {
  if (!body || typeof body !== 'object' || !('image' in body)) {
    return [];
  }

  const request = body as { image?: unknown };
  return request.image && typeof request.image === 'object'
    ? Object.keys(request.image).sort()
    : [];
}

function hasScanImageDataUrl(body: unknown) {
  return getScanImageDataUrlLength(body) > 0;
}

function getScanImageDataUrlLength(body: unknown) {
  if (!body || typeof body !== 'object' || !('image' in body)) {
    return 0;
  }

  const request = body as { image?: { dataUrl?: unknown } };
  return typeof request.image?.dataUrl === 'string' ? request.image.dataUrl.length : 0;
}

function getResponseSummary(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      status: undefined,
      scanState: undefined,
      foodDetected: false,
      hasScan: false,
      hasRecipe: false,
      recipesLength: 0,
    };
  }

  const response = payload as {
    data?: CreateScanResult;
    ok?: boolean;
  };
  const data = response.data;

  return {
    ok: response.ok,
    status: data?.status,
    scanState: data?.scan?.scanState ?? data?.scanState,
    foodDetected: isFoodScanState(data?.scan?.scanState ?? data?.scanState),
    hasScan: Boolean(data?.scan),
    hasRecipe: Boolean(data?.recipe),
    recipesLength: (data?.recipes?.length ?? 0) + (data?.recipe ? 1 : 0),
  };
}

function isValidRequestId(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{8,128}$/.test(value));
}

function getSafeScanFailureCode(error: unknown) {
  if (error instanceof ApiClientError && /^[a-z0-9_-]{1,64}$/i.test(error.code)) return error.code;
  if (error instanceof Error && /abort|timeout/i.test(error.name)) return 'request_aborted';
  if (error instanceof Error && /network|fetch/i.test(error.message)) return 'network_failure';
  return 'client_request_failure';
}

function isFoodScanState(scanState: string | null | undefined) {
  return scanState === 'clear_food' ||
    scanState === 'food_present_uncertain_dish' ||
    scanState === 'partial_food';
}

/** Only a capability flag crosses the API; private admin membership stays server-side. */
export async function getAccountCapabilities(token: string): Promise<{ canManageOnboardingExperiments: boolean }> {
  if (!token || !/^[A-Za-z0-9._~-]+$/.test(token)) throw new ApiClientError('Please sign in again.', 'authentication_required', 401);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OKYO_API_TIMEOUT_MS);
  try {
    const response = await fetch(`${OKYO_API_BASE_URL}/v1/account/capabilities`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    });
    const payload = parseApiResponse<{ canManageOnboardingExperiments?: unknown }>(await response.text());
    if (!response.ok || !payload?.ok) throw new Error('Account capabilities unavailable');
    return { canManageOnboardingExperiments: payload.data?.canManageOnboardingExperiments === true };
  } finally { clearTimeout(timeout); }
}
