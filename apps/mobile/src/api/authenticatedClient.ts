import { getCurrentAccessToken } from '../auth/session';
import { createAuthenticatedFetch } from './authenticatedFetch';

export const authenticatedFetch = createAuthenticatedFetch({
  getAccessToken: getCurrentAccessToken,
});
