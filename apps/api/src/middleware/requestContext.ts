import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

import { logScanMetric } from '../telemetry/scanTelemetry.js';

const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

export function normalizeRequestId(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && requestIdPattern.test(trimmed) ? trimmed : randomUUID();
}

export function requestContextMiddleware(): RequestHandler {
  return (request, response, next) => {
    const startedAt = Date.now();
    const requestId = normalizeRequestId(request.get('x-okyo-request-id'));
    request.scanContext = Object.freeze({ requestId, ingressStartedAt: startedAt });
    response.setHeader('x-okyo-request-id', requestId);

    response.once('finish', () => {
      if (request.path === '/v1/scans') {
        logScanMetric({
          requestId,
          stage: 'api_total',
          durationMs: Date.now() - startedAt,
          status: response.statusCode >= 400 ? 'failure' : 'success',
          details: { httpStatus: response.statusCode },
        });
      }
    });
    next();
  };
}
