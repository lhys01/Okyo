import { OKYO_API_BASE_URL, OKYO_API_TIMEOUT_MS, OKYO_DEV_MODEL_OVERRIDE } from './config';
import type { ApiResponse, CreateScanRequest, CreateScanResult } from './types';

export async function createMockScan(request: CreateScanRequest): Promise<CreateScanResult> {
  return postJson<CreateScanResult>('/v1/scans', request);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OKYO_API_TIMEOUT_MS);
  const requestBody = JSON.stringify(body);
  logApiRequest(path, requestBody, body);

  try {
    const response = await fetch(`${OKYO_API_BASE_URL}${path}`, {
      body: requestBody,
      headers: getJsonHeaders(path),
      method: 'POST',
      signal: controller.signal,
    });

    const payload = await response.json() as ApiResponse<T>;
    logApiResponse(path, response.status, payload);

    if (!response.ok || !payload.ok) {
      const message = payload.ok ? `Request failed with ${response.status}` : payload.error.message;
      throw new Error(message);
    }

    return payload.data;
  } finally {
    clearTimeout(timeout);
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
