import type { OkyoModelOverride } from './types';

if (__DEV__ && !process.env.EXPO_PUBLIC_OKYO_API_URL) {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_API_URL not set — using dev fallback. Set this before production builds.');
}

if (!__DEV__ && !process.env.EXPO_PUBLIC_OKYO_API_URL) {
  // Loud, non-fatal: a production build without this env var would otherwise
  // silently point at a developer's local LAN IP, which is never reachable
  // from a real device in the field.
  console.error('[Okyo] PRODUCTION BUILD MISSING EXPO_PUBLIC_OKYO_API_URL — falling back to a dev LAN IP that will not work. Set this env var before shipping.');
}

const requestedDevModel = process.env.EXPO_PUBLIC_OKYO_DEV_AI_MODEL;

if (__DEV__ && requestedDevModel && requestedDevModel !== 'fable') {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_DEV_AI_MODEL only supports "fable"; ignoring value.');
}

export const OKYO_API_BASE_URL = process.env.EXPO_PUBLIC_OKYO_API_URL ?? 'http://192.168.2.42:8081';
export const OKYO_API_TIMEOUT_MS = 60000;
export const OKYO_DEV_MODEL_OVERRIDE: OkyoModelOverride | undefined =
  __DEV__ && requestedDevModel === 'fable' ? 'fable' : undefined;
