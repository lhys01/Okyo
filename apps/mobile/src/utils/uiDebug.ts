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
    console.log('[Okyo ImageTrace]', { screen, ...fields, ts: new Date().toISOString() });
  } catch {
    // swallow logging errors
  }
}
