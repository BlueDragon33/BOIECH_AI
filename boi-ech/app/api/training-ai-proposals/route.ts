import {createHash} from "node:crypto";
import {DeviceAccessError,deviceErrorResponse,verifyDeviceRequest} from "../../device-auth.server";
import {requireManager,trainingBoard,trainingDatabase,trainingWindow} from "../../training-management.server";
import {buildAllocationReview,type AllocationProposal} from "../../manager-ai-allocation-v42";
import type {TrainingBoard} from "../../training-types";

export const dynamic="force-dynamic";
const hash=(input:string)=>createHash("sha256").update(input).digest("hex");
const respond=(data:unknown,status=200)=>Response.json(data,{
 status,headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff"}
});
type Row={proposal_id:string;kind:string;person_id:string;class_id:string;
 source_fingerprint:string;state:"reviewed"|"approved"|"rejected";revision:number;actor_id:string;updated_at:string};
type Receipt={proposal_id:string;actor_id:string;action:string;request_fingerprint:string};
const flatten=(review:ReturnType<typeof buildAllocationReview>)=>
 [...review.teacherShortlist,...review.learnerShortlist];

/** Only deterministic, non-PII evidence. Ignore board.observedAt so refresh alone is not a conflict. */
function proposalFingerprint(board:TrainingBoard,proposal:AllocationProposal){
 const resources=board.resources.map(x=>[x.id,x.kind,x.name,x.status,x.capacity,x.requiredTeachers,x.learnerCount,x.teacherCount,x.version])
  .sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 const people=board.people.map(x=>[x.id,x.role,x.className,x.status,x.expired,x.registered])
  .sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 const sessions=board.sessions.map(x=>[x.id,x.classId,x.teacherId,x.assistantTeacherId,x.roomId,x.status,x.startsAt,x.endsAt,x.version])
  .sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 return hash(JSON.stringify({version:"v43-manager-review-1",window:[board.from,board.to],
  proposal:[proposal.id,proposal.kind,proposal.personId,proposal.classId,proposal.priority,proposal.suggestedRole],
  resources,people,sessions}));
}
function validId(value:unknown):value is string{
 return typeof value==="string"&&/^(teacher|learner):[A-Za-z0-9_-]{1,96}:[A-Za-z0-9_-]{1,96}$/.test(value);
}
function validCommandId(value:unknown):value is string{
 return typeof value==="string"&&/^[A-Za-z0-9_-]{8,96}$/.test(value);
}
/**
 * No autonomous allocation: "approved" records the manager's human decision,
 * it DOES NOT call trainingCommand or change any class_name/session/room.
 * Final manager assignment still uses signed trainingCommand with live D1 CAS.
 */
