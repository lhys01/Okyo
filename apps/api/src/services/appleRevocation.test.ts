import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { revokeAppleAuthorization } from './appleRevocation.js';
import { createAccountDeletionService } from './accountDeletion.js';

const config={authorizedParties:['okyo://'],clerkSecretKey:'sk_test_fixture',revenueCatProjectId:'project',revenueCatSecretKey:'test'};
const verifySessionToken=async()=>({sub:'user_test'} as Awaited<ReturnType<typeof import('@clerk/backend').verifyToken>>);
test('Apple revocation precedes identity deletion; failures preserve identity and retry succeeds',async()=>{
  for(const failed of ['apple','revenuecat','clerk','network',null]) {
    const calls:string[]=[];
    const service=createAccountDeletionService({config,verifySessionToken,
      revokeApple:async()=>{calls.push('apple');if(failed==='apple')throw new Error('unavailable');},
      fetchImpl:async(url,init)=>{
        const stage=String(url).includes('revenuecat')?'revenuecat':init?.method==='DELETE'?'clerk':'lookup';
        calls.push(stage);
        if(failed==='network')throw new Error('offline');
        return new Response(JSON.stringify(stage==='lookup'?{external_accounts:[{provider:'oauth_apple'}]}:{}),{status:stage===failed?503:200});
      }});
    if(failed==='apple'){
      const result=await service('Bearer test');
      assert.equal(result.appleAuthorizationRevocation,'manual_action_required');
      assert.deepEqual(calls,['lookup','revenuecat','apple','clerk']);
    } else if(failed){
      await assert.rejects(service('Bearer test'));
      if(failed==='revenuecat')assert.ok(!calls.includes('clerk'));
    } else {
      await service('Bearer test');
      assert.deepEqual(calls,['lookup','revenuecat','apple','clerk']);
    }
  }
});
test('expired auth does not call providers and already-deleted accounts are idempotent',async()=>{
  let calls=0;
  const fetchImpl:typeof fetch=async()=>{calls++;return new Response('{}',{status:404});};
  await assert.rejects(createAccountDeletionService({config,fetchImpl,verifySessionToken:async()=>{throw new Error('expired');}})('Bearer test'));
  assert.equal(calls,0);
  const service=createAccountDeletionService({config,fetchImpl,verifySessionToken});
  await service('Bearer test');await service('Bearer test');
  assert.equal(calls,6);
});
test('Apple token transport uses server credentials and fails closed without tokens/configuration',async()=>{
  const saved={...process.env};
  try {
    delete process.env.APPLE_SIGN_IN_CLIENT_ID;
    await assert.rejects(revokeAppleAuthorization('user_test','test',async()=>{throw new Error('must not send');}));
    const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({type:'pkcs8',format:'pem'}).toString();
    Object.assign(process.env,{APPLE_SIGN_IN_CLIENT_ID:'test.client',APPLE_TEAM_ID:'test-team',APPLE_SIGN_IN_KEY_ID:'test-key',APPLE_SIGN_IN_PRIVATE_KEY:key});
    const urls:string[]=[];
    await revokeAppleAuthorization('user_test','test',async(url,init)=>{
      urls.push(String(url));
      if(String(url).includes('clerk.com'))return new Response(JSON.stringify([{token:'server-access-token'}]));
      assert.equal((init?.body as URLSearchParams).get('token'),'server-access-token');
      assert.equal((init?.body as URLSearchParams).get('token_type_hint'),'access_token');
      assert.ok((init?.body as URLSearchParams).get('client_secret')?.split('.').length===3);
      return new Response('{}');
    });
    assert.equal(urls[0], 'https://api.clerk.com/v1/users/user_test/oauth_access_tokens/apple');
    assert.equal(urls[1],'https://appleid.apple.com/auth/revoke');
    await assert.rejects(revokeAppleAuthorization('user_test','test',async()=>new Response('[]')));
  } finally {for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});
