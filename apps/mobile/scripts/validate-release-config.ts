import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnvFiles, parseEnvFiles } from '@expo/env';
import { createHash } from 'node:crypto';

import { validateReleaseEnvironment as validateReleaseEnv } from '../src/api/releaseEnvironment';
import { validatePrivacyManifestReview, type PrivacyDeclarationReview } from '../src/privacy/privacyManifestValidation';

type ExpoConfig = {
  expo?: {
    icon?: unknown;
    ios?: {
      buildNumber?: unknown;
      bundleIdentifier?: unknown;
      deploymentTarget?: unknown;
      usesAppleSignIn?: unknown;
      appleTeamId?: unknown;
    };
    plugins?: unknown[];
    version?: unknown;
  };
};

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appConfigPath = resolve(mobileRoot, 'app.json');
const failures: string[] = [];
const app = (JSON.parse(readFileSync(appConfigPath, 'utf8')) as ExpoConfig).expo;

if (!app) {
  fail('app.json must contain an expo configuration object.');
} else {
  validateStaticConfig(app);
}

if (process.argv.includes('--environment')) {
  failures.push(...validateReleaseEnv(parseReleaseEnvironment()));
}

if (failures.length > 0) {
  console.error('Okyo release preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Okyo release preflight passed.');
}

function validateStaticConfig(config: NonNullable<ExpoConfig['expo']>): void {
  if (typeof config.version !== 'string' || config.version.trim() === '') fail('app.json is missing expo.version.');
  if (typeof config.icon !== 'string' || !existsSync(resolve(mobileRoot, config.icon))) fail('app.json icon must name an existing asset.');
  if (typeof config.ios?.bundleIdentifier !== 'string' || !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(config.ios.bundleIdentifier)) {
    fail('app.json ios.bundleIdentifier is missing or malformed.');
  }
  if (typeof config.ios?.buildNumber !== 'string' || !/^\d+(?:\.\d+)*$/.test(config.ios.buildNumber)) {
    fail('app.json ios.buildNumber is missing or malformed.');
  }
  if (config.ios?.usesAppleSignIn !== true) fail('app.json must explicitly declare ios.usesAppleSignIn when Apple sign-in is shipped.');
  if (config.ios?.bundleIdentifier !== 'com.rober.okyo') fail('The release bundle identifier must match the registered Okyo app: com.rober.okyo.');
  if (config.ios?.appleTeamId !== '7N86UDY734') fail('The Apple team must match the existing Okyo signing team, 7N86UDY734.');
  if (config.ios?.deploymentTarget !== undefined) fail('ios.deploymentTarget is unsupported here; configure it through expo-build-properties.');

  const buildProperties = config.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
  const properties = Array.isArray(buildProperties) && isRecord(buildProperties[1]) ? buildProperties[1] : undefined;
  const iosProperties = properties && isRecord(properties.ios) ? properties.ios : undefined;
  if (iosProperties?.deploymentTarget !== '17.0') fail('expo-build-properties must set ios.deploymentTarget to the supported minimum, 17.0.');
  if (iosProperties?.privacyManifestAggregationEnabled !== true) {
    fail('expo-build-properties must keep iOS privacy-manifest aggregation enabled.');
  }
  if (!config.plugins?.includes('./plugins/withReleasePermissions')) fail('the release-permissions config plugin is missing.');

  validateGeneratedPrivacyManifest();
  const legalSource = readFileSync(resolve(mobileRoot, 'src/legal/legalDocuments.ts'));
  const legalReview = JSON.parse(readFileSync(resolve(mobileRoot, 'legal-release-review.json'), 'utf8'));
  if (legalReview.status !== 'approved' || legalReview.sourceSha256 !== createHash('sha256').update(legalSource).digest('hex')) {
    fail('Prepared legal text requires owner/legal review of legal-release-review.json before a submission archive can be built.');
  }
}

function validateGeneratedPrivacyManifest(): void {
  const manifestPath = resolve(mobileRoot, 'ios', 'Okyo', 'PrivacyInfo.xcprivacy');
  if (!existsSync(manifestPath)) {
    fail('PrivacyInfo.xcprivacy is unavailable; run this check after iOS prebuild so the generated manifest can be reviewed.');
    return;
  }
  const manifest = readFileSync(manifestPath, 'utf8');
  if (!/NSPrivacyAccessedAPITypes/.test(manifest)) fail('PrivacyInfo.xcprivacy is missing required-reason API declarations.');
  const reviewPath = resolve(mobileRoot, 'privacy-collected-data-review.json');
  let review: PrivacyDeclarationReview | null = null;
  if (!existsSync(reviewPath)) {
    fail('privacy-collected-data-review.json is missing; founder/counsel must approve the exact collected-data declarations before release.');
  } else {
    try {
      review = JSON.parse(readFileSync(reviewPath, 'utf8')) as PrivacyDeclarationReview;
    } catch {
      fail('privacy-collected-data-review.json is invalid JSON; release privacy approval cannot be verified.');
    }
  }
  for (const failure of validatePrivacyManifestReview(manifest, review)) fail(failure);
}

function parseReleaseEnvironment(): Record<string, string | undefined> {
  const envFiles = getEnvFiles({ mode: 'production', silent: true })
    .map((path) => resolve(mobileRoot, path));
  const parsed = parseEnvFiles(envFiles, { systemEnv: process.env });
  // EAS/shell values take precedence over Expo dotenv files.
  return { ...parsed.env, ...process.env };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fail(message: string): void {
  failures.push(message);
}
