import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";
import yaml from "js-yaml";

const workflow=yaml.load(fs.readFileSync(new URL("../../.github/workflows/deploy-boi-ech-preview.yml",import.meta.url),"utf8"));
const steps=workflow.jobs["deploy-preview"].steps;
function confirmationStep(){
 const step=steps.find(step=>step.env?.BOI_ECH_PREVIEW_CONFIRMATION);
 assert.ok(step,"a real confirmation guard must run before deployment work");
 assert.equal(step.env.BOI_ECH_PREVIEW_CONFIRMATION,"${{ inputs.confirm }}");
 return step;
}

test("preview refuses absent, wrong and script-shaped confirmation inputs",()=>{
 const step=confirmationStep();
 assert.equal(workflow.on.workflow_dispatch.inputs.confirm.required,true);
 for(const value of ["","DEPLOY_PRODUCTION","deploy_preview","$(exit 0); DEPLOY_PREVIEW"]){
  const result=spawnSync("bash",["-euo","pipefail","-c",step.run],{env:{...process.env,BOI_ECH_PREVIEW_CONFIRMATION:value},encoding:"utf8"});
  assert.equal(result.status,1,`confirmation ${JSON.stringify(value)} must be rejected: ${result.stderr}`);
 }
});

test("preview accepts only the explicit confirmation before checkout and publishing",()=>{
 const step=confirmationStep();
 assert.equal(steps.indexOf(step),0,"no earlier step may run before confirmation");
 const result=spawnSync("bash",["-euo","pipefail","-c",step.run],{env:{...process.env,BOI_ECH_PREVIEW_CONFIRMATION:"DEPLOY_PREVIEW"},encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
});

function simulatePublish(rejectArtifact){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"boi-preview-guards-"));
 try{
  const shim='#!/usr/bin/env bash\nset -euo pipefail\nprintf "%s %s\\n" "${0##*/}" "$*" >> "$BOI_TEST_TRACE"\nif [[ "${0##*/}" == "npm" && "$*" == "run cloudflare:artifact:check" && "$BOI_TEST_REJECT_ARTIFACT" == "1" ]]; then exit 55; fi\n';
  for(const name of ["npm","npx"])fs.writeFileSync(path.join(root,name),shim,{mode:0o700});
  const trace=path.join(root,"trace");
  const env={...process.env,PATH:root+path.delimiter+process.env.PATH,BOI_TEST_TRACE:trace,BOI_TEST_REJECT_ARTIFACT:rejectArtifact?"1":"0"};
  const publish=steps.filter(step=>typeof step.run==="string"&&/npm run build|npm run cloudflare:artifact:check|npx wrangler deploy/.test(step.run));
  let status=0;
  for(const step of publish){
   const result=spawnSync("bash",["-euo","pipefail","-c",step.run],{env,cwd:root,encoding:"utf8"});
   status=result.status;
   if(status!==0)break;
  }
  return {status,trace:fs.existsSync(trace)?fs.readFileSync(trace,"utf8").trim().split("\n"):[]};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}

test("invalid generated preview artifact stops the workflow before publish",()=>{
 const result=simulatePublish(true);
 assert.equal(result.status,55,"the generated-artifact check must reject this build");
 assert.deepEqual(result.trace,["npm run build","npm run cloudflare:artifact:check"]);
});

test("successful generated-artifact check precedes the preview publisher",()=>{
 const result=simulatePublish(false);
 assert.equal(result.status,0);
 assert.deepEqual(result.trace,["npm run build","npm run cloudflare:artifact:check","npx wrangler deploy"]);
});
