const DEDUPE_WINDOW_MS = 1_500;
const MAX_DEDUPE_ENTRIES = 100;
const recentEvents = new Map<string, number>();

/** Suppresses identical events across remounts, Strict Mode, navigation and retries. */
export function acceptAnalyticsEvent(
  event: string,
  properties: Record<string, unknown>,
  now: number,
  windowMs = DEDUPE_WINDOW_MS,
): boolean {
  const key = `${event}:${JSON.stringify(Object.fromEntries(Object.entries(properties).sort(([a], [b]) => a.localeCompare(b))))}`;
  const previous = recentEvents.get(key);
  if (previous !== undefined && now - previous < windowMs) return false;
  recentEvents.delete(key);
  recentEvents.set(key, now);
  for (const [storedKey, createdAt] of recentEvents) {
    if (now - createdAt >= windowMs || recentEvents.size > MAX_DEDUPE_ENTRIES) recentEvents.delete(storedKey);
  }
  return true;
}

export function resetEventDedupeForTests(): void {
  recentEvents.clear();
}
