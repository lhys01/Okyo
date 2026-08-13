import { useEffect, useState } from 'react';

import { onboardingV3Persistence } from '../onboarding-v3/state/onboardingV3Persistence';
import { DEFAULT_MASCOT_NAME } from '../onboarding-v3/state/mascotName';

export function useMascotName(): string {
  const [mascotName, setMascotName] = useState(DEFAULT_MASCOT_NAME);

  useEffect(() => {
    let mounted = true;
    onboardingV3Persistence.readMascotName()
      .then((value) => { if (mounted) setMascotName(value); })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  return mascotName;
}
