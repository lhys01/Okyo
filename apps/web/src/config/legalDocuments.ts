import privacyMarkdown from '../legal-drafts/privacy.md?raw';
import termsMarkdown from '../legal-drafts/terms.md?raw';

export type WebLegalSection = { heading: string; body: string };
export type WebLegalDocument = {
  title: string;
  summary: string;
  version: string;
  effectiveDate: string;
  sections: WebLegalSection[];
};

function parseDocument(markdown: string): WebLegalDocument {
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  const title = frontmatter?.[1].match(/^title: "(.+)"$/m)?.[1] ?? 'Okyo';
  const version = frontmatter?.[1].match(/^version: "(.+)"$/m)?.[1] ?? '1.0.0';
  const body = markdown
    .slice(frontmatter?.[0].length ?? 0)
    .split('\n')
    .filter((line) => !line.startsWith('<!--') && !line.startsWith('> COUNSEL REVIEW REQUIRED') && !line.startsWith('- Version:') && !line.startsWith('- Effective date:') && !line.startsWith('- Counsel approved:') && line.trim() !== '---')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const effectiveDate = markdown.match(/^- Effective date: (.+)$/m)?.[1] ?? '';
  const summary = body.split('\n').find((line) => line.trim() && !line.startsWith('#'))?.trim() ?? '';
  const sections: WebLegalSection[] = [];
  let current: WebLegalSection | undefined;
  for (const line of body.split('\n')) {
    const heading = line.match(/^#{2,6} (.+)$/)?.[1]?.trim();
    if (heading) {
      current = { heading, body: '' };
      sections.push(current);
    } else if (current && line.trim()) {
      current.body = current.body ? `${current.body}\n\n${line.trim()}` : line.trim();
    }
  }
  return { title, summary, version, effectiveDate, sections };
}

export const privacyPolicy = parseDocument(privacyMarkdown);
export const termsOfService = parseDocument(termsMarkdown);
