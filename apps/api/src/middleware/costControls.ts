import type { NextFunction, Request, Response } from 'express';

import { getCostControlConfig } from '../config/costControlConfig.js';
import { isSafeLocalLoadTestEnvironment } from '../services/loadTestMock.js';
import { reserveSharedGlobalAiQuota, SharedAiQuotaLimitExceededError } from '../services/sharedAiQuota.js';

// ─── Per-IP Rate Limiter ─────────────────────────────────────────────────────
//
// Simple in-memory sliding window. Resets on server restart.
// Replace with Redis before public launch so limits survive deploys.

type RateLimitEntry = { count: number; windowStart: number };
const ipWindowMap = new Map<string, RateLimitEntry>();
const MAX_RATE_LIMIT_KEYS = 100_000;

export class AiDailyCapExceededError extends Error {
  constructor() {
    super('Daily AI provider-call capacity has been exhausted.');
    this.name = 'AiDailyCapExceededError';
  }
}

export function scanRateLimitMiddleware(request: Request, response: Response, next: NextFunction) {
  const config = getCostControlConfig();
  const ip = getClientIp(request);
  const syntheticUser = request.get('x-okyo-load-user') ?? '';
  const rateLimitKey = isSafeLocalLoadTestEnvironment(process.env) &&
    /^load_[A-Za-z0-9_-]{4,80}$/.test(syntheticUser) && !request.get('authorization')
    ? `load:${syntheticUser}` : ip;
  const now = Date.now();
  pruneRateLimitEntries(now, config.scanRateLimitWindowMs);
  const entry = ipWindowMap.get(rateLimitKey);

  if (!entry || now - entry.windowStart >= config.scanRateLimitWindowMs) {
    ipWindowMap.set(rateLimitKey, { count: 1, windowStart: now });
    return next();
  }

  if (entry.count >= config.scanRateLimitMax) {
    const retryAfterSeconds = Math.max(1, Math.ceil((config.scanRateLimitWindowMs - (now - entry.windowStart)) / 1_000));
    response.setHeader('Retry-After', String(retryAfterSeconds));
    response.setHeader('X-RateLimit-Limit', String(config.scanRateLimitMax));
    response.setHeader('X-RateLimit-Remaining', '0');
    response.status(429).json({
      ok: false,
      error: {
        code: 'rate_limit_exceeded',
        message: 'Too many scan requests. Please wait a moment before trying again.',
      },
    });
    logCostEvent('rate_limit_hit', { ip: maskIp(ip), limit: config.scanRateLimitMax, windowMs: config.scanRateLimitWindowMs });
    return;
  }

  entry.count += 1;
  response.setHeader('X-RateLimit-Limit', String(config.scanRateLimitMax));
  response.setHeader('X-RateLimit-Remaining', String(Math.max(0, config.scanRateLimitMax - entry.count)));
  return next();
}

// ─── Global Daily AI Request Cap ─────────────────────────────────────────────
//
// In-memory counter, resets at midnight UTC or on restart.
// Use a persistent counter (DB/Redis) before public launch.

let globalDailyAiRequests = 0;
let globalDailyResetAt = 0;

export function checkAndIncrementGlobalAiCap(): boolean {
  const config = getCostControlConfig();
  const now = Date.now();

  if (now >= globalDailyResetAt) {
    if (globalDailyAiRequests > 0) {
      logCostEvent('global_ai_cap_daily_reset', { previousCount: globalDailyAiRequests });
    }
    globalDailyAiRequests = 0;
    globalDailyResetAt = getNextMidnightUtc();
  }

  if (globalDailyAiRequests >= config.aiDailyRequestCap) {
    logCostEvent('global_ai_cap_exceeded', { count: globalDailyAiRequests, cap: config.aiDailyRequestCap });
    return false;
  }

  globalDailyAiRequests += 1;
  logCostEvent('global_ai_cap_incremented', { count: globalDailyAiRequests, cap: config.aiDailyRequestCap });
  return true;
}

