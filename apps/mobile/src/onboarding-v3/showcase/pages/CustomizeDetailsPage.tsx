import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { ShowcasePageFrame, ShowcasePageShell } from './ShowcasePageShell';
import type { ShowcasePageProps } from './types';

export function CustomizeDetailsPage({ page, onBack, onNext }: ShowcasePageProps) {
  return (
    <ShowcasePageShell onBack={onBack} onNext={onNext} page={page}>
      <ShowcasePageFrame artwork={onboardingV3Assets.onboarding4CarouselArtwork} body="See nutrition, cooking time, and what making the dish at home could cost." title="More than just a recipe" />
    </ShowcasePageShell>
  );
}
