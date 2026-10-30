import type { NextFunction, Request, Response } from 'express';

import { metrics, recordHttpRequest } from '../observability/metrics.js';
import { logStructured } from '../observability/structuredLogger.js';

export function requestLifecycleMiddleware(request: Request, response: Response, next: NextFunction): void {
  const startedAt = performance.now();
  let recorded = false;
  metrics.increment('okyo_http_requests_started_total', { route: getRouteLabel(request) });

  const record = (completion: 'finished' | 'aborted') => {
    if (recorded) return;
    recorded = true;
    const durationMs = Math.max(0, performance.now() - startedAt);
    const route = getRouteLabel(request);
    const statusCode = completion === 'aborted' ? 499 : response.statusCode;
    recordHttpRequest(route, statusCode, durationMs);
    if (completion === 'aborted') metrics.increment('okyo_http_request_aborted_total', { route });
    logStructured(statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info', 'http_request_completed', {
      duration_ms: Math.round(durationMs),
      method: request.method,
      route,
      status_code: statusCode,
      completion,
    });
  };

  response.once('finish', () => record('finished'));
  response.once('close', () => {
    if (!response.writableEnded) record('aborted');
  });
  next();
}

function getRouteLabel(request: Request): string {
  // Keep cardinality bounded before Express resolves a route template.
  const path = request.path;
  if (/^\/v1\/scans\/analyze\/[^/]+\/recipe$/.test(path)) return '/v1/scans/analyze/:analysisId/recipe';
  if (/^\/v1\/scans\/[^/]+$/.test(path)) return '/v1/scans/:scanId';
  if (/^\/v1\/recipes\/[^/]+\/(?:save|coaching|ask|correct)$/.test(path)) return '/v1/recipes/:recipeId/:action';
  if (/^\/v1\/recipes\/[^/]+$/.test(path)) return '/v1/recipes/:recipeId';
  if (/^\/v1\/restaurant-packs\/[^/]+$/.test(path)) return '/v1/restaurant-packs/:packId';
  return path.length <= 120 ? path : '/unknown';
}
