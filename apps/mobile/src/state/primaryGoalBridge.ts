import { unwrapPersistedPersonalizedProfile } from '../onboarding-v3/state/onboardingV3Persistence';
import { normalizePersonalizedProfile, type PrimaryGoal } from '../onboarding-v3/state/personalizedOnboarding';

export type PrimaryGoalStorage = { getItem: (key: string) => Promise<string | null> };
export const PRIMARY_GOAL_PROFILE_KEY = 'okyo:personalized-onboarding-profile:v1';

export type PersonalizedHomeProfile = { name: string | null; primaryGoal: PrimaryGoal };

export async function readPersonalizedHomeProfile(storage: PrimaryGoalStorage): Promise<PersonalizedHomeProfile | null> {
  const raw = await storage.getItem(PRIMARY_GOAL_PROFILE_KEY);
  if (!raw) return null;
  try {
    const profile = normalizePersonalizedProfile(unwrapPersistedPersonalizedProfile(JSON.parse(raw)));
    if (!profile.primaryGoal) return null;
    return { name: profile.name.trim() || null, primaryGoal: profile.primaryGoal };
  } catch {
    return null;
  }
}

export async function readPrimaryGoalFromProfile(storage: PrimaryGoalStorage): Promise<PrimaryGoal | null> {
  return (await readPersonalizedHomeProfile(storage))?.primaryGoal ?? null;
}
