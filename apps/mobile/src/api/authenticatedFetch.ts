export class AuthUnavailableError extends Error {
  constructor() {
    super('Okyo is still preparing a secure session. Please try again.');
    this.name = 'AuthUnavailableError';
  }
}

export function createAuthenticatedFetch(options: {
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;

  return async function authenticatedFetch(input: string | URL, init: RequestInit = {}) {
    const protectedRequest = isProtectedApiRequest(input);
    const headers = new Headers(init.headers);

    if (protectedRequest) {
      const accessToken = await options.getAccessToken();
      if (!accessToken) {
        throw new AuthUnavailableError();
      }
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return fetchImpl(input, { ...init, headers });
  };
}

function isProtectedApiRequest(input: string | URL) {
  try {
    const path = input instanceof URL ? input.pathname : new URL(input, 'https://okyo.invalid').pathname;
    return path === '/v1' || path.startsWith('/v1/');
  } catch {
    return false;
  }
}
