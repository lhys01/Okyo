import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

function useAccessibilityFlag(
  isEnabledAsync: () => Promise<boolean>,
  changeEventName: 'reduceMotionChanged' | 'reduceTransparencyChanged',
): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    isEnabledAsync()
      .then((value) => {
        if (isMounted) setIsEnabled(value);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(changeEventName, setIsEnabled);

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [isEnabledAsync, changeEventName]);

  return isEnabled;
}

export function useReduceMotion(): boolean {
  return useAccessibilityFlag(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged');
}

export function useReduceTransparency(): boolean {
  return useAccessibilityFlag(
    AccessibilityInfo.isReduceTransparencyEnabled,
    'reduceTransparencyChanged',
  );
}

