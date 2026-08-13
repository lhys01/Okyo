export const DEFAULT_MASCOT_NAME = 'Kiko';
export const MASCOT_NAME_MAX_LENGTH = 20;

/** Trim; fall back to Kiko when blank; hard-cap length. */
export function sanitizeMascotName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length === 0) return DEFAULT_MASCOT_NAME;
  return trimmed.slice(0, MASCOT_NAME_MAX_LENGTH);
}
