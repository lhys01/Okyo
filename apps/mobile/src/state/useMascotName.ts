import { useEffect, useState } from 'react';

import { onboardingV3Persistence, subscribeToMascotName } from '../onboarding-v3/state/onboardingV3Persistence';
import { getFoxDisplayName } from './foxDisplayName';

export function useMascotName(): string {
  return getFoxDisplayName(useChosenMascotName());
}

/** Returns only a name the user saved, leaving unnamed states to a caller-provided fallback. */
export function useChosenMascotName(): string | null {
  const [mascotName, setMascotName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let readVersion = 0;
    const refresh = () => {
      const version = ++readVersion;
      void onboardingV3Persistence.readChosenMascotName()
        .then((value) => { if (mounted && version === readVersion) setMascotName(value); })
        .catch(() => undefined);
    };
    const unsubscribe = subscribeToMascotName(refresh);
    refresh();
    return () => { mounted = false; unsubscribe(); };
  }, []);

  return mascotName;
}
