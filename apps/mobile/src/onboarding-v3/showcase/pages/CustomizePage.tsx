import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { ApprovedArtworkPage } from './ApprovedArtworkPage';
import type { ShowcasePageProps } from './types';

export function CustomizePage(props: ShowcasePageProps) {
  return <ApprovedArtworkPage artwork={onboardingV3Assets.approvedOnboarding5} onBack={props.onBack} onNext={props.onNext} />;
}
