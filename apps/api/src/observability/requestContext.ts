import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Per-request correlation context. The mobile client sends `x-okyo-request-id`
 * and `x-okyo-anon-id`; this middleware makes them available to any code in the
 * request (AI provider, analytics, error handler) without threading params
 * through every layer. `requestId` doubles as the trace id — there is no
 * separate tracing system yet.
 */

export type OkyoRequestContext = {
  requestId: string;
  anonId: string | null;
  /** Server-derived guest scope; never taken from the caller's anon ID header. */
  ownerKey?: string;
  /** Present only while an expensive request is active. */
  abortSignal?: AbortSignal;
  /** Absolute request deadline, set by the route wrapper. */
  deadlineAt?: number;
};

const storage = new AsyncLocalStorage<OkyoRequestContext>();

function headerValue(raw: string | string[] | undefined): string | null {
  if (Array.isArray(raw)) return raw[0]?.trim() || null;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

function isSafeExternalId(value: string | null): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{8,128}$/.test(value));
}

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction): void {
  const suppliedRequestId = headerValue(request.headers['x-okyo-request-id']);
  const suppliedAnonId = headerValue(request.headers['x-okyo-anon-id']);
  const requestId = isSafeExternalId(suppliedRequestId) ? suppliedRequestId : randomUUID();
  const anonId = isSafeExternalId(suppliedAnonId) ? suppliedAnonId : null;
  const clientIp = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
  response.setHeader('x-okyo-request-id', requestId);
  storage.run({ requestId, anonId, ownerKey: `guest:${clientIp}` }, () => next());
}

export function getRequestContext(): OkyoRequestContext | undefined {
  return storage.getStore();
}

/** Test helper: run a function inside a synthetic context. */
export function runWithRequestContext<T>(context: OkyoRequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * Associates a client-disconnect/deadline signal with the current request.
 * AsyncLocalStorage keeps it available to nested provider calls without making
 * every existing service signature carry a Request/Response object.
 */
export function runWithRequestControl<T>(
  control: { abortSignal: AbortSignal; deadlineAt: number },
  fn: () => T,
): T {
  const current = getRequestContext();
  return storage.run({
    requestId: current?.requestId ?? randomUUID(),
    anonId: current?.anonId ?? null,
    ownerKey: current?.ownerKey,
    ...control,
  }, fn);
}

export function getRequestAbortSignal(): AbortSignal | undefined {
  return storage.getStore()?.abortSignal;
}

export function getRequestRemainingMs(now = Date.now()): number | undefined {
  const deadlineAt = storage.getStore()?.deadlineAt;
  return deadlineAt === undefined ? undefined : Math.max(0, deadlineAt - now);
}
