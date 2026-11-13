import {AccountError} from "../../../../account-core.server";
import {accountConfiguration,accountErrorResponse} from "../../../../account-runtime.server";
import {getCourseDatabase} from "../../../../device-auth.server";
import {controlPreflight,controlResponse,requireControlService,withControlCors} from "../../../../control-auth.server";
import {ownerDeviceBinding} from "../../../../owner-device-bindings.server";
export const dynamic="force-dynamic";
export function OPTIONS(request:Request){return controlPreflight(request);}
export async function POST(request:Request){
 try{
  // Unlike the original read-only registry, this endpoint always requires a
  // signed *account-owner* ticket. The generic integration secret is insufficient.
  const owner=await requireControlService(request,"account-owner");
  if(owner.role!=="owner")throw new AccountError("OWNER_REQUIRED",403);
  if(!(await accountConfiguration()).v2)throw new AccountError("ACCOUNT_V2_REQUIRED",409);
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new AccountError("ACCOUNT_INPUT",415);
  const raw=await request.text();
  if(raw.length>2048)throw new AccountError("ACCOUNT_INPUT",413);
  let input:Record<string,unknown>;
  try{const value=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))throw new Error();
   input=value as Record<string,unknown>;}catch{throw new AccountError("ACCOUNT_INPUT",400);}
  if(!["inspect","revoke","purge"].includes(String(input.action)))throw new AccountError("ACCOUNT_INPUT",400);
  return controlResponse(await ownerDeviceBinding(await getCourseDatabase(),owner,input),200,request);
 }catch(error){return withControlCors(request,accountErrorResponse(error));}
}