export async function POST(request:Request){
 try{
  const raw=await request.text();
  if(raw.length>16000)return respond({error:"Yêu cầu quá lớn."},413);
  const payload=JSON.parse(raw) as Record<string,unknown>;
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
   return respond({error:"Dữ liệu yêu cầu không hợp lệ."},400);
  const actor=await verifyDeviceRequest(payload,false);
  requireManager(actor);
  const {from,to}=trainingWindow(payload);
  // Enforce Account-first manager principal/session/entitlement capability via
  // existing canonical management board, not a parallel AI privilege.
  const board=await trainingBoard(from,to,actor);
  const review=buildAllocationReview(board);
  if(review.sourceMayBeTruncated)
   return respond({error:"Nguồn nhân sự/lịch đã đạt giới hạn tải; không thể ghi quyết định thiếu căn cứ.",code:"AI_SOURCE_TRUNCATED"},409);
  const choices=flatten(review);
  const action=payload.action;
  if(action==="list"){
   if(!choices.length)return respond({items:[],sourceAvailable:true});
   const ids=[...new Set(choices.map(x=>x.id))].slice(0,100);
   const db=await trainingDatabase();
   const statement=db.prepare(`SELECT proposal_id,kind,person_id,class_id,source_fingerprint,state,revision,actor_id,updated_at
    FROM training_ai_proposals WHERE proposal_id IN (${ids.map(()=>"?").join(",")})`);
   const rows=(await statement.bind(...ids).all<Row>()).results??[];
   return respond({items:rows.filter(row=>{
    const current=choices.find(x=>x.id===row.proposal_id);
    return current&&row.source_fingerprint===proposalFingerprint(board,current);
   }).map(row=>({
    id:row.proposal_id,kind:row.kind,personId:row.person_id,classId:row.class_id,
    status:row.state,revision:row.revision,updatedAt:row.updated_at
   })),sourceAvailable:true,observedAt:board.observedAt});
  }
  if(action!=="review"&&action!=="approve"&&action!=="reject")
   return respond({error:"Thao tác không hợp lệ."},400);
  if(!validId(payload.proposalId)||!validCommandId(payload.commandId))
   return respond({error:"Mã đề xuất hoặc mã lệnh không hợp lệ."},400);
  const expectedRevision=payload.expectedRevision,reason=payload.reason;
  if(typeof expectedRevision!=="number"||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
   typeof reason!=="string"||reason.trim().length<3||reason.length>350)
   return respond({error:"Phiên bản hoặc lý do xem xét không hợp lệ."},400);
  const proposal=choices.find(x=>x.id===payload.proposalId);
  if(!proposal)return respond({error:"Phương án không còn thuộc dữ liệu đang được phép xem.",code:"AI_PROPOSAL_STALE"},409);
  const fingerprint=proposalFingerprint(board,proposal);
  const canonical=hash(JSON.stringify({action,proposalId:proposal.id,actorId:actor.deviceId,
    expectedRevision,reason:reason.trim(),fingerprint}));
  const db=await trainingDatabase();
  async function commandReceipt(){return db.prepare(
   "SELECT proposal_id,actor_id,action,request_fingerprint FROM training_ai_proposal_commands WHERE command_id=?"
  ).bind(payload.commandId).first<Receipt>();}
  const existing=await commandReceipt();
  if(existing){
   if(existing.proposal_id!==proposal.id||existing.actor_id!==actor.deviceId||
     existing.action!==action||existing.request_fingerprint!==canonical)
    return respond({error:"Mã lệnh đã được dùng cho quyết định khác.",code:"AI_COMMAND_CONFLICT"},409);
   return respond({ok:true,replayed:true,proposalId:proposal.id});
  }
  const targetStatus=action==="approve"?"approved":action==="reject"?"rejected":"reviewed";
  const write=(action==="review"||action==="reject")&&expectedRevision===0?
   db.prepare(`INSERT OR IGNORE INTO training_ai_proposals
    (proposal_id,kind,person_id,class_id,source_fingerprint,state,revision,actor_id)
    VALUES (?,?,?,?,?,?,1,?)`)
    .bind(proposal.id,proposal.kind,proposal.personId,proposal.classId,fingerprint,targetStatus,actor.deviceId)
   :db.prepare(`UPDATE training_ai_proposals SET state=?,revision=revision+1,
     actor_id=?,updated_at=CURRENT_TIMESTAMP
     WHERE proposal_id=? AND source_fingerprint=? AND revision=?
     AND state=${action==="approve"?"'reviewed'":action==="reject"?"'reviewed'":"'not-allowed'"}`)
    .bind(targetStatus,actor.deviceId,proposal.id,fingerprint,expectedRevision);
  const commands=db.prepare(`INSERT INTO training_ai_proposal_commands
   (command_id,proposal_id,actor_id,action,request_fingerprint)
   SELECT ?,?,?,?,? WHERE changes()=1`)
   .bind(payload.commandId,proposal.id,actor.deviceId,action,canonical);
  const audit=db.prepare(`INSERT INTO training_ai_proposal_audit
   (proposal_id,command_id,actor_id,action,reason,revision)
   SELECT ?,?,?,?,?,? WHERE changes()=1`)
   .bind(proposal.id,payload.commandId,actor.deviceId,action,reason.trim(),expectedRevision+1);
  try{
   const results=await db.batch([write,commands,audit]);
   if(Number(results[0].meta?.changes)!==1)
    return respond({error:"Đề xuất đã đổi trạng thái hoặc chưa qua bước xem xét; làm mới trước khi duyệt.",code:"AI_PROPOSAL_CAS_CONFLICT"},409);
  }catch(error){
   const replay=await commandReceipt();
   if(replay&&replay.proposal_id===proposal.id&&replay.actor_id===actor.deviceId&&
    replay.action===action&&replay.request_fingerprint===canonical)
    return respond({ok:true,replayed:true,proposalId:proposal.id});
   if(error instanceof Error&&/constraint|UNIQUE/i.test(error.message))
    return respond({error:"Dữ liệu đã đổi; đồng bộ trước khi thử lại.",code:"AI_PROPOSAL_CONFLICT"},409);
   throw error;
  }
  const saved=await db.prepare(`SELECT state,revision FROM training_ai_proposals WHERE proposal_id=?`)
   .bind(proposal.id).first<{state:string;revision:number}>();
  return respond({ok:true,proposalId:proposal.id,status:saved?.state??targetStatus,
   revision:saved?.revision??expectedRevision+1,
   applied:false,message:"Đã ghi quyết định; chưa thay đổi phân lớp hoặc lịch."});
 }catch(error){
  if(error instanceof SyntaxError)return respond({error:"JSON không hợp lệ."},400);
  if(error instanceof DeviceAccessError)return deviceErrorResponse(error);
  return respond({error:"Không thể kiểm chứng và lưu quyết định AI; không thay đổi phân lớp.",code:"AI_PROPOSAL_UNAVAILABLE"},503);
 }
}
