/**
 * Existing screen call sites pass camelCase property keys (dishName, xpAmount,
 * errorMessage, …). PostHog and the analytics allow-list use snake_case. This
 * converts keys to snake_case so old call sites keep working unchanged while
 * the taxonomy stays consistent. Values are untouched.
 */

function toSnakeCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

export function toSnakeCaseProperties(
  input: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[toSnakeCase(key)] = value;
  }
  return out;
}