export function getGlobalAiRequestCount(): number {
  return globalDailyAiRequests;
}

/** Reserve one actual provider attempt, including retries and fallbacks. */
export async function reserveGlobalAiProviderCall(model?: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    try {
      await reserveSharedGlobalAiQuota({
        key: 'okyo:ai-provider-calls:global:daily',
        limit: getCostControlConfig().aiDailyRequestCap,
        ...(model ? { model } : {}),
      });
    } catch (error) {
      if (error instanceof SharedAiQuotaLimitExceededError) throw new AiDailyCapExceededError();
      throw error;
    }
    return;
  }
  if (!checkAndIncrementGlobalAiCap()) throw new AiDailyCapExceededError();
}

// ─── Fable 5 Daily Request Cap ───────────────────────────────────────────────
//
// Separate counter from the global AI cap above — Fable 5 is opt-in and much
// more expensive per request, so it must never share headroom with the
// default OpenRouter cap. Same in-memory/midnight-UTC-reset pattern.

let fableDailyRequests = 0;
let fableDailyResetAt = 0;

export function checkAndIncrementFableCap(): boolean {
  const config = getCostControlConfig();
  const now = Date.now();

  if (now >= fableDailyResetAt) {
    if (fableDailyRequests > 0) {
      logCostEvent('fable_cap_daily_reset', { previousCount: fableDailyRequests });
    }
    fableDailyRequests = 0;
    fableDailyResetAt = getNextMidnightUtc();
  }

  const exceeded = fableDailyRequests >= config.fableDailyRequestCap;
  console.log('[fable_cap]', { count: fableDailyRequests, cap: config.fableDailyRequestCap, exceeded });

  if (exceeded) {
    logCostEvent('fable_cap_exceeded', { count: fableDailyRequests, cap: config.fableDailyRequestCap });
    return false;
  }

  fableDailyRequests += 1;
  logCostEvent('fable_cap_incremented', { count: fableDailyRequests, cap: config.fableDailyRequestCap });
  return true;
}

// ─── Image Generation Kill Switch (scaffold) ─────────────────────────────────
//
// IMAGE_GEN_ENABLED=false blocks all future image generation calls.
// Add this check at the top of any image generation service before enabling.

export function isImageGenAllowed(): boolean {
  const config = getCostControlConfig();
  if (!config.imageGenEnabled) {
    logCostEvent('image_gen_blocked', { reason: 'IMAGE_GEN_ENABLED is false' });
    return false;
  }
  return true;
}

// ─── Cost Event Logger ───────────────────────────────────────────────────────

export function logCostEvent(event: string, details: Record<string, unknown>) {
  console.log(`[cost] ${event}`, {
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getClientIp(request: Request): string {
  // Do not trust x-forwarded-for in dev (spoofable). Wire up trusted proxy
  // headers (e.g. express `trust proxy`) when deploying behind a load balancer.
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}

function pruneRateLimitEntries(now: number, windowMs: number): void {
  for (const [ip, entry] of ipWindowMap) {
    if (now - entry.windowStart >= windowMs) ipWindowMap.delete(ip);
  }
  while (ipWindowMap.size >= MAX_RATE_LIMIT_KEYS) {
    const oldest = ipWindowMap.keys().next().value;
    if (oldest === undefined) break;
    ipWindowMap.delete(oldest);
  }
}

export function getClientIpForScope(request: Request): string {
  return getClientIp(request);
}

export function resetCostControlsForTests(): void {
  ipWindowMap.clear();
  globalDailyAiRequests = 0;
  globalDailyResetAt = 0;
  fableDailyRequests = 0;
  fableDailyResetAt = 0;
}

function maskIp(ip: string): string {
  // Mask last octet for IPv4, last group for IPv6 to avoid logging full IPs.
  return ip.replace(/(\d+)$/, 'x').replace(/[0-9a-f]+$/, 'x');
}

function getNextMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime();
}
