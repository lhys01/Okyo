export type AuthSession = {
  access_token: string;
  expires_at?: number;
  user?: { is_anonymous?: boolean };
};

type AuthError = { message?: string; code?: string } | null;

export type SupabaseAuthBoundary = {
  getSession(): Promise<{ data: { session: AuthSession | null }; error: AuthError }>;
  signInAnonymously(): Promise<{ data: { session: AuthSession | null }; error: AuthError }>;
  refreshSession(): Promise<{ data: { session: AuthSession | null }; error: AuthError }>;
};

export type AuthSessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; anonymous: boolean }
  | { status: 'error'; code: 'configuration' | 'temporary_offline' | 'auth_unavailable'; temporary: boolean };

type SafeLogger = { warn(message: string): void };

const refreshLeewaySeconds = 30;

export function createAuthSessionService(
  auth: SupabaseAuthBoundary,
  options: { now?: () => number; logger?: SafeLogger } = {},
) {
  const now = options.now ?? Date.now;
  const logger = options.logger ?? console;
  let state: AuthSessionState = { status: 'loading' };
  let initialization: Promise<AuthSessionState> | null = null;

  async function initialize(): Promise<AuthSessionState> {
    if (state.status === 'authenticated') {
      return state;
    }
    if (initialization) {
      return initialization;
    }

    state = { status: 'loading' };
    initialization = initializeOnce().finally(() => {
      initialization = null;
    });
    return initialization;
  }

  async function initializeOnce(): Promise<AuthSessionState> {
    try {
      const restored = await auth.getSession();
      if (restored.error) {
        return setFailure(restored.error);
      }

      let session = restored.data.session;
      if (session && isExpired(session)) {
        session = await refresh();
        if (!session) return state;
      }

      if (!session) {
        const signedIn = await auth.signInAnonymously();
        if (signedIn.error || !signedIn.data.session) {
          return setFailure(signedIn.error);
        }
        session = signedIn.data.session;
      }

      state = { status: 'authenticated', anonymous: session.user?.is_anonymous === true };
      return state;
    } catch (error) {
      return setFailure(toSafeError(error));
    }
  }

  async function getAccessToken(): Promise<string | null> {
    if (state.status !== 'authenticated') {
      return null;
    }

    try {
      const current = await auth.getSession();
      if (current.error || !current.data.session) {
        setFailure(current.error);
        return null;
      }

      const session = isExpired(current.data.session)
        ? await refresh()
        : current.data.session;
      return session?.access_token || null;
    } catch (error) {
      setFailure(toSafeError(error));
      return null;
    }
  }

  async function refresh(): Promise<AuthSession | null> {
    const refreshed = await auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      setFailure(refreshed.error);
      return null;
    }
    state = {
      status: 'authenticated',
      anonymous: refreshed.data.session.user?.is_anonymous === true,
    };
    return refreshed.data.session;
  }

  function isExpired(session: AuthSession) {
    return typeof session.expires_at === 'number' &&
      session.expires_at <= Math.floor(now() / 1000) + refreshLeewaySeconds;
  }

  function setFailure(error: AuthError): AuthSessionState {
    const configuration = error?.code === 'configuration';
    const offline = isTemporaryOffline(error?.message);
    state = {
      status: 'error',
      code: configuration ? 'configuration' : offline ? 'temporary_offline' : 'auth_unavailable',
      temporary: !configuration,
    };
    logger.warn(`[Okyo auth] ${offline ? 'Session temporarily unavailable.' : 'Session initialization failed.'}`);
    return state;
  }

  return {
    initialize,
    getAccessToken,
    getState: () => state,
  };
}

function isTemporaryOffline(message: string | undefined) {
  return Boolean(message && /network|fetch|offline|timeout/i.test(message));
}

function toSafeError(error: unknown): AuthError {
  return error instanceof Error ? { message: error.message } : null;
}
