import type { NextFunction, Request, Response } from 'express';

import { getRuntimeSafetyConfig } from '../config/runtimeSafety.js';
import { metrics } from '../observability/metrics.js';
import { logStructured } from '../observability/structuredLogger.js';

let draining = false;
let inFlight = 0;

export function setDraining(value: boolean): void {
  draining = value;
  metrics.setGauge('okyo_draining', value ? 1 : 0);
}

export function isDraining(): boolean {
  return draining;
}

export function getInFlightRequestCount(): number {
  return inFlight;
}

/** Rejects before JSON parsing when this process has no safe capacity left. */
export function requestLoadSheddingMiddleware(request: Request, response: Response, next: NextFunction): void {
  const isOperationalEndpoint = request.path === '/health' || request.path === '/ready' || request.path === '/live' ||
    (process.env.OKYO_LOAD_TEST_MODE === 'true' && request.path === '/internal/load-test/status');
  if (draining && !isOperationalEndpoint) {
    reject(response, 503, 'service_draining', 'Okyo is restarting. Please try again shortly.', 2);
    return;
  }
  if (inFlight >= getRuntimeSafetyConfig().apiMaxInFlightRequests && !isOperationalEndpoint) {
    metrics.increment('okyo_http_rejected_total', { reason: 'in_flight_limit' });
    reject(response, 503, 'service_busy', 'Okyo is busy. Please try again shortly.', 1);
    return;
  }

  inFlight += 1;
  metrics.setGauge('okyo_in_flight_requests', inFlight);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    inFlight -= 1;
    metrics.setGauge('okyo_in_flight_requests', inFlight);
  };
  response.once('finish', release);
  response.once('close', release);
  next();
}

export function operationalSecurityHeaders(_request: Request, response: Response, next: NextFunction): void {
  // Recipes, session-scoped results, and errors must not enter shared caches.
  response.setHeader('Cache-Control', 'no-store');
  response.removeHeader('X-Powered-By');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}

function reject(response: Response, status: number, code: string, message: string, retryAfterSeconds: number) {
  response.setHeader('Retry-After', String(retryAfterSeconds));
  logStructured('warn', 'http_request_rejected', { code, retry_after_seconds: retryAfterSeconds, status_code: status });
  response.status(status).json({ ok: false, error: { code, message } });
}

export function resetOperationalSafetyForTests() {
  draining = false;
  inFlight = 0;
}
