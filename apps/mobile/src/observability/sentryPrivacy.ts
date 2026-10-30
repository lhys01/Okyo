type CrashEvent = {
  type?: undefined;
  event_id?: string; timestamp?: number; platform?: string; release?: string; dist?: string; environment?: string;
  exception?: {values?: Array<{type?: string; value?: string; stacktrace?: {frames?: Array<{filename?: string; function?: string; lineno?: number; colno?: number; in_app?: boolean}>}}>} ;
};
const label = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_.@+:/-]{1,160}$/.test(value) ? value : undefined;
/** Rebuild the event from permitted fields; never try to redact arbitrary text. */
export function sanitizeCrashEvent(event: CrashEvent): CrashEvent & { type: undefined } {
  return {
    type: undefined, event_id: label(event.event_id), timestamp: event.timestamp, platform: label(event.platform),
    release: label(event.release), dist: label(event.dist), environment: label(event.environment),
    exception: { values: event.exception?.values?.slice(0,5).map(exception => ({
      type: ['Error','TypeError','RangeError','ReferenceError','SyntaxError'].includes(exception.type ?? '') ? exception.type : 'Error',
      value: 'Application error (private message removed)',
      stacktrace: {frames: exception.stacktrace?.frames?.slice(-60).map(frame => ({
        filename: frame.filename ? `app:///${frame.filename.split(/[/?#]/).filter(Boolean).reverse().find(part=>/^[A-Za-z0-9_.-]+\.(js|jsbundle|bundle|tsx?|m|swift)$/.test(part)) ?? 'bundle.js'}` : undefined,
        function: label(frame.function), lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app,
      }))},
    })) },
  };
}
