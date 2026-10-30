export function assertLocalLoadTestTarget(baseUrl) {
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw new Error('Load-test URL is invalid.'); }
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' ||
    !parsed.port || parsed.username || parsed.password || parsed.pathname !== '/' ||
    parsed.search || parsed.hash) {
    throw new Error('Load tests may target only http://127.0.0.1:<port>/.');
  }
  return parsed.origin;
}

export async function assertMockServer(baseUrl, fetchImpl = fetch) {
  const origin = assertLocalLoadTestTarget(baseUrl);
  const response = await fetchImpl(`${origin}/internal/load-test/status`, { signal: AbortSignal.timeout(3_000) });
  if (!response.ok) throw new Error('Target did not confirm local mock mode. No load was sent.');
  const payload = await response.json();
  if (payload?.ok !== true || payload.data?.mode !== 'local-mock' ||
    payload.data?.provider !== 'synthetic' || payload.data?.externalServices !== false) {
    throw new Error('Target is not an isolated mock API. No load was sent.');
  }
  return payload.data;
}
