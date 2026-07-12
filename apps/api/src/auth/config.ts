export type SupabaseAuthConfig = {
  issuer: string;
  jwksUrl: URL;
};

export class SupabaseAuthConfigurationError extends Error {
  constructor() {
    super('SUPABASE_URL must be configured as a valid HTTPS project URL.');
    this.name = 'SupabaseAuthConfigurationError';
  }
}

export function getSupabaseAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseAuthConfig {
  const configuredUrl = environment.SUPABASE_URL?.trim();
  if (!configuredUrl) {
    throw new SupabaseAuthConfigurationError();
  }

  try {
    const projectUrl = new URL(configuredUrl);
    if (
      projectUrl.protocol !== 'https:' ||
      !projectUrl.hostname ||
      projectUrl.username ||
      projectUrl.password ||
      projectUrl.search ||
      projectUrl.hash ||
      (projectUrl.pathname !== '/' && projectUrl.pathname !== '')
    ) {
      throw new SupabaseAuthConfigurationError();
    }

    const baseUrl = projectUrl.toString().replace(/\/$/, '');
    return {
      issuer: `${baseUrl}/auth/v1`,
      jwksUrl: new URL(`${baseUrl}/auth/v1/.well-known/jwks.json`),
    };
  } catch (error) {
    if (error instanceof SupabaseAuthConfigurationError) {
      throw error;
    }
    throw new SupabaseAuthConfigurationError();
  }
}

export function validateSupabaseAuthConfigAtStartup() {
  if (process.env.NODE_ENV === 'production') {
    getSupabaseAuthConfig();
  }
}
