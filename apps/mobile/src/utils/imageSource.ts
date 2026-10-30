import type { ImageProps } from 'expo-image';

export type OkyoImageSource = ImageProps['source'];

const SUPPORTED_LOCAL_SCHEMES = /^(file|content|ph|assets-library):\/\//i;

/**
 * Return a stable key for diagnostics/state transitions without retaining the
 * source object itself. Static Metro modules use their numeric module id;
 * remote/device images use their URI.
 */
export function getImageSourceKey(source: OkyoImageSource | null | undefined): string {
  if (typeof source === 'number') return `asset:${source}`;
  if (typeof source === 'string') return `string:${source}`;
  if (Array.isArray(source)) return `array:${source.map(getImageSourceKey).join('|')}`;
  if (source && typeof source === 'object' && 'uri' in source) {
    return `uri:${String(source.uri ?? '')}`;
  }
  return source ? 'shared-image' : 'none';
}

/**
 * Validate values before they reach a native image loader. Bare strings such
 * as `undefined`, expired API placeholders, and malformed URLs are rejected;
 * literal Metro module ids and device file schemes remain valid.
 */
export function normalizeImageSource(source: OkyoImageSource | null | undefined): OkyoImageSource | null {
  if (source === null || source === undefined) return null;
  if (typeof source === 'number') return source;
  if (Array.isArray(source)) {
    // expo-image accepts string arrays for source fallbacks. Its public source
    // type does not accept an array that mixes objects and strings, so keep the
    // first valid non-string source or normalize a pure string array.
    const usable = source
      .map((item) => normalizeImageSource(item))
      .filter((item): item is NonNullable<OkyoImageSource> => item !== null);
    if (usable.length === 0) return null;
    if (usable.every((item): item is string => typeof item === 'string')) return usable;
    return usable.find((item) => typeof item !== 'string') ?? usable[0] ?? null;
  }
  if (typeof source === 'string') {
    if (source.startsWith('sf:')) return source;
    const uri = normalizeImageUri(source);
    return uri ? { uri } : null;
  }
  if (typeof source === 'object' && 'uri' in source) {
    const uri = normalizeImageUri(source.uri);
    return uri ? { ...source, uri } : null;
  }
  // SharedRef values are produced by expo-image itself and do not expose a
  // URI. Keep them intact rather than trying to inspect native internals.
  return source;
}

export function normalizeImageUri(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const uri = value.trim();
  if (!uri) return null;
  if (SUPPORTED_LOCAL_SCHEMES.test(uri) || /^data:image\//i.test(uri)) return uri;

  try {
    const parsed = new URL(uri);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname) {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export function imageSourceDescription(source: OkyoImageSource | null | undefined): string {
  if (typeof source === 'number') return `asset module ${source}`;
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && 'uri' in source) return String(source.uri ?? '');
  return getImageSourceKey(source);
}
