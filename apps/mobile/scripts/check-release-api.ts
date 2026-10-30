import { getEnvFiles, parseEnvFiles } from '@expo/env';
import { resolve } from 'node:path';
import { verifyReleaseApi } from './verify-release-api';

async function main() {
  const files = getEnvFiles({ mode: 'production', silent: true }).map((file) => resolve(file));
  const parsed = parseEnvFiles(files, { systemEnv: process.env });
  const environment = { ...parsed.env, ...process.env };
  const failures = await verifyReleaseApi(environment.EXPO_PUBLIC_OKYO_API_URL ?? '');
  for (const failure of failures) console.error(`Release API check: ${failure}`);
  if (failures.length) process.exitCode = 1;
  else console.log('Release API readiness and unauthenticated route restrictions verified.');
}
void main().catch(() => { console.error('Release API verification could not run.'); process.exitCode = 1; });
