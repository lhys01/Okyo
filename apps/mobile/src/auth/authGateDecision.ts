/**
 * Decides whether the end-of-onboarding sign-in screen should be shown.
 *
 * Kept as a pure function (no hooks, no storage) so every branch is unit
 * testable — the same reason `tourGeometry` exists separately from the
 * overlay that renders it.
 */
export interface AuthGateInput {
  /** Production AI entry points require a session even during onboarding. */
  requireSession?: boolean;
  /** Onboarding must be finished first — auth never interrupts onboarding. */
  onboardingCompleted: boolean;
  /** Clerk finished restoring any existing session from the keychain. */
  authLoaded: boolean;
  /** Clerk reports a live session. */
  isSignedIn: boolean;
  /** Whether the prompt-seen flag has been read from storage yet. */
  promptSeenLoaded: boolean;
  /** The user already signed in, or already chose "Maybe later". */
  promptSeen: boolean;
}

export type AuthGateDecision = 'wait' | 'showSignIn' | 'continueToApp';

export function decideAuthGate(input: AuthGateInput): AuthGateDecision {
  if (input.requireSession) {
    if (!input.authLoaded) return 'wait';
    return input.isSignedIn ? 'continueToApp' : 'showSignIn';
  }
  // Auth is strictly post-onboarding. While onboarding is still running the
  // gate has no opinion at all.
  if (!input.onboardingCompleted) return 'continueToApp';

  // Never flash the sign-in screen at a user who is already signed in: wait
  // for Clerk to restore the session and for the flag to load first.
  if (!input.authLoaded || !input.promptSeenLoaded) return 'wait';

  // A live session always wins over the flag.
  if (input.isSignedIn) return 'continueToApp';

  return input.promptSeen ? 'continueToApp' : 'showSignIn';
}
