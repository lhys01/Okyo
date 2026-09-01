import { ShowcasePageFrame, ShowcasePageShell } from './ShowcasePageShell';

export function ApprovedArtworkPage({ artwork, body = '', onBack, onNext, page = 0, title = '' }: {
  artwork: number;
  body?: string;
  onBack: () => void;
  onNext: () => void;
  page?: number;
  title?: string;
}) {
  return (
    <ShowcasePageShell onBack={onBack} onNext={onNext} page={page}>
      <ShowcasePageFrame artwork={artwork} body={body} title={title} />
    </ShowcasePageShell>
  );
}
