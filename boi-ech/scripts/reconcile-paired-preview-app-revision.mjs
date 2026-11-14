import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readGeneratedPreviewConfig, verifyPairedPreviewArtifacts } from "./assert-paired-preview-artifact-revisions.mjs";

const SHA=/^[a-f0-9]{40}$/i;
function die(reason){throw new Error(reason);}
export function readAndAttestAppSource(appRoot,expectedSha){
 if(!SHA.test(expectedSha??""))die("App source must be pinned to an exact commit.");
 const actual=execFileSync("git",["-C",appRoot,"rev-parse","HEAD"],{encoding:"utf8",timeout:5000}).trim();
 if(actual!==expectedSha)die("App source HEAD differs from the reviewed commit.");
 // Application-Management tracks tsconfig.tsbuildinfo, even though tsc --noEmit
 // rewrites this disposable compiler cache during the already-PASS regression.
 // A cache-byte change is not a source change. Any other tracked modification
 // (including code, package lock, config, templates and workflow) MUST block.
 const changed=execFileSync("git",["-C",appRoot,"diff","--name-only","HEAD","--"],{encoding:"utf8",timeout:5000}).trim();
 const changes=changed?changed.split(/\\r?\\n/).filter(Boolean):[];
 const prohibited=changes.filter(file=>file!=="tsconfig.tsbuildinfo");
 if(prohibited.length)die("App tracked source changed after reviewed checkout: "+prohibited.map(file=>JSON.stringify(file)).join(", "));
 if(changes.length)console.log("App tracked TypeScript incremental cache changed during CI; no tracked source modification accepted.");
 const prepared=fs.readFileSync(path.join(appRoot,"wrangler.cloudflare.jsonc"),"utf8");
 const matches=[...prepared.matchAll(/"APPLICATION_MANAGEMENT_BUILD_REVISION"\s*:\s*"([^"]*)"/g)];
 if(matches.length!==1||matches[0][1]!==expectedSha)
   die("App prepared Preview revision does not match its exact reviewed source HEAD.");
 if(!/"APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL"\s*:\s*"cloudflare-preview"/.test(prepared))
   die("App prepared Preview channel is not isolated Preview.");
 return true;
}

/** Repair ONLY the known packaging defect: a confirmed App build stamped with
 * the parent BOIECH_AI SHA. Never assign a revision to a different checkout,
 * never downgrade the runtime check, never touch Production or secrets. */
export function reconcileAppPreviewArtifact(boi,app,env) {
 const expectedApp=env.APPLICATION_MANAGEMENT_BUILD_REVISION;
 const parent=env.GITHUB_SHA;
 if(!SHA.test(expectedApp??"")||!SHA.test(parent??"")||expectedApp===parent)
   die("Two distinct exact commit SHAs are required.");
 if(boi?.name!=="boi-ech-preview"||boi?.vars?.BOI_ECH_BUILD_REVISION!==parent||
    boi?.vars?.BOI_ECH_DEPLOYMENT_CHANNEL!=="cloudflare-preview")
   die("Parent Bơi Ếch generated artifact is not the reviewed Preview build.");
 if(app?.name!=="application-management-preview"||app?.vars?.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL!=="cloudflare-preview"||
    !Array.isArray(app.d1_databases)||app.d1_databases.length!==1||
    app.d1_databases[0].binding!=="DB"||
    app.d1_databases[0].database_id!==env.APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID)
   die("App generated artifact is not the approved isolated Preview deployment.");
 const current=app.vars.APPLICATION_MANAGEMENT_BUILD_REVISION;
 if(current===expectedApp)return {config:app,changed:false};
 if(current!==parent)
   die("Unknown App artifact revision mismatch; refuse to rewrite generated configuration.");
 return {config:{...app,vars:{...app.vars,APPLICATION_MANAGEMENT_BUILD_REVISION:expectedApp}},changed:true};
}

export function reconcileOnDisk({repoRoot=process.cwd(),env=process.env}={}){
 const boiRoot=path.join(repoRoot,"boi-ech");
 const appRoot=path.join(repoRoot,"application-management-preview-source");
 readAndAttestAppSource(appRoot,env.APPLICATION_MANAGEMENT_BUILD_REVISION);
 const boi=readGeneratedPreviewConfig(boiRoot);
 const app=readGeneratedPreviewConfig(appRoot);
 const {config,changed}=reconcileAppPreviewArtifact(boi,app,env);
 if(changed){
  const redirectDir=path.join(appRoot,".wrangler","deploy");
  const redirect=JSON.parse(fs.readFileSync(path.join(redirectDir,"config.json"),"utf8"));
  const file=path.resolve(redirectDir,redirect.configPath);
  const relative=path.relative(appRoot,file).split(path.sep).join("/");
  if(!relative.startsWith("dist/"))die("App deploy config escaped its generated artifact directory.");
  // Atomically update just the public revision metadata in the generated
  // deploy artifact. The application code bundle remains byte-for-byte intact.
  const tmp=file+".v12-revision-tmp";
  fs.writeFileSync(tmp,JSON.stringify(config,null,2)+"\n",{mode:0o600});
  fs.renameSync(tmp,file);
 }
 verifyPairedPreviewArtifacts(boi,readGeneratedPreviewConfig(appRoot),env);
 return {verified:true,correctedKnownParentStamp:changed,reviewedAppRevision:env.APPLICATION_MANAGEMENT_BUILD_REVISION};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=reconcileOnDisk();
 console.log(result.correctedKnownParentStamp
  ?"App Preview build metadata corrected from confirmed parent stamp to attested pinned App SHA; code bundle unchanged."
  :"App Preview revision already matches pinned source; no patch needed.");
 console.log("Paired generated artifacts and pinned App source attested; no D1 or Worker writes.");
}
