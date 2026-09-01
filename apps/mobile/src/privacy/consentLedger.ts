import AsyncStorage from '@react-native-async-storage/async-storage';

import { PERMISSION_NOTICE_VERSION, type PermissionNoticeKind } from './permissionNotices';

/**
 * Local consent ledger.
 *
 * Records only choices Okyo actually asks the user to make. As of this build
 * that is the three device permissions in `permissionNotices.ts` and nothing
 * else — Okyo ships no analytics SDK, no advertising SDK, no tracking, and no
 * ATT prompt (see `analytics/track.ts`, where `shouldLogAnalytics` is `false`
 * and no event is ever transmitted). No blanket "I agree" consent screen is
 * implemented, because there is no optional processing that would need one.
 * If an analytics or advertising SDK is ever added, its purpose belongs here
 * as a separate entry with its own notice version — never folded into these.
 *
 * The ledger lives on the device only. There is no Okyo account and no server
 * copy, so `state/dietaryDeletion.ts` clears it along with everything else:
 * keeping a record of choices after the user asked Okyo to forget them would
 * contradict the deletion promise.
 */
export const CONSENT_LEDGER_STORAGE_KEY = 'okyo:consent-ledger:v1';

/** Distinct purposes. One entry per purpose — never a bundled "accept all". */
export type ConsentPurpose = PermissionNoticeKind;

export type ConsentChoice = 'granted' | 'refused' | 'withdrawn';

export type ConsentRecord = {
  purpose: ConsentPurpose;
  choice: ConsentChoice;
  /** Version of the notice text the user actually saw. */
  noticeVersion: string;
  /** ISO 8601 UTC. */
  recordedAt: string;
  /**
   * Rule set applied, when the app can honestly say. Okyo does not perform IP
   * geolocation or ask for a country, so this stays 'unknown' until an owner
   * decision adds a lawful way to determine it.
   */
  jurisdiction: 'unknown';
};

const MAX_LEDGER_ENTRIES = 200;

type LedgerStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

function isConsentRecord(value: unknown): value is ConsentRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<ConsentRecord>;
  return (record.purpose === 'camera' || record.purpose === 'photos' || record.purpose === 'notifications')
    && (record.choice === 'granted' || record.choice === 'refused' || record.choice === 'withdrawn')
    && typeof record.noticeVersion === 'string'
    && typeof record.recordedAt === 'string';
}

export async function readConsentLedger(storage: LedgerStorage = AsyncStorage): Promise<ConsentRecord[]> {
  try {
    const raw = await storage.getItem(CONSENT_LEDGER_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isConsentRecord) : [];
  } catch {
    return [];
  }
}

/**
 * Appends one choice. Appends rather than overwrites so a later withdrawal or a
 * renewed choice after a notice-version change stays visible next to the
 * original — that history is the point of a ledger.
 *
 * Never throws: a storage failure must not block the user from answering a
 * permission prompt.
 */
export async function recordConsent(
  purpose: ConsentPurpose,
  choice: ConsentChoice,
  options: { noticeVersion?: string; now?: () => Date; storage?: LedgerStorage } = {},
): Promise<ConsentRecord[]> {
  const storage = options.storage ?? AsyncStorage;
  const now = options.now ?? (() => new Date());
  const entry: ConsentRecord = {
    purpose,
    choice,
    noticeVersion: options.noticeVersion ?? PERMISSION_NOTICE_VERSION,
    recordedAt: now().toISOString(),
    jurisdiction: 'unknown',
  };
  const existing = await readConsentLedger(storage);
  const next = [...existing, entry].slice(-MAX_LEDGER_ENTRIES);
  try {
    await storage.setItem(CONSENT_LEDGER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A ledger write failure must never block the user's actual choice.
  }
  return next;
}

/** The most recent recorded choice for a purpose, or null if never asked. */
export function getLatestConsent(ledger: readonly ConsentRecord[], purpose: ConsentPurpose): ConsentRecord | null {
  for (let index = ledger.length - 1; index >= 0; index -= 1) {
    const record = ledger[index];
    if (record && record.purpose === purpose) return record;
  }
  return null;
}

/**
 * No consent is ever assumed. An unasked purpose reads as refused, so any
 * caller gating on this defaults to the privacy-preserving outcome.
 */
export function hasGrantedConsent(ledger: readonly ConsentRecord[], purpose: ConsentPurpose): boolean {
  return getLatestConsent(ledger, purpose)?.choice === 'granted';
}
