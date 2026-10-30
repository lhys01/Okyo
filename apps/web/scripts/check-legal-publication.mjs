import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = await readFile(new URL('../../mobile/src/legal/legalDocuments.ts', import.meta.url));
const review = JSON.parse(await readFile(new URL('../../mobile/legal-release-review.json', import.meta.url), 'utf8'));
if (review.status !== 'approved' || review.sourceSha256 !== createHash('sha256').update(source).digest('hex')) {
  console.error('Legal publication blocked: the owner/legal review of this exact prepared text is pending.');
  process.exitCode = 1;
} else {
  console.log('The current prepared legal text has an explicit matching review.');
}
