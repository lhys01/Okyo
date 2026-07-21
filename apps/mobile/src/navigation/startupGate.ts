export type OnboardingStartupStatus = 'loading' | 'onboardingRequired' | 'onboardingComplete';
export type StartupRoute = 'WelcomeScreen' | 'MainTabs' | null;

export function getOnboardingStartupStatus(completed: boolean | null): OnboardingStartupStatus {
  if (completed === null) {
    return 'loading';
  }

  return completed ? 'onboardingComplete' : 'onboardingRequired';
}

export function getStartupRoute(status: OnboardingStartupStatus): StartupRoute {
  if (status === 'loading') {
    return null;
  }

  return status === 'onboardingComplete' ? 'MainTabs' : 'WelcomeScreen';
}
