import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeCrashEvent } from './sentryPrivacy';
test('crash reporting removes sensitive values, request data, breadcrumbs, user identity and exception messages',()=>{
  const event={message:'secret',user:{email:'private@example.com'},request:{headers:{Authorization:'Bearer secret'},data:'photo'},
    breadcrumbs:[{message:'private recipe'}],extra:{allergies:'peanuts',prompt:'private'},contexts:{password:'secret'},
    exception:{values:[{type:'TypeError',value:'private prompt',stacktrace:{frames:[{filename:'/private/user/main.js',function:'render',lineno:10,colno:3,vars:{token:'secret'}}]}}]}};
  const safe=sanitizeCrashEvent(event);
  assert.doesNotMatch(JSON.stringify(safe),/secret|private@|Bearer|peanuts|prompt|recipe|vars|breadcrumbs/);
  assert.equal(safe.exception?.values?.[0]?.stacktrace?.frames?.[0]?.lineno,10);
  assert.equal(safe.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename,'app:///main.js');
});
