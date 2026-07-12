import { getSupabaseAuthConfig } from '../auth/config.js';

export type SupabaseDatabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

export class SupabaseDatabaseConfigurationError extends Error {
  constructor() {
    super('Supabase database persistence is not configured.');
    this.name = 'SupabaseDatabaseConfigurationError';
  }
}

export function getSupabaseDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseDatabaseConfig {
  let authConfig;
  try {
    authConfig = getSupabaseAuthConfig(environment);
  } catch {
    throw new SupabaseDatabaseConfigurationError();
  }
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey || serviceRoleKey.length < 20 || serviceRoleKey.startsWith('sb_publishable_')) {
    throw new SupabaseDatabaseConfigurationError();
  }

  return {
    url: authConfig.issuer.replace(/\/auth\/v1$/, ''),
    serviceRoleKey,
  };
}

export function validateSupabaseDatabaseConfigAtStartup() {
  if (process.env.NODE_ENV === 'production') {
    getSupabaseDatabaseConfig();
  }
}
