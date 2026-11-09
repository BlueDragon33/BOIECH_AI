import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
test('bundled 2026-05-22 workerd executes the production scrypt KDF without downgrade or network',async()=>{
 const result=await build({stdin:{contents:`import {hashPassword,verifyPassword} from './app/account-core.server.ts';export default {async fetch(){try{const v=await hashPassword('A secure runtime test password');return Response.json({format:v.split('$').slice(0,4).join('$'),valid:await verifyPassword('A secure runtime test password',v),wrong:await verifyPassword('wrong',v)})}catch(e){return Response.json({error:e.code||e.message},{status:503})}}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'neutral',external:['node:crypto']});
 const mf=new Miniflare({modules:true,script:result.outputFiles[0].text,compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat']});
 try{const r=await mf.dispatchFetch('https://isolated.invalid/');const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));assert.deepEqual(data,{format:'scrypt$32768$8$3',valid:true,wrong:false});}finally{await mf.dispose()}
});
