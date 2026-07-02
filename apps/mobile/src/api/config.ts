import type { OkyoModelOverride } from './types';

if (__DEV__ && !process.env.EXPO_PUBLIC_OKYO_API_URL) {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_API_URL not set — using dev fallback. Set this before production builds.');
}

const requestedDevModel = process.env.EXPO_PUBLIC_OKYO_DEV_AI_MODEL;

if (__DEV__ && requestedDevModel && requestedDevModel !== 'fable') {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_DEV_AI_MODEL only supports "fable"; ignoring value.');
}

export const OKYO_API_BASE_URL = process.env.EXPO_PUBLIC_OKYO_API_URL ?? 'http://192.168.2.42:8081';
export const OKYO_API_TIMEOUT_MS = 60000;
export const OKYO_DEV_MODEL_OVERRIDE: OkyoModelOverride | undefined =
  __DEV__ && requestedDevModel === 'fable' ? 'fable' : undefined;
