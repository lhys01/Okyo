import { OKYO_API_BASE_URL, OKYO_API_TIMEOUT_MS, OKYO_DEV_MODEL_OVERRIDE } from './config';
import { authenticatedFetch } from './authenticatedClient';
import type {
  ApiResponse,
  CreateFoodIdeaRecipeRequest,
  CreateFoodIdeaRecipeResult,
  CreateScanRequest,
  CreateScanResult,
} from './types';
import { logMobileScanMetric } from '../utils/scanTelemetry';

// Thrown for any non-2xx or `{ ok: false }` API response. `code` is the
// server's stable error code (e.g. "fable_not_enabled", "rate_limit_exceeded")
// — callers should branch on this, not on `message` text, since copy can
// change without warning.
export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(args: { code: string; message: string; httpStatus: number; details?: unknown }) {
    super(args.message);
    this.name = 'ApiError';
    this.code = args.code;
    this.httpStatus = args.httpStatus;
    this.details = args.details;
  }
}

export class ScanRequestTimeoutError extends Error {
  readonly requestId: string;

  constructor(requestId: string) {
    super('The scan request timed out.');
    this.name = 'ScanRequestTimeoutError';
    this.requestId = requestId;
  }
}

export class ScanConnectionError extends Error {
  readonly requestId: string;

  constructor(requestId: string, cause?: unknown) {
    super('The scan service could not be reached.', { cause });
    this.name = 'ScanConnectionError';
    this.requestId = requestId;
  }
}

export async function createScan(request: CreateScanRequest): Promise<CreateScanResult> {
  return postJson<CreateScanResult>('/v1/scans', request);
}

export async function createFoodIdeaRecipe(request: CreateFoodIdeaRecipeRequest): Promise<CreateFoodIdeaRecipeResult> {
  return postJson<CreateFoodIdeaRecipeResult>('/v1/ideas/recipe', request);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const requestId = getRequestId(body);
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, OKYO_API_TIMEOUT_MS);
  const requestBody = JSON.stringify(body);
  logApiRequest(path, requestBody, body);
  const uploadStartedAt = Date.now();

  try {
    const response = await authenticatedFetch(`${OKYO_API_BASE_URL}${path}`, {
      body: requestBody,
      headers: getJsonHeaders(path, requestId),
      method: 'POST',
      signal: controller.signal,
    });
    logMobileScanMetric(requestId, 'upload', Date.now() - uploadStartedAt, {
      httpStatus: response.status,
      requestBytes: requestBody.length,
    });

    const payload = await response.json() as ApiResponse<T>;
    logApiResponse(path, response.status, payload);

    if (!response.ok || !payload.ok) {
      if (payload.ok) {
        throw new ApiError({ code: 'http_error', message: `Request failed with ${response.status}`, httpStatus: response.status });
      }
      throw new ApiError({
        code: payload.error.code,
        message: payload.error.message,
        httpStatus: response.status,
        details: payload.error.details,
      });
    }

    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
      logMobileScanMetric(requestId, 'mobile_request_failure', Date.now() - uploadStartedAt, {
        reason: 'timeout',
      });
      throw new ScanRequestTimeoutError(requestId);
    }
    if (error instanceof TypeError || (error instanceof Error && /network|fetch/i.test(error.message))) {
      logMobileScanMetric(requestId, 'mobile_request_failure', Date.now() - uploadStartedAt, {
        reason: 'connection',
      });
      throw new ScanConnectionError(requestId, error);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getJsonHeaders(path: string, requestId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-okyo-request-id': requestId,
  };

  if (path === '/v1/scans' && OKYO_DEV_MODEL_OVERRIDE === 'fable') {
    headers['x-okyo-model'] = 'fable';
  }

  return headers;
}

function getRequestId(body: unknown): string {
  if (
    body &&
    typeof body === 'object' &&
    'requestId' in body &&
    typeof body.requestId === 'string' &&
    body.requestId.trim()
  ) {
    return body.requestId.trim();
  }
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
