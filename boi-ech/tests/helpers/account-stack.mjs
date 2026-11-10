// Local SQLite platform adapter; authentication, HTTP routes and SQL remain production code.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const nativeRequire=createRequire(import.meta.url),root=fileURLToPath(new URL('../../',import.meta.url));
export function accountStack({v2=false,singleReview=false}={}){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
 if(v2)sqlite.exec("INSERT OR IGNORE INTO access_automation_settings(id,default_access_days) VALUES('global',90)");
 function prepare(sql){let args=[];return{bind(...a){args=a;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){return{results:sqlite.prepare(sql).all(...args)}},async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}},_run(){const st=sqlite.prepare(sql);return /^\s*(?:SELECT|PRAGMA|EXPLAIN)\b/i.test(sql)?{results:st.all(...args),meta:{changes:0}}:{meta:{changes:Number(st.run(...args).changes)}}}}}
 const db={prepare,async batch(stmts){sqlite.exec('BEGIN IMMEDIATE');try{const result=stmts.map(s=>s._run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 let cookie='';const bindings={DB:db,BOI_ECH_ACCOUNT_FIRST:'true',BOI_ECH_ACCOUNT_V2:String(v2),BOI_ECH_SINGLE_REVIEW:String(singleReview),BOI_ECH_ACCOUNT_ORIGIN:'https://fixture.invalid'},cache=new Map();
 function load(relative){const filename=path.resolve(root,'app',relative);if(cache.has(filename))return cache.get(filename).exports;const loaded={exports:{}};cache.set(filename,loaded);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const require=name=>name==='cloudflare:workers'?{env:bindings}:name==='next/headers'?{cookies:async()=>({get:()=>cookie?{value:cookie}:undefined}),headers:async()=>new Headers({origin:'https://fixture.invalid','content-type':'application/json'})}:name.includes('chatgpt-auth')?{getChatGPTUser:async()=>null}:name.startsWith('.')?load(path.relative(path.join(root,'app'),path.resolve(path.dirname(filename),name+'.ts'))):nativeRequire(name);
  new Function('require','module','exports',code)(require,loaded,loaded.exports);return loaded.exports;
 }
 const service=new(load('account-core.server.ts').AccountService)(db,Date.now,v2,singleReview);
 const flow=v2?new(load('account-v2-workflow.server.ts').AccountV2Workflow)(db,service,singleReview):null;
 const key=async()=>crypto.subtle.exportKey('jwk',(await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])).publicKey);
 const register=async(n,role='learner')=>service.register({login:'fixture'+n,password:'Local-only unique passphrase '+n,role,personCode:'PERSON'+n,phone:'090'+String(n).padStart(7,'0'),familyName:'Synthetic',givenName:'Person',className:'Same class',privacyAccepted:true,publicKey:await key()},'fixture'+n);
 const post=(relative,payload)=>load(relative).POST(new Request('https://fixture.invalid/'+relative.replace('/route.ts',''),{method:'POST',headers:{origin:'https://fixture.invalid','content-type':'application/json'},body:JSON.stringify(payload)}));
 const get=relative=>load(relative).GET(new Request('https://fixture.invalid/'+relative.replace('/route.ts',''),{method:'GET'}));
 return{sqlite,db,service,flow,register,post,get,load,setCookie:value=>{cookie=value},
  setAccountMode:enabled=>{bindings.BOI_ECH_ACCOUNT_FIRST=String(enabled)},
  close:()=>sqlite.close()};
}
