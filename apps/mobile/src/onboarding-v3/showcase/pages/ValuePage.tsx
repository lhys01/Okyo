import { onboardingV3Assets } from '../../assets/onboardingV3Assets';
import { showcaseContent } from '../showcaseContent';
import { ShowcasePageFrame, ShowcasePageShell } from './ShowcasePageShell';
import type { ShowcasePageProps } from './types';

export function ValuePage(props: ShowcasePageProps) {
  return (
    <ShowcasePageShell {...props}>
      <ShowcasePageFrame artwork={onboardingV3Assets.approvedSalmonRecipeValueArtwork} body={showcaseContent.value.fact} title={showcaseContent.value.title} />
    </ShowcasePageShell>
  );
}
