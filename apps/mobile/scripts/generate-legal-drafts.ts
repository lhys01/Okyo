import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED,
  legalDocuments,
  type LegalDocument,
  type LegalDocumentId,
} from '../src/legal/legalDocuments';

const fileNames: Record<LegalDocumentId, string> = {
  'privacy-policy': 'PRIVACY_POLICY.md',
  'terms-of-service': 'TERMS_OF_SERVICE.md',
  'subscription-terms': 'SUBSCRIPTION_TERMS.md',
  'refund-and-cancellation': 'REFUND_AND_CANCELLATION_POLICY.md',
  'ai-nutrition-recipe-disclaimer': 'AI_NUTRITION_AND_RECIPE_DISCLAIMER.md',
  'accessibility-statement': 'ACCESSIBILITY_STATEMENT.md',
  'regional-privacy': 'REGIONAL_PRIVACY_SUPPLEMENTS.md',
  'data-retention': 'DATA_RETENTION_SUMMARY.md',
  'security-overview': 'SECURITY_OVERVIEW.md',
  'vendors-and-subprocessors': 'VENDOR_AND_SUBPROCESSOR_LIST.md',
  'privacy-requests-and-deletion': 'PRIVACY_REQUESTS_AND_DELETION.md',
};

const outputDirectory = resolve(process.cwd(), '../../docs/legal');
mkdirSync(outputDirectory, { recursive: true });

for (const document of legalDocuments) {
  writeFileSync(resolve(outputDirectory, fileNames[document.id]), renderDraft(document), 'utf8');
}

function renderDraft(document: LegalDocument): string {
  const sections = document.sections
    .map((section) => `## ${section.heading}\n\n${section.body}`)
    .join('\n\n');

  return [
    `# ${document.title}`,
    '',
    '> COUNSEL REVIEW REQUIRED — internal draft only. This document is generated from the current in-app draft so counsel can review identical text. It is not a published policy or proof of approval.',
    '',
    `- Version: ${document.version}`,
    `- Effective date: ${document.effectiveDate}`,
    `- Counsel approved: ${LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED}`,
    '',
    document.summary,
    '',
    sections,
    '',
  ].join('\n');
}
