/**
 * The only social sign-in providers shown by Okyo.
 *
 * This is the single source of truth for that rule, and it is enforced in
 * two directions:
 *  - the sign-in screen renders exactly one button per entry here, so a new
 *    provider can never appear in the UI by accident; and
 *  - `isAllowedAuthStrategy` rejects any other OAuth provider. Email/password
 *    authentication uses the dedicated form and Clerk's password methods.
 *
 * Clerk's dashboard is the source of truth for available authentication
 * methods; this list controls only the Apple and Google OAuth buttons.
 */
export const ALLOWED_AUTH_STRATEGIES = Object.freeze(['oauth_apple', 'oauth_google'] as const);

export type AllowedAuthStrategy = (typeof ALLOWED_AUTH_STRATEGIES)[number];

export function isAllowedAuthStrategy(strategy: string): strategy is AllowedAuthStrategy {
  return (ALLOWED_AUTH_STRATEGIES as readonly string[]).includes(strategy);
}

export interface AuthProviderOption {
  strategy: AllowedAuthStrategy;
  label: string;
  accessibilityLabel: string;
  /**
   * How prominent the button is. Apple is `primary` (filled, dark, with the
   * Apple mark) to satisfy App Store Review Guideline 4.8 — it must be at
   * least as prominent as any other option. Google is `secondary`.
   */
  variant: 'primary' | 'secondary';
}

/**
 * Apple is listed first deliberately. App Store Review Guideline 4.8
 * requires Sign in with Apple to be offered at least as prominently as other
 * third-party sign-in options whenever they are present.
 */
export const AUTH_PROVIDER_OPTIONS: readonly AuthProviderOption[] = Object.freeze([
  { strategy: 'oauth_apple', label: 'Continue with Apple', accessibilityLabel: 'Sign in with Apple', variant: 'primary' },
  { strategy: 'oauth_google', label: 'Continue with Google', accessibilityLabel: 'Sign in with Google', variant: 'secondary' },
]);
