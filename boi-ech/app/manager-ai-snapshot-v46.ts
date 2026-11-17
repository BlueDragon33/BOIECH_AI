/**
 * V46 preview-only manager AI snapshot gate.
 * Pure, deterministic and read-only. It does NOT authorize any D1 mutation.
 * A server-side signed authorization and CAS check remain mandatory.
 */
export type ManagerAiSnapshotStatus="fresh"|"stale"|"future"|"partial"|"invalid";
export type ManagerAiSnapshotAssessment={
 status:ManagerAiSnapshotStatus;
 canDecide:boolean;
 ageSeconds:number|null;
 message:string;
};
const MAX_SNAPSHOT_AGE_MS=5*60*1000;
const FUTURE_CLOCK_TOLERANCE_MS=30*1000;
const canonicalTimestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function assessManagerAiSnapshot(
 input:{observedAt:string;sourceMayBeTruncated:boolean},
 nowMs:number,
 maxAgeMs=MAX_SNAPSHOT_AGE_MS
):ManagerAiSnapshotAssessment{
 const invalid=(message:string):ManagerAiSnapshotAssessment=>({
  status:"invalid",canDecide:false,ageSeconds:null,message
 });
 if(!Number.isFinite(nowMs)||nowMs<0||!Number.isFinite(maxAgeMs)||maxAgeMs<=0)
  return invalid("Không thể xác minh thời gian thiết bị; làm mới dữ liệu trước khi quyết định.");
 const observed=input?.observedAt;
 if(typeof observed!=="string"||!canonicalTimestamp.test(observed))
  return invalid("Mốc dữ liệu không hợp lệ; làm mới bảng quản lý.");
 const timestamp=Date.parse(observed);
 if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString()!==observed)
  return invalid("Không thể xác thực thời điểm chụp dữ liệu; làm mới bảng quản lý.");
 const delta=nowMs-timestamp,ageSeconds=Math.max(0,Math.floor(delta/1000));
 if(delta < -FUTURE_CLOCK_TOLERANCE_MS)
  return {status:"future",canDecide:false,ageSeconds:0,
   message:"Mốc dữ liệu ở tương lai so với đồng hồ thiết bị; đồng bộ thời gian và tải lại."};
 if(input.sourceMayBeTruncated)
  return {status:"partial",canDecide:false,ageSeconds,
   message:"Nguồn quản lý bị giới hạn bản ghi; không được xác nhận phương án từ dữ liệu chưa đầy đủ."};
 if(delta>maxAgeMs)
  return {status:"stale",canDecide:false,ageSeconds,
   message:"Bảng quản lý đã quá 5 phút; tải lại dữ liệu trước khi xem xét hoặc áp dụng phân công AI."};
 return {status:"fresh",canDecide:true,ageSeconds,
  message:"Dữ liệu đang trong ngưỡng thời gian xem xét; máy chủ vẫn phải kiểm tra lại quyền và D1."};
}
