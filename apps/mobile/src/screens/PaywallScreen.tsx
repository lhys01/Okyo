import { useEffect, useRef } from 'react';

import { analyticsEvents, track } from '../analytics/track';
import { ScreenScaffold } from '../components/ScreenScaffold';

export function PaywallScreen() {
  const didTrackView = useRef(false);

  useEffect(() => {
    if (didTrackView.current) {
      return;
    }

    didTrackView.current = true;
    track(analyticsEvents.PAYWALL_VIEWED, { screen: 'PaywallScreen' });
  }, []);

  return (
    <ScreenScaffold
      title="Save money every time you eat out."
      body="Placeholder paywall screen. Payments are not connected."
    />
  );
}
