import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(currentDir, '../..');
const repoRoot = resolve(apiRoot, '../..');

loadDotenv({ path: resolve(repoRoot, '.env'), quiet: true });
loadDotenv({ path: resolve(apiRoot, '.env'), quiet: true });

const defaultOpenRouterModel = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
const defaultTimeoutMs = 30000;

export type AiProviderName = 'openrouter';

export type AiConfig = {
  enabled: boolean;
  provider: AiProviderName;
  openRouterApiKey?: string;
  openRouterVisionModel: string;
  openRouterTextModel: string;
  timeoutMs: number;
};

export function getAiConfig(): AiConfig {
  return {
    enabled: process.env.AI_ENABLED === 'true',
    provider: getProvider(process.env.AI_PROVIDER),
    openRouterApiKey: getOptionalSecret(process.env.OPENROUTER_API_KEY),
    openRouterVisionModel: process.env.OPENROUTER_VISION_MODEL?.trim() || defaultOpenRouterModel,
    openRouterTextModel: process.env.OPENROUTER_TEXT_MODEL?.trim() || defaultOpenRouterModel,
    timeoutMs: getTimeoutMs(process.env.AI_TIMEOUT_MS),
  };
}

function getProvider(value: string | undefined): AiProviderName {
  if (value === 'openrouter') {
    return value;
  }

  return 'openrouter';
}

function getOptionalSecret(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getTimeoutMs(value: string | undefined) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return defaultTimeoutMs;
}
