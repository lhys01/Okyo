import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(currentDir, '../..');
const repoRoot = resolve(apiRoot, '../..');

loadDotenv({ path: resolve(repoRoot, '.env'), quiet: true });
loadDotenv({ path: resolve(apiRoot, '.env'), quiet: true });

const defaultVisionModel = 'openai/gpt-4o-mini';
const defaultTextModel = 'openai/gpt-4o-mini';
const defaultTimeoutMs = 45000;
const defaultMaxOutputTokens = 1024;

export type AiProviderName = 'openrouter';

export type AiConfig = {
  enabled: boolean;
  provider: AiProviderName;
  openRouterApiKey?: string;
  openRouterVisionModel: string;
  openRouterTextModel: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

export type PublicAiConfig = {
  aiEnabled: boolean;
  provider: AiProviderName;
  hasOpenRouterKey: boolean;
  visionModel: string;
  textModel: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

export function getAiConfig(): AiConfig {
  return {
    enabled: process.env.AI_ENABLED === 'true',
    provider: 'openrouter',
    openRouterApiKey: process.env.OPENROUTER_API_KEY?.trim() || undefined,
    openRouterVisionModel: process.env.OPENROUTER_VISION_MODEL?.trim() || defaultVisionModel,
    openRouterTextModel: process.env.OPENROUTER_TEXT_MODEL?.trim() || defaultTextModel,
    timeoutMs: getTimeoutMs(process.env.AI_TIMEOUT_MS),
    maxOutputTokens: getPositiveInteger(process.env.AI_MAX_OUTPUT_TOKENS, defaultMaxOutputTokens),
  };
}

export function getPublicAiConfig(): PublicAiConfig {
  const config = getAiConfig();

  return {
    aiEnabled: config.enabled,
    provider: config.provider,
    hasOpenRouterKey: Boolean(config.openRouterApiKey),
    visionModel: config.openRouterVisionModel,
    textModel: config.openRouterTextModel,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
  };
}

function getTimeoutMs(value: string | undefined) {
  return getPositiveInteger(value, defaultTimeoutMs);
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}
