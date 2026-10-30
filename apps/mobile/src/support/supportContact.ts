export const SUPPORT_EMAIL = 'support.okyo@gmail.com';
export const SUPPORT_MAILTO_URL = `mailto:${SUPPORT_EMAIL}`;

/** Opens the system mail composer for Okyo support. */
export function openSupportEmail(openURL: (url: string) => Promise<unknown>): Promise<unknown> {
  return openURL(SUPPORT_MAILTO_URL);
}
