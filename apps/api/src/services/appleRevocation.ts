import { createPrivateKey, sign } from 'node:crypto';

export class AppleRevocationError extends Error {
  constructor() { super('Apple authorization revocation unavailable.'); }
}

/** No user token is accepted from the client or persisted/logged by this service. */
export async function revokeAppleAuthorization(userId: string, clerkSecret: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const clientId = process.env.APPLE_SIGN_IN_CLIENT_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_SIGN_IN_KEY_ID;
  const pem = process.env.APPLE_SIGN_IN_PRIVATE_KEY;
  if (!clientId || !teamId || !keyId || !pem) throw new AppleRevocationError();
  const now = Math.floor(Date.now()/1000);
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encoded({alg:'ES256',kid:keyId})}.${encoded({iss:teamId,iat:now,exp:now+300,aud:'https://appleid.apple.com',sub:clientId})}`;
  const clientSecret = `${unsigned}.${sign('sha256',Buffer.from(unsigned),{key:createPrivateKey(pem),dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
  // Clerk's REST endpoint expects OAuthProvider (`apple`), while
  // external_accounts.provider uses the strategy-style value `oauth_apple`.
  const tokens = await fetchImpl(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}/oauth_access_tokens/apple`, {
    headers:{Authorization:`Bearer ${clerkSecret}`}, signal:AbortSignal.timeout(5000),
  });
  if (!tokens.ok) throw new AppleRevocationError();
  const body: unknown = await tokens.json();
  if (!Array.isArray(body) || !body.length || body.some(value=> typeof value?.token !== 'string' || !value.token)) throw new AppleRevocationError();
  for (const value of body) {
    const result = await fetchImpl('https://appleid.apple.com/auth/revoke', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,token:value.token,token_type_hint:'access_token'}),
      signal:AbortSignal.timeout(5000),
    });
    if (!result.ok) throw new AppleRevocationError();
  }
}
