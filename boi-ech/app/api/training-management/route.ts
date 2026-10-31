import { DeviceAccessError,deviceErrorResponse,verifyDeviceRequest } from "../../device-auth.server";
import { requireManager,trainingBoard,trainingCommand,trainingWindow } from "../../training-management.server";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 let applied=false;
 try{
  const raw=await request.text();if(raw.length>32768)return Response.json({error:"Yêu cầu quá lớn."},{status:413});
  const payload=JSON.parse(raw) as Record<string,unknown>;
  if(!payload || typeof payload!=="object" || Array.isArray(payload)) return Response.json({error:"Yêu cầu phải là một đối tượng dữ liệu."},{status:400});
  const actor=await verifyDeviceRequest(payload,false);requireManager(actor);
  const {from,to}=trainingWindow(payload);
  if(payload.action!=="list"){await trainingCommand(actor,payload);applied=true;}
  return Response.json({board:await trainingBoard(from,to)},{headers:{"cache-control":"no-store, private"}});
 }catch(error){
  const message=error instanceof Error?error.message:"";
  const errors:Record<string,string>={TRAINING_CONFLICT:"Trùng lịch lớp, phòng hoặc giảng viên.",TRAINING_CAPACITY:"Vượt sức chứa lớp hoặc phòng. Hãy điều chỉnh sĩ số/sức chứa trước.",TRAINING_RESOURCE_UNAVAILABLE:"Lớp, phòng, tòa học hoặc giảng viên chưa sẵn sàng/đúng phân công.",TRAINING_ACTIVE_BOOKINGS:"Còn buổi học đã xếp. Hãy đổi hoặc hủy lịch trước.",TRAINING_CLASS_NAME_IN_USE:"Tên lớp đang gắn với hồ sơ/lịch học. Giữ tên để tránh lệch dữ liệu.",TRAINING_RESOURCE_KIND:"Không thể đổi loại tài nguyên."};
  for(const [code,text] of Object.entries(errors))if(message.includes(code))return deviceErrorResponse(new DeviceAccessError(text,409,code));
  if(/UNIQUE constraint/.test(message))return deviceErrorResponse(new DeviceAccessError("Mã hoặc tên dữ liệu đã tồn tại. Đồng bộ trước khi thử lại.",409,"TRAINING_DUPLICATE"));
  if(applied)return Response.json({error:"Đã ghi nhưng chưa xác minh được dữ liệu trả về. Đồng bộ hoặc thử lại đúng bản nháp này; mã thao tác ngăn ghi trùng.",applied:true},{status:503,headers:{"cache-control":"no-store, private"}});
  if(error instanceof SyntaxError)return Response.json({error:"Dữ liệu yêu cầu không hợp lệ."},{status:400});
  return deviceErrorResponse(error);
 }
}
