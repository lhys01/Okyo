if (__DEV__ && !process.env.EXPO_PUBLIC_OKYO_API_URL) {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_API_URL not set — using dev fallback. Set this before production builds.');
}
export const OKYO_API_BASE_URL = process.env.EXPO_PUBLIC_OKYO_API_URL ?? 'http://192.168.2.42:8081';
export const OKYO_API_TIMEOUT_MS = 60000;