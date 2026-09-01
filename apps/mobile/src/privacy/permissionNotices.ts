/**
 * Just-in-time permission notices.
 *
 * Apple's Human Interface Guidelines and App Store Review Guideline 5.1.1
 * expect an app to explain *why* it needs access before the OS prompt appears.
 * Okyo also sends the selected photo to its own API and on to an AI provider,
 * which the OS permission string alone cannot convey — so the explanation has
 * to happen in-app, immediately before the system dialog.
 *
 * Every sentence below is checked against a real code path:
 *   - camera / photo capture .... `hooks/useStartPickedScan.ts`,
 *     `onboarding-v3/screens/ScanInputScreen.tsx`, `screens/WelcomeScreen.tsx`
 *   - copied into app storage ... `utils/scanImageStorage.ts` copies the photo
 *     into `<Documents>/okyo-scan-images/`
 *   - sent to the Okyo API ...... `api/client.ts` posts the image as a base64
 *     data URL to `/v1/scans/analyze`
 *   - sent to an AI provider .... `apps/api/src/services/openRouterProvider.ts`
 *     forwards it to OpenRouter, which routes to the configured model vendor
 *   - not stored by the API ..... `apps/api/src/server.ts` strips `dataUrl`
 *     before logging (`getResponseImageMetadata`, `getSafeValidationLogValue`)
 *     and no code path writes image bytes to disk; the image is held in memory
 *     for the request only
 *   - describe-a-dish fallback .. `screens/DescribeMealScreen.tsx` and the
 *     onboarding "Describe a dish" entry accept text instead of a photo
 *
 * Claims that CANNOT be proven from this repository — above all how long the AI
 * provider keeps an uploaded image — are deliberately absent rather than
 * guessed. See `docs/compliance/OKYO_COMPLIANCE_FACT_SHEET.md`.
 */

export type PermissionNoticeKind = 'camera' | 'photos' | 'notifications';

export type PermissionNotice = {
  /** Wording version, recorded in the consent ledger when a choice is made. */
  version: string;
  title: string;
  body: string;
  /** Button that proceeds to the OS prompt. */
  continueLabel: string;
  /** Equally available refusal. Never styled or worded as the lesser option. */
  cancelLabel: string;
};

export const PERMISSION_NOTICE_VERSION = '2026-08-24.1';

export const permissionNotices: Record<PermissionNoticeKind, PermissionNotice> = {
  camera: {
    version: PERMISSION_NOTICE_VERSION,
    title: 'Okyo needs your camera to scan a dish',
    body: [
      'You take one photo of a prepared dish. Okyo saves that photo on this device and sends it to the Okyo service, which passes it to an AI provider that identifies the dish and writes a recipe for it.',
      'The Okyo service holds the photo only for as long as the request takes. It is not written to Okyo servers or logs. How long the AI provider keeps it is set by that provider, not by Okyo.',
      'If you say no, scanning by photo will not work, but you can still describe a dish in words instead.',
    ].join('\n\n'),
    continueLabel: 'Continue',
    cancelLabel: 'Not now',
  },
  photos: {
    version: PERMISSION_NOTICE_VERSION,
    title: 'Okyo needs a photo to scan a dish',
    body: [
      'You choose one photo of a prepared dish. Okyo copies that photo into its own storage on this device and sends it to the Okyo service, which passes it to an AI provider that identifies the dish and writes a recipe for it.',
      'The Okyo service holds the photo only for as long as the request takes. It is not written to Okyo servers or logs. How long the AI provider keeps it is set by that provider, not by Okyo.',
      'If you say no, Okyo cannot read your library, but you can still describe a dish in words instead.',
    ].join('\n\n'),
    continueLabel: 'Continue',
    cancelLabel: 'Not now',
  },
  notifications: {
    version: PERMISSION_NOTICE_VERSION,
    title: 'Turn on Okyo notifications?',
    body: [
      'Okyo can send cooking timers and the reminders you switch on yourself. Reminders are scheduled on this device — no notification content is sent to a server.',
      'You choose which reminders you want on this screen, and you can turn them all off at any time.',
      'If you say no, everything else in Okyo keeps working exactly as it does now.',
    ].join('\n\n'),
    continueLabel: 'Continue',
    cancelLabel: 'Not now',
  },
};

export type PermissionStatusLike = { granted: boolean; status?: string; canAskAgain?: boolean };

/**
 * True only when the OS prompt has not yet been answered for this permission —
 * exactly the moment a just-in-time notice is useful. Once the user has granted
 * or denied, re-showing the notice would be nagging rather than informing, and
 * the OS will not present a second prompt for the notice to precede.
 */
export function shouldShowPermissionNotice(status: PermissionStatusLike | null | undefined): boolean {
  if (!status) return true;
  if (status.granted) return false;
  if (typeof status.status === 'string') return status.status === 'undetermined';
  return status.canAskAgain !== false;
}
