let lastLogKey: string | null = null;
let lastLogTime = 0;
const shouldLogUiDebug = false;

function makeKey(screen: string, action: string, props?: unknown) {
  try {
    return `${screen}|${action}|${JSON.stringify(props ?? {})}`;
  } catch {
    return `${screen}|${action}`;
  }
}

export function uiLog(screen: string, action: string, props?: unknown) {
  try {
    if (!shouldLogUiDebug) {
      return;
    }

    const key = makeKey(screen, action, props);
    const now = Date.now();
    // dedupe identical messages for 1.5s to avoid noisy repeated render logs
    if (key === lastLogKey && now - lastLogTime < 1500) {
      return;
    }
    lastLogKey = key;
    lastLogTime = now;
    // keep logs compact and structured
    // eslint-disable-next-line no-console
    console.log('[Okyo UI]', { screen, action, props, ts: new Date().toISOString() });
  } catch {
    // swallow logging errors
  }
}

// Always active in __DEV__. Used specifically for image ownership and persistence
// tracing — separate from the general uiLog which is gated by shouldLogUiDebug.
export function imageTraceLog(screen: string, fields: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }
  try {
    // eslint-disable-next-line no-console
    console.log('[Okyo ImageTrace]', { screen, ...sanitizeImageTraceFields(fields), ts: new Date().toISOString() });
  } catch {
    // swallow logging errors
  }
}

const SAFE_SCAN_TRACE_STRING_FIELDS = new Set(['event', 'requestId', 'source', 'stage', 'status', 'failureCode']);
const SAFE_SCAN_TRACE_BOOLEAN_FIELDS = new Set(['hasScan', 'hasRecipe', 'hasSelectedRecipe', 'committed', 'routeSessionMatches']);

/** Dev-only scan diagnostics. Values are allow-listed so content, tokens, and local paths never reach logs. */
export function scanTraceLog(event: string, fields: Record<string, unknown> = {}) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const safe: Record<string, string | number | boolean> = {};
  if (/^[a-z0-9_.-]{1,64}$/i.test(event)) safe.event = event;
  for (const key of SAFE_SCAN_TRACE_STRING_FIELDS) {
    if (key === 'event') continue;
    const value = fields[key];
    if (typeof value === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(value)) safe[key] = value;
  }
  for (const key of SAFE_SCAN_TRACE_BOOLEAN_FIELDS) {
    if (typeof fields[key] === 'boolean') safe[key] = fields[key] as boolean;
  }
  for (const key of ['httpStatus', 'elapsedMs', 'recipesLength']) {
    const value = fields[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) safe[key] = Math.round(value);
  }
  // eslint-disable-next-line no-console
  console.log('[Okyo ScanTrace]', safe);
}

const SAFE_IMAGE_TRACE_BOOLEAN_FIELDS = new Set([
  'exists',
  'fileExists',
  'usingFallback',
  'selectedScanImagePlaceholder',
]);

/** Allow-list image diagnostics so URIs, filenames, IDs, and error text stay local. */
export function sanitizeImageTraceFields(fields: Record<string, unknown>): Record<string, string | boolean> {
  const safe: Record<string, string | boolean> = {};
  for (const key of SAFE_IMAGE_TRACE_BOOLEAN_FIELDS) {
    if (typeof fields[key] === 'boolean') safe[key] = fields[key] as boolean;
  }
  if (typeof fields.stage === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(fields.stage)) safe.stage = fields.stage;
  if (fields.source === 'camera' || fields.source === 'photos' || fields.source === 'description') safe.source = fields.source;
  if (fields.selectedScanImageSource === 'camera' || fields.selectedScanImageSource === 'photos' || fields.selectedScanImageSource === 'description') {
    safe.selectedScanImageSource = fields.selectedScanImageSource;
  }
  if (fields.storageLocation === 'documents' || fields.storageLocation === 'cache' || fields.storageLocation === 'remote' || fields.storageLocation === 'unknown' || fields.storageLocation === 'n/a') {
    safe.storageLocation = fields.storageLocation;
  }
  if (typeof fields.fallbackReason === 'string' && /^[a-z0-9_]{1,64}$/i.test(fields.fallbackReason)) safe.fallbackReason = fields.fallbackReason;
  return safe;
}
