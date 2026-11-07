import { createHash } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { AccountError, AccountService, verifyPassword } from "./account-core.server";

type Scope = "learning-progress" | "study-preferences";
type EventRow = {event_id:string;scope:string;record_key:string;expected_revision:number;committed_revision:number;payload_hash:string};
const SCOPES: readonly Scope[]=["learning-progress","study-preferences"];
const ID=/^[A-Za-z0-9_-]{16,72}$/, KEY=/^[A-Za-z0-9._:-]{1,90}$/;
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
function fail(code:string,status=403):never{throw new AccountError(code,status);}
function validScope(raw:unknown):Scope {
 if(typeof raw!=="string" || !SCOPES.includes(raw as Scope))fail("SYNC_SCOPE_INVALID",400);
 return raw as Scope;
}
function validData(scope:Scope,value:unknown){
 if(!value||typeof value!=="object"||Array.isArray(value))fail("SYNC_DATA_INVALID",400);
 const fields=Object.keys(value);
 const allowed=scope==="learning-progress"
  ? ["lessonId","completedParts","lastViewedPart","elapsedSeconds"]
  : ["language","audioEnabled","fontScale","viewMode"];
 if(fields.length>8||fields.some(k=>!allowed.includes(k)))fail("SYNC_DATA_INVALID",400);
 const v=value as Record<string,unknown>;
 if(scope==="learning-progress"){
  if(typeof v.lessonId!=="string"||!KEY.test(v.lessonId))fail("SYNC_DATA_INVALID",400);
  if(v.completedParts!==undefined&&(!Array.isArray(v.completedParts)||v.completedParts.length>50
    ||v.completedParts.some(x=>typeof x!=="string"||!KEY.test(x))))fail("SYNC_DATA_INVALID",400);
  if(v.elapsedSeconds!==undefined&&(!Number.isSafeInteger(v.elapsedSeconds)||Number(v.elapsedSeconds)<0||Number(v.elapsedSeconds)>31536000))fail("SYNC_DATA_INVALID",400);
  if(v.lastViewedPart!==undefined&&(typeof v.lastViewedPart!=="string"||!KEY.test(v.lastViewedPart)))fail("SYNC_DATA_INVALID",400);
 }else{
  if(v.language!==undefined && !["vi","en","ru"].includes(String(v.language)))fail("SYNC_DATA_INVALID",400);
  if(v.audioEnabled!==undefined&&typeof v.audioEnabled!=="boolean")fail("SYNC_DATA_INVALID",400);
  if(v.fontScale!==undefined&&(!Number.isFinite(v.fontScale)||Number(v.fontScale)<0.75||Number(v.fontScale)>2))fail("SYNC_DATA_INVALID",400);
  if(v.viewMode!==undefined&&!["compact","normal","large"].includes(String(v.viewMode)))fail("SYNC_DATA_INVALID",400);
 }
 const data=JSON.stringify(value);
 if(data.length>4096)fail("SYNC_DATA_TOO_LARGE",413);
 return data;
}
export class AccountVerifiedSync {
 constructor(private db:D1Database,private accounts:AccountService){}
 private async permission(token:string,scope:Scope){
  const actor=await this.accounts.authorize(token);
  if(!actor.deviceApproved)fail("DEVICE_APPROVAL_REQUIRED");
  const row=await this.db.prepare(`SELECT enabled FROM account_sync_grants
    WHERE account_id=? AND device_id=? AND scope=?`).bind(actor.accountId,actor.deviceId,scope).first<{enabled:number}>();
  if(row?.enabled!==1)fail("SYNC_CONSENT_REQUIRED");
  return actor;
 }
 async consent(token:string,scopeRaw:unknown,enabledRaw:unknown,password:unknown) {
  const scope=validScope(scopeRaw);
  if(typeof enabledRaw!=="boolean")fail("SYNC_INPUT_INVALID",400);
  const actor=await this.accounts.session(token);
  if(!actor.deviceApproved)fail("DEVICE_APPROVAL_REQUIRED");
  if(enabledRaw)await this.accounts.authorize(token);
  const now=Date.now(), bucket="sync-stepup:"+actor.accountId;
  await this.db.prepare(`INSERT INTO account_auth_limits(bucket,window_start,attempts) VALUES(?,?,1)
    ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END,
    window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END`)
    .bind(bucket,now,now-900000,now-900000).run();
  const attempts=await this.db.prepare("SELECT attempts FROM account_auth_limits WHERE bucket=?")
    .bind(bucket).first<{attempts:number}>();
  if(!attempts||attempts.attempts>5)fail("RATE_LIMITED",429);
  const credential=await this.db.prepare("SELECT password_verifier FROM account_credentials WHERE account_id=?")
    .bind(actor.accountId).first<{password_verifier:string}>();
  if(!credential||!await verifyPassword(password,credential.password_verifier))fail("AUTH_FAILED",401);
  const res=await this.db.batch([
   this.db.prepare(`INSERT INTO account_sync_grants(account_id,device_id,scope,enabled,confirmed_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(account_id,device_id,scope) DO UPDATE SET enabled=excluded.enabled,revision=revision+1,confirmed_at=CURRENT_TIMESTAMP`)
    .bind(actor.accountId,actor.deviceId,scope,enabledRaw?1:0),
   this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose) SELECT ?,?,?,?
     WHERE changes()=1`).bind(actor.accountId,enabledRaw?"sync.consent.granted":"sync.consent.revoked",actor.deviceId,scope),
  ]);
  if(Number(res[0].meta.changes)!==1)fail("SYNC_CONSENT_CONFLICT",409);
  return {scope,enabled:enabledRaw};
 }
 private async previous(accountId:string,eventId:string) {
  return this.db.prepare("SELECT event_id,scope,record_key,expected_revision,committed_revision,payload_hash FROM account_sync_events WHERE account_id=? AND event_id=?")
   .bind(accountId,eventId).first<EventRow>();
 }
 async write(token:string,input:Record<string,unknown>){
  const scope=validScope(input.scope),eventId=input.eventId,recordKey=input.recordKey;
  const expectedRevision=input.expectedRevision;
  if(typeof eventId!=="string"||!ID.test(eventId)||typeof recordKey!=="string"||!KEY.test(recordKey)
   ||!Number.isSafeInteger(expectedRevision)||Number(expectedRevision)<0)fail("SYNC_INPUT_INVALID",400);
  const actor=await this.permission(token,scope);
  const data=validData(scope,input.data);
  const payloadHash=hash(JSON.stringify([scope,recordKey,expectedRevision,data]));
  const existing=await this.previous(actor.accountId,eventId);
  if(existing){
   if(existing.payload_hash!==payloadHash||existing.scope!==scope||existing.record_key!==recordKey)fail("SYNC_EVENT_REUSE",409);
   return {eventId,scope,recordKey,serverRevision:existing.committed_revision,acknowledged:true,replayed:true};
  }
  const write=Number(expectedRevision)===0
   ?this.db.prepare(`INSERT INTO account_sync_records(account_id,scope,record_key,revision,content_json)
     SELECT ?,?,?,1,? WHERE NOT EXISTS(SELECT 1 FROM account_sync_records WHERE account_id=? AND scope=? AND record_key=?)`)
       .bind(actor.accountId,scope,recordKey,data,actor.accountId,scope,recordKey)
   :this.db.prepare(`UPDATE account_sync_records SET revision=revision+1,content_json=?,updated_at=CURRENT_TIMESTAMP
     WHERE account_id=? AND scope=? AND record_key=? AND revision=?`)
       .bind(data,actor.accountId,scope,recordKey,expectedRevision);
  const commitRevision=Number(expectedRevision)+1;
  let result;
  try{
   result=await this.db.batch([
    write,
    this.db.prepare(`INSERT INTO account_sync_events(account_id,event_id,device_id,scope,record_key,
      expected_revision,committed_revision,payload_hash)
      SELECT ?,?,?,?,?,?,?,? WHERE changes()=1
       AND EXISTS(SELECT 1 FROM account_sync_grants WHERE account_id=? AND device_id=? AND scope=? AND enabled=1)`)
      .bind(actor.accountId,eventId,actor.deviceId,scope,recordKey,expectedRevision,commitRevision,payloadHash,
       actor.accountId,actor.deviceId,scope),
    this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
     SELECT ?,'sync.event.committed',?,? WHERE changes()=1`)
       .bind(actor.accountId,eventId,scope),
   ]);
  }catch(error){
   const committed=await this.previous(actor.accountId,eventId);
   if(committed && committed.payload_hash===payloadHash) return {
    eventId,scope,recordKey,serverRevision:committed.committed_revision,acknowledged:true,replayed:true };
   if(error instanceof Error && /SYNC_DEVICE_NOT_AUTHORIZED/i.test(error.message))fail("SYNC_CONSENT_REQUIRED",403);
   throw error;
  }
  if(Number(result[0].meta.changes)!==1||Number(result[1].meta.changes)!==1){
   const committed=await this.previous(actor.accountId,eventId);
   if(committed && committed.payload_hash===payloadHash)return {
    eventId,scope,recordKey,serverRevision:committed.committed_revision,acknowledged:true,replayed:true };
   fail("SYNC_CONFLICT",409);
  }
  return {eventId,scope,recordKey,serverRevision:commitRevision,acknowledged:true,replayed:false};
 }
 async read(token:string,scopeRaw:unknown,afterKey:unknown="",limitRaw:unknown=30) {
  const scope=validScope(scopeRaw);
  const actor=await this.permission(token,scope);
  const after=afterKey===""?"":typeof afterKey==="string"&&KEY.test(afterKey)?afterKey:fail("SYNC_INPUT_INVALID",400);
  const limit=Number(limitRaw);
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)fail("SYNC_INPUT_INVALID",400);
  const result=await this.db.prepare(`SELECT record_key,revision,content_json,updated_at FROM account_sync_records
    WHERE account_id=? AND scope=? AND record_key>? ORDER BY record_key LIMIT ?`)
   .bind(actor.accountId,scope,after,limit+1).all<{record_key:string;revision:number;content_json:string;updated_at:string}>();
  const rows=result.results??[],page=rows.slice(0,limit);
  return {scope,records:page.map(x=>({key:x.record_key,revision:x.revision,data:JSON.parse(x.content_json),
    updatedAt:x.updated_at})),nextKey:rows.length>limit?page.at(-1)?.record_key:null};
 }
}
