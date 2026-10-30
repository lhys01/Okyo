import { activateClerkSsoSession, type ClerkSsoFlow, type ClerkSsoResult } from './clerkSsoCompletion';
import { getSafeClerkErrorDiagnostics } from './clerkDiagnostics';

export type GoogleSsoState = {
  phase: 'idle' | 'requesting' | 'awaiting_session';
  flow: ClerkSsoFlow | null;
  error: string | null;
};

type GoogleSsoDependencies = {
  isLoaded: boolean;
  isSignedIn: boolean;
  startSSOFlow: () => Promise<ClerkSsoResult>;
  onSsoSetActive?: () => void;
};

export type GoogleSsoOutcome =
  | { kind: 'already_running' | 'not_ready' | 'already_signed_in' }
  | { kind: 'cancelled' | 'incomplete'; browserLaunchAttempted: boolean }
  | { kind: 'awaiting_session'; flow: ClerkSsoFlow; browserLaunchAttempted: boolean; createdSessionIdReturned: boolean }
  | { kind: 'failed'; httpStatus: number | null; code: string; browserLaunchAttempted: boolean | null; createdSessionIdReturned: boolean | null };

const RETRY_MESSAGE = 'That didn’t go through. Give it another try.';

export class GoogleSsoFlight {
  private state: GoogleSsoState = { phase: 'idle', flow: null, error: null };
  private listeners = new Set<() => void>();

  getSnapshot = (): GoogleSsoState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(state: GoogleSsoState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private finish(error: string | null): void {
    this.update({ phase: 'idle', flow: null, error });
  }

  confirmSignedIn(): boolean {
    if (this.state.phase !== 'awaiting_session') return false;
    this.finish(null);
    return true;
  }

  failIfUnconfirmed(): boolean {
    if (this.state.phase !== 'awaiting_session') return false;
    this.finish('Google sign-in finished, but Okyo could not confirm the session. Please try again.');
    return true;
  }

  async start(deps: GoogleSsoDependencies): Promise<GoogleSsoOutcome> {
    if (this.state.phase !== 'idle') return { kind: 'already_running' };
    this.update({ phase: 'requesting', flow: null, error: null });

    if (!deps.isLoaded) {
      this.finish('Sign-in is still loading. Please try again.');
      return { kind: 'not_ready' };
    }
    if (deps.isSignedIn) {
      this.finish('You’re already signed in. Continue with this account or sign out before choosing Google.');
      return { kind: 'already_signed_in' };
    }

    let browserLaunchAttempted: boolean | null = null;
    let createdSessionIdReturned: boolean | null = null;
    try {
      const result = await deps.startSSOFlow();
      browserLaunchAttempted = result.authSessionResult !== null;
      createdSessionIdReturned = !!result.createdSessionId;
      if (result.createdSessionId?.trim() && result.setActive) deps.onSsoSetActive?.();
      const completion = await activateClerkSsoSession(result);
      if (completion.kind === 'activated') {
        this.update({ phase: 'awaiting_session', flow: completion.flow, error: null });
        return {
          kind: 'awaiting_session', flow: completion.flow,
          browserLaunchAttempted: result.authSessionResult !== null,
          createdSessionIdReturned: true,
        };
      }
      if (completion.kind === 'cancelled') {
        this.finish('Google sign-in was cancelled.');
        return { kind: 'cancelled', browserLaunchAttempted };
      }
      this.finish('Google sign-in did not finish. Please try again.');
      return { kind: 'incomplete', browserLaunchAttempted };
    } catch (caught: unknown) {
      const diagnostics = getSafeClerkErrorDiagnostics(caught);
      const message = diagnostics.code === 'session_exists'
        ? 'An account session is already active. Continue with it or sign out before choosing Google.'
        : /network|offline|internet|connection/i.test(diagnostics.code)
        ? 'You’re offline. Reconnect and try again.'
        : RETRY_MESSAGE;
      this.finish(message);
      return {
        kind: 'failed', httpStatus: diagnostics.httpStatus, code: diagnostics.code,
        browserLaunchAttempted,
        createdSessionIdReturned,
      };
    }
  }
}

export const googleSsoFlight = new GoogleSsoFlight();
