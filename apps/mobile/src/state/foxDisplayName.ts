/**
 * The one place that turns a possibly-unset mascot name into safe,
 * user-facing text. Never expose "undefined", "null", or a blank string —
 * fall back to the generic phrase instead.
 */
export function getFoxDisplayName(mascotName: string | null | undefined): string {
  const trimmed = (mascotName ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'your fox';
}

/** A sentence-leading version of the unnamed fallback. Saved names keep their casing. */
export function getFoxSubjectName(mascotName: string | null | undefined): string {
  return (mascotName ?? '').trim() || 'Your fox';
}
