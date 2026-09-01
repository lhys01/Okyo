import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED,
  LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  LEGAL_DOCUMENTS_VERSION,
  getLegalDocument,
  legalDocuments,
  type LegalDocumentId,
} from './legalDocuments';

const repoRoot = resolve(process.cwd(), '../..');
const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const readRepo = (file: string) => readFileSync(resolve(repoRoot, file), 'utf8');

/** The counsel-review draft that pairs with each in-app document. */
const DRAFT_FILES: Record<LegalDocumentId, string> = {
  'privacy-policy': 'docs/legal/PRIVACY_POLICY.md',
  'terms-of-service': 'docs/legal/TERMS_OF_SERVICE.md',
  'subscription-terms': 'docs/legal/SUBSCRIPTION_TERMS.md',
  'refund-and-cancellation': 'docs/legal/REFUND_AND_CANCELLATION_POLICY.md',
  'ai-nutrition-recipe-disclaimer': 'docs/legal/AI_NUTRITION_AND_RECIPE_DISCLAIMER.md',
  'accessibility-statement': 'docs/legal/ACCESSIBILITY_STATEMENT.md',
  'regional-privacy': 'docs/legal/REGIONAL_PRIVACY_SUPPLEMENTS.md',
  'data-retention': 'docs/legal/DATA_RETENTION_SUMMARY.md',
  'security-overview': 'docs/legal/SECURITY_OVERVIEW.md',
  'vendors-and-subprocessors': 'docs/legal/VENDOR_AND_SUBPROCESSOR_LIST.md',
  'privacy-requests-and-deletion': 'docs/legal/PRIVACY_REQUESTS_AND_DELETION.md',
};

test('every legal document carries a version and an effective date', () => {
  assert.ok(legalDocuments.length >= 11, 'the required document set is incomplete');
  for (const document of legalDocuments) {
    assert.ok(document.version.length > 0, `${document.id} has no version`);
    assert.ok(document.effectiveDate.length > 0, `${document.id} has no effective date`);
    assert.equal(document.version, LEGAL_DOCUMENTS_VERSION);
    assert.equal(document.effectiveDate, LEGAL_DOCUMENTS_EFFECTIVE_DATE);
    assert.ok(document.sections.length >= 4, `${document.id} is too thin to be a real document`);
  }
});

test('the required public documents all exist in the app', () => {
  const required: LegalDocumentId[] = [
    'privacy-policy',
    'terms-of-service',
    'subscription-terms',
    'refund-and-cancellation',
    'ai-nutrition-recipe-disclaimer',
    'accessibility-statement',
    'regional-privacy',
    'data-retention',
    'security-overview',
    'vendors-and-subprocessors',
    'privacy-requests-and-deletion',
  ];
  for (const id of required) {
    assert.ok(getLegalDocument(id), `${id} is missing from the in-app registry`);
  }
});

test('each in-app document has a paired counsel-review draft at the same version', () => {
  for (const document of legalDocuments) {
    const file = DRAFT_FILES[document.id];
    assert.ok(existsSync(resolve(repoRoot, file)), `${file} is missing`);
    const draft = readRepo(file);
    assert.match(draft, /COUNSEL REVIEW REQUIRED/, `${file} must be marked as a counsel-review draft`);
    assert.ok(draft.includes(document.version), `${file} is not at document version ${document.version}`);
    assert.ok(draft.includes(document.effectiveDate), `${file} is not at the current effective date`);
  }
});

