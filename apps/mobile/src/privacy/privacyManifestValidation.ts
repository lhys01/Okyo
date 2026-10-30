import { createHash } from 'node:crypto';

export type PrivacyDeclarationReview = {
  status?: unknown;
  manifestSha256?: unknown;
};

/**
 * Release gate for collected-data declarations. It deliberately validates
 * structure and review state only; it never chooses Apple categories,
 * purposes, linkage, or tracking values.
 */
export function validatePrivacyManifestReview(
  manifest: string,
  review: PrivacyDeclarationReview | null | undefined,
): string[] {
  const failures: string[] = [];
  const collectedArray = getCollectedDataArray(manifest);

  if (collectedArray === null) {
    failures.push('PrivacyInfo.xcprivacy is missing NSPrivacyCollectedDataTypes.');
  } else if (collectedArray.trim() === '') {
    failures.push('PrivacyInfo.xcprivacy declares no collected data although food photos and dish context leave the device. Founder/counsel must approve the data types, purposes, linkage, and tracking answers before release; this check will not infer them.');
  } else {
    const declarations = collectedArray.match(/<dict\s*>[\s\S]*?<\/dict>/g) ?? [];
    if (declarations.length === 0) {
      failures.push('NSPrivacyCollectedDataTypes must contain complete declaration dictionaries; do not use placeholders.');
    }
    for (const declaration of declarations) {
      if (!/<key>NSPrivacyCollectedDataType<\/key>\s*<string>[^<]+<\/string>/.test(declaration) ||
          !/<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<(?:true|false)\s*\/>/.test(declaration) ||
          !/<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<(?:true|false)\s*\/>/.test(declaration) ||
          !/<key>NSPrivacyCollectedDataTypePurposes<\/key>\s*<array>\s*<string>[^<]+<\/string>/.test(declaration)) {
        failures.push('Each collected-data declaration must include a data type, Linked, Tracking, and at least one purpose; founder/counsel approval is still required.');
        break;
      }
      const type = declaration.match(/<key>NSPrivacyCollectedDataType<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
      if (!type || !COLLECTED_TYPES.has(type)) failures.push('A collected-data declaration uses an unsupported Apple data type.');
      const purposes = declaration.match(/<key>NSPrivacyCollectedDataTypePurposes<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? '';
      if ([...purposes.matchAll(/<string>([^<]+)<\/string>/g)].some((match) => !PURPOSES.has(match[1]))) {
        failures.push('A collected-data declaration uses an unsupported Apple purpose.');
      }
    }
  }

  if (review?.status !== 'approved') {
    failures.push('Collected-data declarations are not marked approved by founder/counsel in privacy-collected-data-review.json.');
  } else if (typeof review.manifestSha256 !== 'string' || review.manifestSha256 !== sha256(manifest)) {
    failures.push('The privacy declaration review does not match the current PrivacyInfo.xcprivacy; review and approve the exact manifest before release.');
  }

  return failures;
}

const COLLECTED_TYPES = new Set([
  'Name', 'EmailAddress', 'CoarseLocation', 'UserID', 'DeviceID', 'PhotosorVideos', 'Health',
  'OtherUserContent', 'CustomerSupport', 'PurchaseHistory', 'ProductInteraction',
  'CrashData', 'PerformanceData', 'OtherDiagnosticData',
].map((type) => `NSPrivacyCollectedDataType${type}`));
const PURPOSES = new Set(['AppFunctionality', 'Analytics', 'ProductPersonalization']
  .map((purpose) => `NSPrivacyCollectedDataTypePurpose${purpose}`));

export function privacyManifestSha256(manifest: string): string {
  return sha256(manifest);
}

function getCollectedDataArray(manifest: string): string | null {
  const keyIndex = manifest.indexOf('<key>NSPrivacyCollectedDataTypes</key>');
  if (keyIndex < 0) return null;
  const openIndex = manifest.indexOf('<array', keyIndex);
  if (openIndex < 0) return null;
  const openEnd = manifest.indexOf('>', openIndex);
  if (openEnd < 0) return null;
  if (manifest.slice(openIndex, openEnd + 1).endsWith('/>')) return '';

  let depth = 1;
  const tags = /<\/?array\b[^>]*>/g;
  tags.lastIndex = openEnd + 1;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(manifest))) {
    if (match[0].startsWith('</')) depth -= 1;
    else if (!match[0].endsWith('/>')) depth += 1;
    if (depth === 0) return manifest.slice(openEnd + 1, match.index);
  }
  return null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
