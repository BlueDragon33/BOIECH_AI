import {pathToFileURL} from 'node:url';
import {waitForLiveProductionRevision,verifyPublicAssets} from './production-package.mjs';

const ACCOUNT='f88a42260814230aa4a151abbfe5659d';
export const EXPECTED_DEPLOYED_REVISION='bba6f04adec15eccf9993b0c164cd8e278b18f07';
const ORIGIN='https://boi-ech.boiech-ai.workers.dev';
// Immutable paths recorded by the already-completed deploy in run #44393764310.
// This incident-specific readback MUST NOT mistake a newer deployment for PASS.
export const INCIDENT_ASSET_PROBES=[
 'assets/manager-workspace-BNv1YLk2.css',
 'assets/manager-workspace-BDMEP0BI.js',
 'assets/index-C0aFghes.css',
 'assets/index-CwI3PejO.js',
 'assets/learner-enhancements-vsBVH0Fj.js',
 'assets/teacher-enhancements-CImS8XL5.js'
];

export async function reacceptDeployedProduction({
 env=process.env,fetcher=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 retryDelays
}={}){
 if(env.PRODUCTION_READONLY_CONFIRM!=='VERIFY_EXISTING_PRODUCTION')
  throw new Error('Exact read-only Production confirmation required.');
 if(env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT||!env.CLOUDFLARE_API_TOKEN)
  throw new Error('Existing Cloudflare account and read-access credentials required.');
 const url=`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/boi-ech/settings`;
 const settings=async()=>{
  const response=await fetcher(url,{method:'GET',headers:{authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`},
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Production read-only settings returned HTTP ${response.status}`);
  return await response.json();
 };
 // Reads back exact deployed revision, retained D1, bridge-secret binding and
 // managed Account-first policy before testing public assets. No remote writes.
 const metadata=await waitForLiveProductionRevision(settings,EXPECTED_DEPLOYED_REVISION,{
  attempts:6,intervalMs:2000,sleep:pause
 });
 await verifyPublicAssets(INCIDENT_ASSET_PROBES,fetcher,{retryDelays,pause});
 const response=await fetcher(`${ORIGIN}/api/application-management/contract`,{
  method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)
 });
 if(response.status!==200)throw new Error(`Live Production public management contract HTTP ${response.status}`);
 let contract;
 try{contract=await response.json();}catch{throw new Error('Live Production management contract is not valid JSON');}
 if(contract?.schema!=='application-management.contract/v1'||contract.application?.id!=='boi-ech'||
    contract.application.category!=='Học tập'||contract.capabilities?.payments!==true||
    contract.capabilities?.webLaunch!==true||contract.capabilities?.deviceApproval!==false||
    contract.policy?.genericDeviceMutationAllowed!==false)
  throw new Error('Live Production management contract policy mismatch');
 return {
  verified:true,mode:'remote-read-only-postdeploy',expectedDeployedRevision:EXPECTED_DEPLOYED_REVISION,
  revision:metadata.revision,channel:metadata.channel,
  accountFirstV2:metadata.accountFirstV2,singleReview:metadata.singleReview,
  checkedAssets:INCIDENT_ASSET_PROBES.length,publicManagementContract:'PASS',
  noRemoteWrites:true,privateRoleAcceptance:'NOT_TESTED'
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await reacceptDeployedProduction();
 console.log(JSON.stringify(result));
}
