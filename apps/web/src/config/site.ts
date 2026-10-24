// Single source for site-wide facts. Change values here, not in pages.

export const SITE_URL = 'https://okyoapp.com';
export const SITE_NAME = 'Okyo';

// Matches apps/mobile/src/support/supportContact.ts.
export const SUPPORT_EMAIL = 'support.okyo@gmail.com';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

// D10: no legal entity has been chosen. This placeholder is intentional and
// must be replaced after legal review. `npm run check:launch` fails while it remains.
export const LEGAL_ENTITY_PLACEHOLDER = '[Legal entity — pending legal review]';

// D3: the app has no live App Store listing, so there is no badge or link.
export const APP_STATUS_LABEL = 'Coming soon on iPhone';

export const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

// Drop "(draft)" only after counsel approves the text (D5).
export const FOOTER_LINKS = [
  { href: '/privacy', label: 'Privacy (draft)' },
  { href: '/terms', label: 'Terms (draft)' },
  { href: '/support', label: 'Support' },
  { href: '/delete-account', label: 'Delete account' },
] as const;
