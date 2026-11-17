/**
 * V43 — deterministic, PURE proposal review state machine.
 * No database and no runtime activation. "Approved" is NOT "applied".
 * Future D1 writer must independently revalidate source/schedule/capacity,
 * execute signed CAS transaction and verify readback before marking applied.
 */
export type ProposalState="suggested"|"reviewed"|"approved"|"rejected";
export type ProposalAction="review"|"approve"|"reject";
export type ProposalAudit={
 id:string;actorId:string;action:ProposalAction;
 at:string;before:ProposalState;after:ProposalState;
 reason:string;expectedRevision:number;resultRevision:number;
};
export type ProposalRecord={
 id:string;kind:"teacher"|"learner";personId:string;classId:string;
 sourceFingerprint:string;observedAt:string;createdAt:string;
 revision:number;status:ProposalState;lastCommand:{id:string;action:ProposalAction;actorId:string}|null;
 audit:ProposalAudit[];
};
export type ProposalActor={deviceId:string;role:"manager"|"teacher"|"learner";authorized:boolean};
export type ProposalOutcome={
 ok:boolean;code:"OK"|"DENIED"|"STALE"|"CONFLICT"|"INVALID"|"REPLAY";
 record:ProposalRecord;message:string;
};
export function transitionProposal(input:{
 record:ProposalRecord;action:ProposalAction;actor:ProposalActor;
 expectedRevision:number;currentSourceFingerprint:string;
 commandId:string;at:string;reason:string;
}):ProposalOutcome{
 const {record,action,actor,expectedRevision,currentSourceFingerprint,commandId,at,reason}=input;
 const fail=(code:ProposalOutcome["code"],message:string):ProposalOutcome=>({ok:false,code,record,message});
 if(!actor.authorized||actor.role!=="manager"||!actor.deviceId)
  return fail("DENIED","Thiếu xác thực và quyền Cán bộ quản lý.");
 if(record.lastCommand?.id===commandId){
  return record.lastCommand.action===action&&record.lastCommand.actorId===actor.deviceId
   ? {ok:true,code:"REPLAY",record,message:"Lệnh đã xử lý; không ghi trùng."}
   :fail("CONFLICT","Mã lệnh bị tái sử dụng với nội dung khác.");
 }
 if(!/^[A-Za-z0-9_-]{8,96}$/.test(commandId)||reason.trim().length<3||reason.length>500||
   !Number.isSafeInteger(expectedRevision)||!Number.isFinite(Date.parse(at))||
   !record.id||!record.personId||!record.classId)return fail("INVALID","Dữ liệu quyết định chưa hợp lệ.");
 if(record.revision!==expectedRevision)return fail("CONFLICT","Có thay đổi đồng thời, cần đồng bộ trước.");
 if(!record.sourceFingerprint||record.sourceFingerprint!==currentSourceFingerprint)
  return fail("STALE","Bản đề xuất dựa trên dữ liệu cũ; phân tích lại trước khi duyệt.");
 const permitted=(action==="review"&&record.status==="suggested")||
  (action==="approve"&&record.status==="reviewed")||
  (action==="reject"&&(record.status==="suggested"||record.status==="reviewed"));
 if(!permitted)return fail("INVALID","Chuyển trạng thái không hợp lệ, không thể tự áp dụng hoặc bỏ qua review.");
 const state:ProposalState=action==="review"?"reviewed":action==="approve"?"approved":"rejected";
 const after:ProposalRecord={...record,status:state,revision:record.revision+1,
  lastCommand:{id:commandId,action,actorId:actor.deviceId},
  audit:[...record.audit,{
   id:commandId,actorId:actor.deviceId,action,at,before:record.status,after:state,
   reason:reason.trim(),expectedRevision,resultRevision:record.revision+1
  }]};
 return {ok:true,code:"OK",record:after,message:"Quyết định đã được mô phỏng; chưa thực hiện thay đổi trên máy chủ."};
}
