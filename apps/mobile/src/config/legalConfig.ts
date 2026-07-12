const configuredLegalUrls = {
  privacy: process.env.EXPO_PUBLIC_OKYO_PRIVACY_URL?.trim(),
  support: process.env.EXPO_PUBLIC_OKYO_SUPPORT_URL?.trim(),
  terms: process.env.EXPO_PUBLIC_OKYO_TERMS_URL?.trim(),
};

if (!__DEV__) {
  for (const [label, value] of Object.entries(configuredLegalUrls)) {
    if (!value || !isValidHttpsUrl(value)) {
      throw new Error(`[Okyo] Production requires a valid HTTPS ${label} URL.`);
    }
  }
}

export const legalUrls = configuredLegalUrls;

function isValidHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
