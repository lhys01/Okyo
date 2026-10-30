/** Copy helpers for the non-question onboarding payoff screens. */

const MAX_COMPACT_NAME_LENGTH = 24;

/**
 * Keep user-entered names readable in centered onboarding headlines. Names
 * longer than a short headline use their first word when it is a natural
 * nickname; otherwise the generic copy is safer than a clipped headline.
 */
export function getOnboardingNameForCopy(name: string | null | undefined): string | null {
  const normalized = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!normalized) return null;
  if (normalized.length <= MAX_COMPACT_NAME_LENGTH) return normalized;
  const firstWord = normalized.split(' ')[0];
  return firstWord && firstWord.length <= MAX_COMPACT_NAME_LENGTH ? firstWord : null;
}

export function savingsRevealCopy(name: string | null | undefined): string {
  const displayName = getOnboardingNameForCopy(name);
  return displayName
    ? `${displayName}, that’s roughly what takeout adds up to in a year.`
    : 'That’s roughly what takeout adds up to in a year.';
}

export function savingsInsightCopy(name: string | null | undefined, insight: string): string {
  const displayName = getOnboardingNameForCopy(name);
  return displayName ? `${displayName}, ${insight}` : insight;
}

export function savingsFutureCopy(name: string | null | undefined): string {
  const displayName = getOnboardingNameForCopy(name);
  return displayName
    ? `${displayName}, one home meal a week can change the picture.`
    : 'One home meal a week can change the picture.';
}

export function planReadyCopy(name: string | null | undefined): string {
  const displayName = getOnboardingNameForCopy(name);
  return displayName ? `${displayName}, your Okyo plan is ready.` : 'Your Okyo plan is ready.';
}

