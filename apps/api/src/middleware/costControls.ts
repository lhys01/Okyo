import type { NextFunction, Request, Response } from 'express';

import { getCostControlConfig } from '../config/costControlConfig.js';

// ─── Per-IP Rate Limiter ─────────────────────────────────────────────────────
//
// Simple in-memory sliding window. Resets on server restart.
// Replace with Redis before public launch so limits survive deploys.

type RateLimitEntry = { count: number; windowStart: number };
const ipWindowMap = new Map<string, RateLimitEntry>();

export function scanRateLimitMiddleware(request: Request, response: Response, next: NextFunction) {
  const config = getCostControlConfig();
  const ip = getClientIp(request);
  const now = Date.now();
  const entry = ipWindowMap.get(ip);

  if (!entry || now - entry.windowStart >= config.scanRateLimitWindowMs) {
    ipWindowMap.set(ip, { count: 1, windowStart: now });
    return next();
  }

  if (entry.count >= config.scanRateLimitMax) {
    response.status(429).json({
      ok: false,
      error: {
        code: 'rate_limit_exceeded',
        message: 'Too many scan requests. Please wait a moment before trying again.',
      },
    });
    logCostEvent('rate_limit_hit', {
      requestId: request.scanContext?.requestId,
      ip: maskIp(ip),
      limit: config.scanRateLimitMax,
      windowMs: config.scanRateLimitWindowMs,
    });
    return;
  }

  entry.count += 1;
  return next();
}

// ─── Fable 5 Daily Request Cap ───────────────────────────────────────────────
//
// Additional model-specific kill cap. Persistent per-attempt quota enforcement
// remains authoritative for every Fable provider call.

let fableDailyRequests = 0;
let fableDailyResetAt = 0;

export function checkAndIncrementFableCap(requestId?: string): boolean {
  const config = getCostControlConfig();
  const now = Date.now();

  if (now >= fableDailyResetAt) {
    if (fableDailyRequests > 0) {
      logCostEvent('fable_cap_daily_reset', { requestId, previousCount: fableDailyRequests });
    }
    fableDailyRequests = 0;
    fableDailyResetAt = getNextMidnightUtc();
  }

  const exceeded = fableDailyRequests >= config.fableDailyRequestCap;
  console.log('[fable_cap]', { requestId, count: fableDailyRequests, cap: config.fableDailyRequestCap, exceeded });

  if (exceeded) {
    logCostEvent('fable_cap_exceeded', { requestId, count: fableDailyRequests, cap: config.fableDailyRequestCap });
    return false;
  }

  fableDailyRequests += 1;
  logCostEvent('fable_cap_incremented', { requestId, count: fableDailyRequests, cap: config.fableDailyRequestCap });
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

function maskIp(ip: string): string {
  // Mask last octet for IPv4, last group for IPv6 to avoid logging full IPs.
  return ip.replace(/(\d+)$/, 'x').replace(/[0-9a-f]+$/, 'x');
}

function getNextMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime();
}
