import {DeviceAccessError,deviceErrorResponse,verifyDeviceRequest} from "../../../device-auth.server";
import {previewManagerRosterCleanup,purgeManagerRosterRecord} from "../../../manager-roster-cleanup.server";
export const dynamic="force-dynamic";
const deny=(message:string,status:number,code:string)=>deviceErrorResponse(new DeviceAccessError(message,status,code));
export async function POST(request:Request) {
 try {
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
   return deny("Yêu cầu JSON hợp lệ.",415,"ROSTER_CLEANUP_INPUT");
  const body=await request.text();
  if(body.length>4096)return deny("Yêu cầu quá dài.",413,"ROSTER_CLEANUP_INPUT");
  const input=JSON.parse(body) as Record<string,unknown>;
  if(!input||typeof input!=="object"||Array.isArray(input))
   return deny("Yêu cầu không hợp lệ.",400,"ROSTER_CLEANUP_INPUT");
  const actor=await verifyDeviceRequest(input,false);
  const data=input.action==="preview"
    ?await previewManagerRosterCleanup(actor,input)
    :input.action==="purge"
      ?await purgeManagerRosterRecord(actor,input)
      :null;
  if(!data)return deny("Thao tác dọn hồ sơ không hợp lệ.",400,"ROSTER_CLEANUP_INPUT");
  return Response.json(data,{headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff"}});
 }catch(error) {
  if(error instanceof SyntaxError)return deny("Dữ liệu yêu cầu không hợp lệ.",400,"ROSTER_CLEANUP_INPUT");
  return deviceErrorResponse(error);
 }
}
