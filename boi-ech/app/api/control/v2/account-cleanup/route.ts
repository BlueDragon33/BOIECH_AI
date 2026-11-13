import {AccountError} from "../../../../account-core.server";
import {accountConfiguration,accountErrorResponse} from "../../../../account-runtime.server";
import {getCourseDatabase} from "../../../../device-auth.server";
import {controlPreflight,controlResponse,requireControlService,withControlCors} from "../../../../control-auth.server";
import {inspectCleanup,purgeCleanupAccount} from "../../../../owner-account-cleanup.server";
export const dynamic="force-dynamic";
export function OPTIONS(request:Request){return controlPreflight(request);}
export async function POST(request:Request){
 try{
  const actor=await requireControlService(request,"account-owner");
  if(actor.role!=="owner")throw new AccountError("OWNER_REQUIRED",403);
  if(!(await accountConfiguration()).v2)throw new AccountError("ACCOUNT_V2_REQUIRED",409);
  if(!request.headers.get("content-type")?.startsWith("application/json"))
   throw new AccountError("CLEANUP_INPUT",415);
  const raw=await request.text();
  if(raw.length>3500)throw new AccountError("CLEANUP_INPUT",413);
  let input:Record<string,unknown>;
  try{const val=JSON.parse(raw);if(!val||typeof val!=="object"||Array.isArray(val))throw new Error();
   input=val as Record<string,unknown>;}catch{throw new AccountError("CLEANUP_INPUT",400);}
  const db=await getCourseDatabase();
  const payload=input.action==="preview"?await inspectCleanup(db,actor,input)
   :input.action==="purge"?await purgeCleanupAccount(db,actor,input)
   :(()=>{throw new AccountError("CLEANUP_INPUT",400)})();
  return controlResponse(payload,200,request);
 }catch(error){return withControlCors(request,accountErrorResponse(error));}
}
