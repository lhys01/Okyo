import type { ReactNode } from 'react';

import { OnboardingBackButton } from '../../components/OnboardingBackButton';
import { OnboardingCTA } from '../../components/OnboardingCTA';
import { PageScaffold } from '../../components/PageScaffold';

export function ShowcasePageShell({
  children,
  page,
  onNext,
  onBack,
  ctaLabel = 'Next',
}: {
  children: ReactNode;
  page: number;
  onNext: () => void;
  onBack: () => void;
  ctaLabel?: string;
}) {
  return (
    <PageScaffold
      footer={<OnboardingCTA label={ctaLabel} onPress={onNext} />}
      header={<OnboardingBackButton hidden={page === 0} onPress={onBack} />}
    >
      {children}
    </PageScaffold>
  );
}
