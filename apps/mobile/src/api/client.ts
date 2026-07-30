import { OKYO_API_BASE_URL, OKYO_API_TIMEOUT_MS, OKYO_DEV_MODEL_OVERRIDE } from './config';
import type { ApiResponse, CorrectRecipeRequest, CreateScanRequest, CreateScanResult } from './types';
import { normalizeOutboundRecipeMode } from '../utils/recipeModes';

export const CORRECTION_FAILURE_MESSAGE = 'We couldn’t update the recipe. Try again.';
const REQUEST_FAILURE_MESSAGE = 'Okyo couldn’t complete that request. Try again.';

export async function createMockScan(request: CreateScanRequest): Promise<CreateScanResult> {
  return postJson<CreateScanResult>('/v1/scans', request);
}

export async function createTextRecipe(mealDescription: string, mode: CreateScanRequest['mode']): Promise<CreateScanResult> {
  return postJson<CreateScanResult>('/v1/scans', {
    mealDescription,
    mode,
    source: 'description',
  });
}

// Regenerates a recipe from a user correction (wrong dish identified) without
// retaking the photo. Reuses the same scan-result shape as createMockScan so
// callers can treat the response identically.
export async function correctScanRecipe(recipeId: string, request: CorrectRecipeRequest): Promise<CreateScanResult> {
  return postJson<CreateScanResult>(
    `/v1/recipes/${encodeURIComponent(recipeId)}/correct`,
    request,
    CORRECTION_FAILURE_MESSAGE,
  );
}

async function postJson<T>(path: string, body: unknown, safeFailureMessage?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OKYO_API_TIMEOUT_MS);
  const normalizedBody = normalizeRecipeApiRequestBody(path, body);
  const requestBody = JSON.stringify(normalizedBody);
  logApiRequest(path, requestBody, normalizedBody);

  try {
    const response = await fetch(`${OKYO_API_BASE_URL}${path}`, {
      body: requestBody,
      headers: getJsonHeaders(path),
      method: 'POST',
      signal: controller.signal,
    });

    const responseText = await response.text();
    const payload = parseApiResponse<T>(responseText);
    logApiResponse(path, response.status, payload);

    if (!payload) {
      throw new Error(safeFailureMessage ?? REQUEST_FAILURE_MESSAGE);
    }

    if (!response.ok || !payload.ok) {
      const message = safeFailureMessage ??
        (payload.ok ? REQUEST_FAILURE_MESSAGE : payload.error.message);
      throw new Error(message);
    }

    return payload.data;
  } catch (error) {
    if (safeFailureMessage) {
      throw new Error(safeFailureMessage);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(REQUEST_FAILURE_MESSAGE);
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeRecipeApiRequestBody(path: string, body: unknown): unknown {
  const isRecipeRequest = path === '/v1/scans' ||
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
  return {
    ...request,
    mode: normalizeOutboundRecipeMode(request.mode),
  };
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

  if (path === '/v1/scans' && OKYO_DEV_MODEL_OVERRIDE === 'fable') {
    headers['x-okyo-model'] = 'fable';
  }

  return headers;
}

function logApiRequest(path: string, requestBody: string, body: unknown) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.log('okyo_scan_request_body_keys', {
    bodyKeys: body && typeof body === 'object' ? Object.keys(body).sort() : [],
    endpoint: `${OKYO_API_BASE_URL}${path}`,
    hasImageDataUrl: hasScanImageDataUrl(body),
    imageKeys: getScanImageKeys(body),
    imageDataUrlLength: getScanImageDataUrlLength(body),
    requestBodyLength: requestBody.length,
  });
  console.log('okyo_api_request', {
    path,
    bodyLength: requestBody.length,
    ...getScanRequestSummary(body),
  });
}

function logApiResponse(path: string, status: number, payload: unknown) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const summary = getResponseSummary(payload);
  console.log('okyo_scan_api_response_status', { httpStatus: status, status: summary.status, ok: summary.ok });
  console.log('okyo_scan_api_response_scan_state', { scanState: summary.scanState });
  console.log('okyo_scan_api_response_food_detected', { foodDetected: summary.foodDetected });
  console.log('okyo_scan_api_response_dish_name', { dishName: summary.dishName });
  console.log('okyo_scan_api_response_recipes_length', { recipesLength: summary.recipesLength });
  console.log('okyo_api_response', {
    path,
    status,
    payload: summary,
  });
}

function getScanRequestSummary(body: unknown) {
  if (!body || typeof body !== 'object' || !('image' in body)) {
    return {};
  }

  const request = body as {
    image?: {
      conversionError?: string;
      dataUrl?: string;
      dataUrlSizeBytes?: number;
      height?: number;
      mimeType?: string;
      source?: string;
      uri?: string;
      width?: number;
    };
    mode?: string;
    source?: string;
  };
  const image = request.image;

  return {
    endpointSource: request.source,
    mode: request.mode,
    imageExists: Boolean(image),
    imageFields: image ? Object.keys(image).sort() : [],
    imageUri: image?.uri,
    imageDataUrlExists: Boolean(image?.dataUrl),
    imageDataUrlLength: image?.dataUrl?.length ?? 0,
    imageDataUrlSizeBytes: image?.dataUrlSizeBytes,
    imageMimeType: image?.mimeType,
    imageConversionError: image?.conversionError,
    imageWidth: image?.width,
    imageHeight: image?.height,
  };
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
      error: { message: 'Response payload was not an object.' },
      status: undefined,
      scanState: undefined,
      dishName: undefined,
      foodDetected: false,
      recipesLength: 0,
      hasRecipe: false,
      rejectionType: undefined,
      rejectionReason: undefined,
      fallbackReason: undefined,
      image: undefined,
    };
  }

  const response = payload as {
    data?: CreateScanResult;
    error?: { code?: string; message?: string };
    ok?: boolean;
  };
  const data = response.data;

  return {
    ok: response.ok,
    error: response.error,
    status: data?.status,
    scanState: data?.scan?.scanState ?? data?.scanState,
    dishName: data?.scan?.dishName,
    foodDetected: isFoodScanState(data?.scan?.scanState ?? data?.scanState),
    recipesLength: data?.recipes?.length ?? 0,
    hasRecipe: Boolean(data?.recipe),
    rejectionType: data?.rejectionType,
    rejectionReason: data?.rejectionReason,
    fallbackReason: data?.fallbackReason,
    image: data?.image ? {
      conversionError: data.image.conversionError,
      dataUrlSizeBytes: data.image.dataUrlSizeBytes,
      hasDataUrl: Boolean(data.image.dataUrl),
      hasDataUrlFromApi: 'hasDataUrl' in data.image ? Boolean((data.image as { hasDataUrl?: boolean }).hasDataUrl) : undefined,
      mimeType: data.image.mimeType,
    } : undefined,
  };
}

function isFoodScanState(scanState: string | null | undefined) {
  return scanState === 'clear_food' ||
    scanState === 'food_present_uncertain_dish' ||
    scanState === 'partial_food';
}
