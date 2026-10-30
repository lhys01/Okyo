import { isReleaseSafeApiUrl } from '../src/api/config';

export async function verifyReleaseApi(baseUrl: string, request: typeof fetch = fetch): Promise<string[]> {
  if (!isReleaseSafeApiUrl(baseUrl)) return ['The Release API must use a public HTTPS Production origin.'];
  const failures: string[] = [];
  for (const path of ['/ready', '/v1/library', '/v1/rankings/weekly']) {
    try {
      const response = await request(`${baseUrl.replace(/\/+$/, '')}${path}`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      await response.body?.cancel();
      if (path === '/ready' ? response.status !== 200 : ![401, 403, 404].includes(response.status)) {
        failures.push(`${path} returned HTTP ${response.status}; ${path === '/ready' ? 'readiness must return 200' : 'unsigned requests must be denied'}.`);
      }
    } catch {
      failures.push(`${path} could not be verified over HTTPS without redirects.`);
    }
  }
  return failures;
}
