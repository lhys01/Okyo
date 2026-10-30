export type ClerkEnvironment = 'development' | 'production' | 'unknown';

export type ClerkErrorDiagnostics = {
  httpStatus: number | null;
  code: string;
  category: 'api_error' | 'client_error' | 'unknown';
  rejectedParameter?: string;
  requestId?: string;
};

export function classifyClerkPublishableKey(key: string): ClerkEnvironment {
  if (key.startsWith('pk_test_')) return 'development';
  if (key.startsWith('pk_live_')) return 'production';
  return 'unknown';
}

export function getSafeClerkErrorDiagnostics(error: unknown): ClerkErrorDiagnostics {
  const details = collectSafeErrorFields(error);
  const httpStatus = details.statuses.find((status) => status >= 400) ?? details.statuses[0] ?? null;
  const code = details.codes.find((candidate) => candidate !== 'api_response_error')
    ?? details.codes[0]
    ?? 'unknown';

  const diagnostics: ClerkErrorDiagnostics = {
    httpStatus,
    code,
    category: httpStatus !== null && httpStatus >= 400 ? 'api_error' : details.isRecord ? 'client_error' : 'unknown',
  };
  if (details.rejectedParameter) diagnostics.rejectedParameter = details.rejectedParameter;
  if (details.requestId) diagnostics.requestId = details.requestId;
  return diagnostics;
}

const SAFE_PARAMETER_NAMES = new Set(['strategy', 'token', 'first_name', 'last_name', 'unsafe_metadata']);

function collectSafeErrorFields(error: unknown): {
  codes: string[];
  statuses: number[];
  isRecord: boolean;
  rejectedParameter: string | null;
  requestId: string | null;
} {
  const codes: string[] = [];
  const statuses: number[] = [];
  const seen = new Set<object>();
  let rejectedParameter: string | null = null;
  let requestId: string | null = null;

  function visit(value: unknown, depth: number) {
    if (depth > 4 || !value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const child of value) visit(child, depth + 1);
      return;
    }

    const record = value as Record<string, unknown>;

    for (const [key, child] of Object.entries(record)) {
      if (key === 'code' || key === 'error_code') {
        if (typeof child === 'string' && /^[a-z0-9_.-]{1,80}$/i.test(child.trim())) {
          codes.push(child.trim());
        }
      } else if (key === 'status') {
        const status = readStatus(child);
        if (status !== null) statuses.push(status);
      } else if ((key === 'paramName' || key === 'param_name') && typeof child === 'string') {
        if (SAFE_PARAMETER_NAMES.has(child)) rejectedParameter = child;
      } else if ((key === 'clerkTraceId' || key === 'traceId' || key === 'trace_id') && typeof child === 'string') {
        if (/^[a-f0-9-]{16,64}$/i.test(child)) requestId = child;
      }

      if (depth < 4 && child && typeof child === 'object') visit(child, depth + 1);
    }
  }

  visit(error, 0);
  return {
    codes: [...new Set(codes)],
    statuses: [...new Set(statuses)],
    isRecord: asRecord(error) !== null,
    rejectedParameter,
    requestId,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readStatus(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599) return value;
  if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value);
  return null;
}
