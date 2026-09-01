import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { showcaseContent } from '../showcaseContent';
import { ApprovedArtworkPage } from './ApprovedArtworkPage';
import type { ShowcasePageProps } from './types';

export function CustomizePage(props: ShowcasePageProps) {
  return <ApprovedArtworkPage artwork={onboardingV3Assets.onboarding5CarouselArtwork} body={showcaseContent.customize.body} onBack={props.onBack} onNext={props.onNext} page={props.page} title={showcaseContent.customize.title} />;
}
