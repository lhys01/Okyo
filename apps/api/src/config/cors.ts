const developmentOrigins = new Set(['http://localhost:19006', 'http://localhost:8081']);

/**
 * Native clients do not send an Origin header. Browser requests are admitted
 * only from exact configured origins in production, so a missing production
 * allowlist fails closed without blocking the native app.
 */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const configuredOrigins = readConfiguredOrigins();
  if (configuredOrigins.has(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && developmentOrigins.has(origin)) return true;
  return process.env.NODE_ENV !== 'production' && configuredOrigins.size === 0;
}

export function readConfiguredOrigins(value = process.env.CORS_ALLOWED_ORIGINS): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(isExactHttpOrigin),
  );
}

function isExactHttpOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && ['http:', 'https:'].includes(parsed.protocol) &&
      !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
