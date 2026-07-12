import { createAuthSessionService, type SupabaseAuthBoundary } from './sessionService';
import { supabaseClient } from './supabaseClient';

const unavailableAuth: SupabaseAuthBoundary = {
  async getSession() {
    return { data: { session: null }, error: { code: 'configuration' } };
  },
  async signInAnonymously() {
    return { data: { session: null }, error: { code: 'configuration' } };
  },
  async refreshSession() {
    return { data: { session: null }, error: { code: 'configuration' } };
  },
};

const authSessionService = createAuthSessionService(
  (supabaseClient?.auth ?? unavailableAuth) as SupabaseAuthBoundary,
);

export const initializeAuthSession = authSessionService.initialize;
export const getCurrentAccessToken = authSessionService.getAccessToken;
export const getAuthSessionState = authSessionService.getState;
