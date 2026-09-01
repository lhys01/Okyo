import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { showcaseContent } from '../showcaseContent';
import { ApprovedArtworkPage } from './ApprovedArtworkPage';
import type { ShowcasePageProps } from './types';

export function ScanPage(props: ShowcasePageProps) {
  return <ApprovedArtworkPage artwork={onboardingV3Assets.onboarding3CarouselArtwork} body={showcaseContent.scan.body} onBack={props.onBack} onNext={props.onNext} page={props.page} title={showcaseContent.scan.title} />;
}
