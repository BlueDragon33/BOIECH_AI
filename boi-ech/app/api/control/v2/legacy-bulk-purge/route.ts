import {AccountError} from "../../../../account-core.server";
import {accountErrorResponse,accountConfiguration} from "../../../../account-runtime.server";
import {getCourseDatabase} from "../../../../device-auth.server";
import {controlPreflight,controlResponse,requireControlService,withControlCors} from "../../../../control-auth.server";
import {previewLegacyFiveDayPurge,executeLegacyFiveDayPurge} from "../../../../owner-legacy-bulk-purge.server";
export const dynamic="force-dynamic";
export function OPTIONS(request:Request){return controlPreflight(request);}
export async function POST(request:Request){
 try{
  const actor=await requireControlService(request,"account-owner");
  if(actor.role!=="owner")throw new AccountError("OWNER_REQUIRED",403);
  if(!(await accountConfiguration()).v2)throw new AccountError("ACCOUNT_V2_REQUIRED",409);
  if(!request.headers.get("content-type")?.startsWith("application/json"))
   throw new AccountError("LEGACY_CLEANUP_INPUT",415);
  const raw=await request.text();
  if(raw.length>2048)throw new AccountError("LEGACY_CLEANUP_INPUT",413);
  let input:Record<string,unknown>;
  try{
   const parsed=JSON.parse(raw);
   if(!parsed||Array.isArray(parsed)||typeof parsed!=="object")throw new Error();
   input=parsed as Record<string,unknown>;
  }catch{throw new AccountError("LEGACY_CLEANUP_INPUT",400);}
  if(input.action==="preview")return controlResponse(
   await previewLegacyFiveDayPurge(await getCourseDatabase(),actor),200,request);
  if(input.action==="purge-batch")return controlResponse(
   await executeLegacyFiveDayPurge(await getCourseDatabase(),actor,input),200,request);
  throw new AccountError("LEGACY_CLEANUP_INPUT",400);
 }catch(error){return withControlCors(request,accountErrorResponse(error));}
}
