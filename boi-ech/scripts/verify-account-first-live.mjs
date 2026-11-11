import assert from 'node:assert/strict';
const origin='https://boi-ech.boiech-ai.workers.dev';
async function request(path,options={}){
 const r=await fetch(origin+path,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});
 const body=await r.json();return {status:r.status,body};
}
const config=await request('/api/accounts');
assert.equal(config.status,200);assert.equal(config.body.enabled,true);assert.equal(config.body.accountV2,true);assert.equal(config.body.account,null);
const expectedSingleReview=process.env.BOI_ECH_EXPECT_SINGLE_REVIEW;
if(expectedSingleReview!==undefined)assert.equal(config.body.accountSingleReview,expectedSingleReview==='true');
assert.equal(config.body.accountUiTrial,false);
const post=(payload,from=origin)=>request('/api/accounts',{method:'POST',headers:{'content-type':'application/json',origin:from},body:JSON.stringify(payload)});
const foreign=await post({action:'review-list'},'https://untrusted.invalid');
assert.equal(foreign.status,403);assert.equal(foreign.body.code,'ACCOUNT_CSRF_REJECTED');
const anon=await post({action:'review-list'});assert.equal(anon.status,401);
// Unknown-account login executes the real production scrypt cost without creating a test user.
const login=await post({action:'login',login:'qa-missing-'+crypto.randomUUID(),password:'Runtime probe only '+crypto.randomUUID()});
assert.equal(login.status,401);assert.equal(login.body.code,'AUTH_FAILED');
console.log(`Live Account-first V2 ON, single review=${config.body.accountSingleReview}; anonymous session, CSRF, protected review and real scrypt login boundary PASS. No account created or approved.`);
