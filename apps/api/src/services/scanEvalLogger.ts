import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AiConfig } from '../config/aiConfig.js';
import type { ScanResult } from '../types.js';
import type { AiSource } from './aiService.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(currentDir, '../..');
const logDir = resolve(apiRoot, 'logs');
const logFile = resolve(logDir, 'scan-evals.jsonl');

export type ScanEvaluationLogInput = {
  aiSource: AiSource;
  config: AiConfig;
  fallbackReason?: string;
  rejectionReason?: string;
  rejectionType?: string;
  scan?: ScanResult;
  scanId?: string;
  status: string;
  uploadedImage: boolean;
};

export async function logScanEvaluation(input: ScanEvaluationLogInput) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const entry = {
    event: 'ai_scan_eval',
    loggedAt: new Date().toISOString(),
    scanId: input.scan?.id ?? input.scanId,
    dishName: input.scan?.dishName,
    confidence: input.scan?.confidence,
    restaurantPrice: input.scan?.restaurantPrice,
    homemadeCost: input.scan?.homemadeCost,
    savings: input.scan?.estimatedSavings,
    status: input.status,
    uploadedImage: input.uploadedImage,
    aiSource: input.aiSource,
    fallbackReason: input.fallbackReason,
    rejectionType: input.rejectionType,
    rejectionReason: input.rejectionReason,
    model: input.config.openRouterVisionModel,
    recipeModel: input.config.openRouterTextModel,
  };

  console.log('ai_scan_eval', entry);

  try {
    await mkdir(logDir, { recursive: true });
    await appendFile(logFile, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    console.warn('ai_scan_eval_log_failed', {
      reason: error instanceof Error ? error.message : 'Unknown log write error.',
    });
  }
}
