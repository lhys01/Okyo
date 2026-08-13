import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { ApprovedArtworkPage } from './ApprovedArtworkPage';
import type { ShowcasePageProps } from './types';

export function ScanPage(props: ShowcasePageProps) {
  return <ApprovedArtworkPage artwork={onboardingV3Assets.approvedOnboarding3} onBack={props.onBack} onNext={props.onNext} />;
}
