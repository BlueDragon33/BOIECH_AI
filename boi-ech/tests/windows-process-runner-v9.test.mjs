import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

test("V9 Node22/24 runner launches npm CLI as JS, never a Windows .cmd file",()=>{
 const root=mkdtempSync(join(tmpdir(),"boi-runner-"));
 try{
  const cli=join(root,"fake-npm-cli.mjs");
  const output=join(root,"args.json");
  writeFileSync(cli,`import {writeFileSync} from "node:fs";
writeFileSync(process.env.BOI_RUNNER_TEST_OUTPUT,JSON.stringify({argv:process.argv.slice(2),log:process.env.WRANGLER_LOG_PATH}));`);
  const runner=fileURLToPath(new URL("../scripts/run-with-wrangler-log.mjs",import.meta.url));
  const result=spawnSync(process.execPath,[runner,"vite","--host","127.0.0.1","--port","3004"],{
   cwd:root,encoding:"utf8",env:{...process.env,npm_execpath:cli,
    BOI_RUNNER_TEST_OUTPUT:output,WRANGLER_LOG_PATH:join(root,"logs","wrangler.log")}});
  assert.equal(result.status,0,result.stderr||result.stdout);
  const parsed=JSON.parse(readFileSync(output,"utf8"));
  assert.deepEqual(parsed.argv,["exec","--no","--","vite","--host","127.0.0.1","--port","3004"]);
  assert.match(parsed.log,/wrangler\.log$/);
  const source=readFileSync(runner,"utf8");
  assert.doesNotMatch(source,/spawn\(\s*["']npx\.cmd/);
  assert.match(source,/spawn\(process\.execPath/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
