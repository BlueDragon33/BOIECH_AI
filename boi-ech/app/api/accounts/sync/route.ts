import { AccountError } from "../../../account-core.server";
import { AccountVerifiedSync } from "../../../account-v2-sync.server";
import { accountRequest, accountErrorResponse } from "../../../account-runtime.server";
import { getCourseDatabase } from "../../../device-auth.server";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
 try {
  const {service,token,config}=await accountRequest(request);
  if(!config.v2)throw new AccountError("ACCOUNT_FEATURE_DISABLED",404);
  const raw=await request.text();
  if(raw.length>8192)throw new AccountError("SYNC_DATA_TOO_LARGE",413);
  const input=JSON.parse(raw) as Record<string,unknown>;
  if(!input||typeof input!=="object"||Array.isArray(input))throw new AccountError("SYNC_INPUT_INVALID",400);
  // Revalidate the caller's immutable account namespace on every sync request.
  // Without this, an old offline queue could be uploaded after a browser account switch.
  const actor=await service.session(token);
  if(typeof input.accountId!=="string" || input.accountId!==actor.accountId)
    throw new AccountError("ACCOUNT_SWITCHED",409);
  const sync=new AccountVerifiedSync(await getCourseDatabase(),service);
  let result:unknown;
  if(input.action==="consent")result=await sync.consent(token,input.scope,input.enabled,input.password);
  else if(input.action==="write")result=await sync.write(token,input);
  else if(input.action==="read")result=await sync.read(token,input.scope,input.afterKey,input.limit);
  else throw new AccountError("SYNC_INPUT_INVALID",400);
  return Response.json({ok:true,result},{headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff"}});
 }catch(error){return accountErrorResponse(error);}
}
