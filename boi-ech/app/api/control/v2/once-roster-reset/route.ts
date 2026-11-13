import {AccountError} from "../../../../account-core.server";
import {accountConfiguration,accountErrorResponse} from "../../../../account-runtime.server";
import {getCourseDatabase} from "../../../../device-auth.server";
import {controlPreflight,controlResponse,requireControlService,withControlCors} from "../../../../control-auth.server";
import {previewOwnerOnceRosterReset,executeOwnerOnceRosterReset} from "../../../../owner-once-roster-reset.server";
export const dynamic="force-dynamic";
export function OPTIONS(request:Request){return controlPreflight(request);}
export async function POST(request:Request){
 try{
  const actor=await requireControlService(request,"account-owner");
  if(actor.role!=="owner")throw new AccountError("OWNER_REQUIRED",403);
  if(!(await accountConfiguration()).v2)throw new AccountError("ACCOUNT_V2_REQUIRED",409);
  if(!request.headers.get("content-type")?.startsWith("application/json"))
   throw new AccountError("ROSTER_RESET_INPUT",415);
  const raw=await request.text();
  if(raw.length>2500)throw new AccountError("ROSTER_RESET_INPUT",413);
  let input:Record<string,unknown>;
  try{const value=JSON.parse(raw);if(!value||Array.isArray(value)||typeof value!=="object")throw Error();
   input=value as Record<string,unknown>;}catch{throw new AccountError("ROSTER_RESET_INPUT",400);}
  const db=await getCourseDatabase();
  const result=input.action==="preview"?await previewOwnerOnceRosterReset(db,actor)
   :input.action==="execute-batch"?await executeOwnerOnceRosterReset(db,actor,input)
   :(()=>{throw new AccountError("ROSTER_RESET_INPUT",400)})();
  return controlResponse(result,200,request);
 }catch(error){return withControlCors(request,accountErrorResponse(error));}
}
