/** Deliberate opt-in to exactly one build environment; a key alone is insufficient. */
export const DEVELOPMENT_POSTHOG_PROJECT_ID = '584818';

export function analyticsAllowed(input: {
  posthogKey: string;
  posthogHost: string;
  projectId: string;
  environment: string;
  enabledEnvironment?: string;
}): boolean {
  if (!input.posthogKey || input.posthogHost !== 'https://us.i.posthog.com') return false;
  if (!['development', 'production'].includes(input.environment) || input.enabledEnvironment !== input.environment) return false;
  if (!/^\d+$/.test(input.projectId)) return false;
  // Project 584818 is exclusively the Development project. Production needs
  // an explicitly configured project ID and a different project token.
  return input.environment === 'development'
    ? input.projectId === DEVELOPMENT_POSTHOG_PROJECT_ID
    : input.projectId !== DEVELOPMENT_POSTHOG_PROJECT_ID;
}
