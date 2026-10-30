/**
 * The tour's typewriter is intentionally brief.  It is frame-driven instead
 * of one timeout per character so it stays quick under a busy JS thread.
 */
export const TOUR_TYPEWRITER_MIN_MS = 150;
export const TOUR_TYPEWRITER_MAX_MS = 320;
const TOUR_TYPEWRITER_MS_PER_CHARACTER = 7;

export function getTourTypewriterDuration(message: string): number {
  return Math.max(
    TOUR_TYPEWRITER_MIN_MS,
    Math.min(TOUR_TYPEWRITER_MAX_MS, message.length * TOUR_TYPEWRITER_MS_PER_CHARACTER),
  );
}

export function getRevealedCharacterCount(message: string, elapsedMs: number, reduceMotion = false): number {
  if (reduceMotion) return message.length;
  const duration = getTourTypewriterDuration(message);
  return Math.min(message.length, Math.max(0, Math.ceil((Math.max(0, elapsedMs) / duration) * message.length)));
}

export function completeTourTypewriter(message: string): string {
  return message;
}
