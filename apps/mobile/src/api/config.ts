import type { OkyoModelOverride } from './types';

const configuredApiUrl = process.env.EXPO_PUBLIC_OKYO_API_URL?.trim();
const developmentApiFallback = 'http://localhost:8081';

if (__DEV__ && !configuredApiUrl) {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_API_URL not set — using dev fallback. Set this before production builds.');
}

if (!__DEV__ && (!configuredApiUrl || !isValidProductionApiUrl(configuredApiUrl))) {
  throw new Error('[Okyo] Production requires EXPO_PUBLIC_OKYO_API_URL to be a valid HTTPS URL.');
}

const requestedDevModel = process.env.EXPO_PUBLIC_OKYO_DEV_AI_MODEL;

if (__DEV__ && requestedDevModel && requestedDevModel !== 'fable') {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_DEV_AI_MODEL only supports "fable"; ignoring value.');
}

export const OKYO_API_BASE_URL = configuredApiUrl ?? developmentApiFallback;
export const OKYO_API_TIMEOUT_MS = 60000;
// The API defaults to a 10 MB scan-image guard. Keep mobile comfortably below
// it so JSON/base64 overhead and environment differences do not cause 413s.
export const OKYO_MAX_SCAN_IMAGE_DATA_URL_BYTES = 8_000_000;
export const OKYO_DEV_MODEL_OVERRIDE: OkyoModelOverride | undefined =
  __DEV__ && requestedDevModel === 'fable' ? 'fable' : undefined;

function isValidProductionApiUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
