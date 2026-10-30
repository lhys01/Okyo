import type { OkyoModelOverride } from './types';

const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;
const DEVELOPMENT_API_FALLBACK = isDevelopment ? 'http://192.168.2.42:8081' : '';

export function resolveApiBaseUrl(input: {
  configuredUrl?: string;
  isDevelopment: boolean;
}): string {
  const configuredUrl = input.configuredUrl?.trim();
  if (configuredUrl) {
    // A release build must never silently send food photos or recipe context
    // over cleartext HTTP. Developers can still use an explicitly configured
    // LAN endpoint in a development client.
    if (input.isDevelopment || isReleaseSafeApiUrl(configuredUrl)) {
      return configuredUrl.replace(/\/+$/, '');
    }
    return '';
  }
  return input.isDevelopment ? DEVELOPMENT_API_FALLBACK : '';
}

export function readConfiguredApiUrl(environment: Record<string, string | undefined>): string | undefined {
  return environment.EXPO_PUBLIC_OKYO_API_URL;
}

export function isReleaseSafeApiUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  const isRailwayDevelopment = /(?:^|[.-])(?:development|staging|preview)(?:[.-]|$)/i.test(hostname);
  return url.protocol === 'https:' && !url.username && !url.password &&
    !url.search && !url.hash && !isRailwayDevelopment && !isLocalOrPrivateHost(hostname);
}

function isLocalOrPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
      hostname.endsWith('.internal') || hostname === '0.0.0.0' || hostname === '[::1]' ||
      /^\[(?:fc|fd|fe[89ab])/i.test(hostname)) return true;
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return true;
  return octets[0] === 10 || octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254);
}

if (isDevelopment && !process.env.EXPO_PUBLIC_OKYO_API_URL) {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_API_URL not set — using dev fallback. Set this before production builds.');
}

const requestedDevModel = process.env.EXPO_PUBLIC_OKYO_DEV_AI_MODEL;

if (isDevelopment && requestedDevModel && requestedDevModel !== 'fable') {
  console.warn('[Okyo] EXPO_PUBLIC_OKYO_DEV_AI_MODEL only supports "fable"; ignoring value.');
}

export const OKYO_API_BASE_URL = resolveApiBaseUrl({
  // Expo substitutes only direct public-variable property accesses in a bundle.
  configuredUrl: process.env.EXPO_PUBLIC_OKYO_API_URL,
  isDevelopment,
});
export const OKYO_API_TIMEOUT_MS = 60000;
export const OKYO_DEV_MODEL_OVERRIDE: OkyoModelOverride | undefined =
  isDevelopment && requestedDevModel === 'fable' ? 'fable' : undefined;
