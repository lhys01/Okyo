const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const configuredPublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const isProduction = typeof __DEV__ !== 'undefined'
  ? !__DEV__
  : process.env.NODE_ENV === 'production';

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export const supabasePublicConfig = getSupabasePublicConfig();

function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const valid = Boolean(
    configuredUrl &&
    configuredPublishableKey &&
    isValidSupabaseUrl(configuredUrl) &&
    isValidPublishableKey(configuredPublishableKey),
  );

  if (valid) {
    return {
      url: configuredUrl!,
      publishableKey: configuredPublishableKey!,
    };
  }

  if (isProduction) {
    throw new Error(
      '[Okyo] Production requires valid EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY values.',
    );
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[Okyo auth] Supabase public configuration is missing or invalid.');
  }
  return null;
}

function isValidSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function isValidPublishableKey(value: string) {
  if (value.startsWith('sb_publishable_')) {
    return value.length > 'sb_publishable_'.length + 20;
  }
  const jwtSegments = value.split('.');
  return jwtSegments.length === 3 && jwtSegments.every((segment) => segment.length > 10);
}
