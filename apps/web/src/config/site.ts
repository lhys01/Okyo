// Single source for site-wide facts. Change values here, not in pages.

export const SITE_URL = 'https://okyoapp.com';
export const SITE_NAME = 'Okyo';

// Matches apps/mobile/src/support/supportContact.ts.
export const SUPPORT_EMAIL = 'support.okyo@gmail.com';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

export const SITE_PUBLISHER_NAME = 'Okyo';

// D3: the app has no live App Store listing, so there is no badge or link.
export const APP_STATUS_LABEL = 'Coming soon on iPhone';

export const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

// Publication remains gated by the legal review record.
export const FOOTER_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/support', label: 'Support' },
  { href: '/delete-account', label: 'Delete account' },
] as const;
