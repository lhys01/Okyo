import { uuidV4 } from './uuid';

/**
 * In-memory analytics session. A session id groups events between a cold start
 * (or a return from a long background) and the next such boundary. Nothing is
 * persisted — a fresh process always starts a fresh session.
 */

const BACKGROUND_RESET_MS = 30 * 60 * 1000;

let sessionId = uuidV4();
let sessionStartedAt = Date.now();
let backgroundedAt: number | null = null;

export function getSessionId(): string {
  return sessionId;
}

export function getSessionElapsedMs(): number {
  return Date.now() - sessionStartedAt;
}

function startNewSession(): void {
  sessionId = uuidV4();
  sessionStartedAt = Date.now();
}

/** Call when the app goes to background. */
export function noteBackgrounded(now: number = Date.now()): void {
  backgroundedAt = now;
}

/**
 * Call when the app returns to foreground. Starts a new session when the app
 * was backgrounded longer than BACKGROUND_RESET_MS. Returns true when a new
 * session was started.
 */
export function noteForegrounded(now: number = Date.now()): boolean {
  const wasBackgroundedLong = backgroundedAt !== null && now - backgroundedAt >= BACKGROUND_RESET_MS;
  backgroundedAt = null;
  if (wasBackgroundedLong) {
    startNewSession();
    return true;
  }
  return false;
}

/** Test-only. */
export function resetSession(): void {
  startNewSession();
  backgroundedAt = null;
}

export const resetSessionForTests = resetSession;
