import { getRequestContext } from './requestContext.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Small JSON logger with a deliberately narrow field surface. It gives a log
 * aggregator useful correlation fields without accepting request bodies, auth
 * headers, images, or arbitrary Error objects by accident.
 */
export function logStructured(
  level: LogLevel,
  event: string,
  fields: Record<string, boolean | number | string | null | undefined> = {},
): void {
  const context = getRequestContext();
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId: context?.requestId,
    ...omitUndefined(fields),
  };
  const serialized = JSON.stringify(entry);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
}

function omitUndefined(values: Record<string, boolean | number | string | null | undefined>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}
