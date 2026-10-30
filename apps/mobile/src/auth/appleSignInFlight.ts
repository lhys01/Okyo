import { activateClerkAppleSession, getCreatedSessionId, type ClerkAppleResult, type ClerkSsoFlow } from './clerkSsoCompletion';
import { getSafeClerkErrorDiagnostics } from './clerkDiagnostics';

export type AppleSignInState = {
  phase: 'idle' | 'requesting' | 'awaiting_session';
  flow: ClerkSsoFlow | null;
  error: string | null;
};

type AppleSignInDependencies = {
  isLoaded: boolean;
  isSignedIn: boolean;
  isOtherAuthActive: () => boolean;
  startAppleAuthenticationFlow: () => Promise<ClerkAppleResult>;
  onSetActive?: () => void;
};

export type AppleSignInOutcome =
  | { kind: 'already_running' | 'other_auth_active' | 'not_ready' | 'already_signed_in' | 'cancelled' | 'incomplete' }
  | { kind: 'awaiting_session'; flow: ClerkSsoFlow; createdSessionIdReturned: boolean; setActiveRan: boolean }
  | { kind: 'failed'; code: string; httpStatus: number | null; rejectedParameter?: string; requestId?: string; messageCategory: 'native_strategy_unavailable' | 'other_failure'; createdSessionIdReturned: boolean; setActiveRan: boolean };

/** Module-scoped flight survives account-screen remounts while the native sheet is open. */
export class AppleSignInFlight {
  private state: AppleSignInState = { phase: 'idle', flow: null, error: null };
  private listeners = new Set<() => void>();

  getSnapshot = (): AppleSignInState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(state: AppleSignInState): void {
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
    this.finish('Apple sign-in finished, but Okyo could not confirm the session. Please try again.');
    return true;
  }

  async start(deps: AppleSignInDependencies): Promise<AppleSignInOutcome> {
    if (this.state.phase !== 'idle') return { kind: 'already_running' };
    if (deps.isOtherAuthActive()) return { kind: 'other_auth_active' };
    if (!deps.isLoaded) {
      this.finish('Sign-in is still loading. Please try again.');
      return { kind: 'not_ready' };
    }
    if (deps.isSignedIn) {
      // An existing account is not proof that this Apple button succeeded.
      this.finish('You’re already signed in. Continue with this account or sign out before choosing Apple.');
      return { kind: 'already_signed_in' };
    }

    this.update({ phase: 'requesting', flow: null, error: null });
    let createdSessionIdReturned = false;
    let setActiveRan = false;
    try {
      const result = await deps.startAppleAuthenticationFlow();
      createdSessionIdReturned = getCreatedSessionId(result).length > 0;
      if (!createdSessionIdReturned) {
        // The installed Clerk native hook resolves without a session on cancel.
        this.finish('Apple sign-in was cancelled. You can try again.');
        return { kind: 'cancelled' };
      }
      if (!result.setActive) {
        this.finish('Apple sign-in did not finish. Please try again.');
        return { kind: 'incomplete' };
      }
      const flow = await activateClerkAppleSession({
        ...result,
        setActive: (params) => {
          setActiveRan = true;
          deps.onSetActive?.();
          return result.setActive!(params);
        },
      });
      if (!flow) {
        this.finish('Apple sign-in did not finish. Please try again.');
        return { kind: 'incomplete' };
      }
      this.update({ phase: 'awaiting_session', flow, error: null });
      return { kind: 'awaiting_session', flow, createdSessionIdReturned, setActiveRan };
    } catch (caught: unknown) {
      const { code, httpStatus, rejectedParameter, requestId } = getSafeClerkErrorDiagnostics(caught);
      if (code === 'ERR_REQUEST_CANCELED') {
        this.finish('Apple sign-in was cancelled. You can try again.');
        return { kind: 'cancelled' };
      }
      if (code === 'session_exists') {
        this.finish('You’re already signed in. Continue with this account or sign out before choosing Apple.');
        return { kind: 'already_signed_in' };
      }
      const nativeStrategyUnavailable = code === 'form_param_value_invalid' && rejectedParameter === 'strategy';
      this.finish(code === 'strategy_not_enabled' || nativeStrategyUnavailable
        ? 'Apple sign-in isn’t enabled for this Clerk environment. Try another sign-in method or contact support.'
        : 'Apple sign-in couldn’t be completed. Please try again.');
      return {
        kind: 'failed', code, httpStatus,
        ...(rejectedParameter ? { rejectedParameter } : {}),
        ...(requestId ? { requestId } : {}),
        messageCategory: nativeStrategyUnavailable ? 'native_strategy_unavailable' : 'other_failure',
        createdSessionIdReturned, setActiveRan,
      };
    }
  }
}

export const appleSignInFlight = new AppleSignInFlight();
