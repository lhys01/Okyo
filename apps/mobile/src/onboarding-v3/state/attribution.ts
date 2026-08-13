export const ATTRIBUTION_SOURCES = [
  'influencer',
  'instagram',
  'tiktok',
  'youtube',
  'app_store',
  'friends_family',
] as const;

export type AttributionSource = typeof ATTRIBUTION_SOURCES[number];

export function isAttributionSource(value: unknown): value is AttributionSource {
  return typeof value === 'string' && ATTRIBUTION_SOURCES.includes(value as AttributionSource);
}
