import { databaseConfigured, databaseHealthy } from '../persistence/database.js';
import { getAiConfig } from '../config/aiConfig.js';

type ClerkReadiness = {
  clerkSecretConfigured: boolean;
  clerkSecretValid: boolean;
  authorizedPartiesConfigured: boolean;
  authorizedPartiesValid: boolean;
};

function getProductionAuthReadiness(): ClerkReadiness {
  const clerkSecret = process.env.CLERK_SECRET_KEY?.trim() ?? '';
  const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    clerkSecretConfigured: clerkSecret.length > 0,
    clerkSecretValid: clerkSecret.startsWith('sk_live_') && clerkSecret.length > 'sk_live_'.length,
    authorizedPartiesConfigured: authorizedParties.length > 0,
    authorizedPartiesValid: authorizedParties.length > 0 && authorizedParties.every(isAuthorizedParty),
  };
}

function isAuthorizedParty(value: string): boolean {
  if (value.includes('*') || value === 'null' || value.length > 512) return false;
  if (/^https:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname) && url.username === '' &&
        url.password === '' && url.pathname === '/' && url.search === '' && url.hash === '';
    } catch {
      return false;
    }
  }
  return /^okyo:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/i.test(value);
}

function hasValidQuotaConfiguration(): boolean {
  const hmacKey = process.env.QUOTA_SCOPE_HMAC_KEY?.trim() ?? '';
  const limits = [
    [process.env.AI_SUBJECT_DAILY_CALL_CAP, 30],
    [process.env.AI_DAILY_REQUEST_CAP, 500],
    [process.env.FABLE_DAILY_REQUEST_CAP, 10],
  ] as const;
  return hmacKey.length >= 32 && limits.every(([value, fallback]) => {
    if (value === undefined || value === '') return true;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 1_000_000 && fallback > 0;
  });
}

export async function productionReadiness() {
  const ai = getAiConfig();
  const clerkAuth = getProductionAuthReadiness();
  const persistentStateConfigured = databaseConfigured();
  const persistentStateHealthy = persistentStateConfigured && await databaseHealthy();
  const quotaConfigValid = hasValidQuotaConfiguration();
  const providerConfigured = ai.enabled && Boolean(ai.openRouterApiKey?.startsWith('sk-or-v1-'));
  const authConfigValid = clerkAuth.clerkSecretValid && clerkAuth.authorizedPartiesValid;
  // Readiness never calls OpenRouter (or any other AI provider). It only
  // checks local configuration and durable persistence, so a healthcheck
  // cannot create spend or leak credentials.
  const productionAiEnabled = process.env.NODE_ENV === 'production' &&
    process.env.PRODUCTION_AI_ENABLED === 'true' && ai.enabled &&
    persistentStateHealthy && quotaConfigValid && authConfigValid && providerConfigured;
  return {
    persistentStateConfigured, persistentStateHealthy,
    sharedAiQuotaConfigured: persistentStateHealthy && quotaConfigValid,
    databaseConnectivity: persistentStateHealthy ? 'available' : 'unavailable',
    aiEnabled: ai.enabled,
    quotaConfigValid, providerConfigured,
    // These values indicate safe local validation/configuration only; no
    // vendor credential probe is performed by the readiness route.
    providerCredentialValid: providerConfigured,
    providerAvailable: providerConfigured,
    clerkAuth: { ...clerkAuth, clerkCredentialValid: authConfigValid },
    productionAiEnabled,
  };
}

export function resetProductionReadinessProbesForTests(): void {}
