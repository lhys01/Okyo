import { OKYO_API_BASE_URL, OKYO_API_TIMEOUT_MS } from './config';
import type { ApiResponse, CreateScanRequest, CreateScanResult } from './types';

export async function createMockScan(request: CreateScanRequest): Promise<CreateScanResult> {
  return postJson<CreateScanResult>('/v1/scans', request);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OKYO_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${OKYO_API_BASE_URL}${path}`, {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    });

    const payload = await response.json() as ApiResponse<T>;

    if (!response.ok || !payload.ok) {
      const message = payload.ok ? `Request failed with ${response.status}` : payload.error.message;
      throw new Error(message);
    }

    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}
