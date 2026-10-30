/**
 * UI access gate for local onboarding experiment controls. This is a visibility
 * safeguard only; it does not authorize backend operations.
 */
export function isOnboardingExperimentAdmin(
  isSignedIn: boolean,
  accountEmail: string | null | undefined,
  allowedEmails = '',
): boolean {
  if (!isSignedIn || !accountEmail) return false;
  const email = accountEmail.trim().toLowerCase();
  if (!email) return false;
  const allowlist = new Set(allowedEmails.split(',').map((value: string) => value.trim().toLowerCase()).filter(Boolean));
  return allowlist.has(email);
}