test('counsel-review markers stay internal — no user-facing text carries them', () => {
  for (const document of legalDocuments) {
    const text = [document.title, document.summary, ...document.sections.flatMap((s) => [s.heading, s.body])].join('\n');
    assert.doesNotMatch(text, /\[ACTION REQUIRED/, `${document.id} leaks an internal placeholder into user-facing text`);
    assert.doesNotMatch(text, /COUNSEL REVIEW|TODO|FIXME|Lorem ipsum/i, `${document.id} leaks an internal marker`);
  }
});

test('drafts remain drafts until counsel signs off, and the app says so', () => {
  assert.equal(LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED, false, 'flipping this is owner action K5, not a code change');
  assert.match(read('src/legal/LegalDocumentView.tsx'), /LEGAL_DOCUMENTS_ARE_COUNSEL_APPROVED \? null :/, 'the draft banner must be driven by the approval flag');
});

test('no document promises a protection Okyo has not implemented', () => {
  const everything = legalDocuments.flatMap((d) => d.sections.map((s) => s.body)).join('\n');
  const unsupportedClaims = [
    /end-to-end encrypted/i,
    /HIPAA compliant/i,
    /we are certified/i,
    /SOC ?2/i,
    /ISO ?27001/i,
    /independently audited/i,
    /all sales are final/i,
    /images are (?:never stored|deleted immediately)/i,
    /we never share (?:any )?data/i,
    /100% (?:secure|accurate)/i,
    /guarantee[sd]? (?:allergen|allergy)/i,
  ];
  for (const claim of unsupportedClaims) {
    assert.doesNotMatch(everything, claim, `a legal document makes an unsupported claim matching ${claim}`);
  }
});

test('the privacy policy does not assert an AI-provider retention period it cannot prove', () => {
  const policy = getLegalDocument('privacy-policy');
  const retention = policy?.sections.find((section) => section.heading.includes('How long the photo is kept'));
  assert.ok(retention, 'the policy must address photo retention');
  assert.match(retention!.body, /retention is set by that provider, not by Okyo/);
  assert.match(retention!.body, /will not claim a provider deletes your image immediately/);
});

test('the Terms contain no blanket worldwide arbitration clause', () => {
  const terms = getLegalDocument('terms-of-service');
  const body = terms!.sections.map((section) => section.body).join('\n');
  assert.doesNotMatch(body, /binding arbitration|waive .{0,30}class action|arbitration agreement/i);
  assert.match(body, /have not yet been settled/, 'governing law must remain an explicit open decision');
});

test('consumer rights that cannot be waived are preserved', () => {
  const refunds = getLegalDocument('refund-and-cancellation');
  const body = refunds!.sections.map((section) => section.body).join('\n');
  assert.match(body, /Australian Consumer Law/);
  assert.match(body, /14-day right to withdraw/);
  assert.match(body, /regardless of anything written here/);
});

test('service providers are distinguished from independent third parties', () => {
  const vendors = getLegalDocument('vendors-and-subprocessors');
  const body = vendors!.sections.map((section) => section.body).join('\n');
  assert.match(body, /service provider acting on Okyo’s instructions/, 'OpenRouter must be described as a processor');
  assert.match(body, /Apple is an independent party/, 'Apple must not be described as a service provider');
});

test('regional rights are explained without claiming every law applies to everyone', () => {
  const regional = getLegalDocument('regional-privacy');
  const body = regional!.sections.map((section) => section.body).join('\n');
  assert.match(body, /They do not all apply to everyone/);
  assert.match(body, /If you are in/, 'each regional section must be conditioned on where the reader lives');
});

test('the AI disclaimer states the savings rule that matches the product', () => {
  const disclaimer = getLegalDocument('ai-nutrition-recipe-disclaimer');
  const body = disclaimer!.sections.map((section) => section.body).join('\n');
  assert.match(body, /only becomes part of your recorded savings total when you mark that meal completed/);
  assert.match(body, /does not diagnose, treat, cure or prevent/);
  assert.match(body, /read the label on every ingredient/);
});

test('the accessibility statement does not claim conformance that has not been demonstrated', () => {
  const statement = getLegalDocument('accessibility-statement');
  const body = statement!.sections.map((section) => section.body).join('\n');
  assert.match(body, /That is the target, not a claim of completed conformance/);
  assert.match(body, /will not claim full WCAG 2\.2 AA conformance/);
});
