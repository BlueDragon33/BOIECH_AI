"use client";
type Scope="learning-progress"|"study-preferences";
type QueueStatus="pending"|"conflict";
type QueuedEvent={eventId:string;accountId:string;scope:Scope;recordKey:string;expectedRevision:number;
 data:Record<string,unknown>;queuedAt:string;status:QueueStatus;error?:string};
type Acknowledgment={eventId:string;scope:Scope;recordKey:string;serverRevision:number;
 acknowledged:boolean;replayed:boolean};
const accountIdPattern=/^acc_[a-f0-9]{64}$/;
const keyPattern=/^[A-Za-z0-9._:-]{1,90}$/;
const scopes=new Set<Scope>(["learning-progress","study-preferences"]);
function validate(accountId:string,scope?:Scope,recordKey?:string){
 if(!accountIdPattern.test(accountId))throw new Error("ACCOUNT_ID_INVALID");
 if(scope&&!scopes.has(scope))throw new Error("SYNC_SCOPE_INVALID");
 if(recordKey&&!keyPattern.test(recordKey))throw new Error("SYNC_KEY_INVALID");
}
function openQueue(accountId:string):Promise<IDBDatabase>{
 validate(accountId);
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open("boi-ech-verified-sync-v2:"+accountId,1);
  request.onupgradeneeded=()=>{const db=request.result;
   if(!db.objectStoreNames.contains("events"))db.createObjectStore("events",{keyPath:"eventId"});};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error??new Error("SYNC_QUEUE_UNAVAILABLE"));
 });
}
function done<T>(req:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error??new Error("SYNC_LOCAL_ERROR"));
});}
async function localEvents(accountId:string):Promise<QueuedEvent[]>{
 const db=await openQueue(accountId);
 try{const values=await done(db.transaction("events","readonly").objectStore("events").getAll()) as QueuedEvent[];
  return values.sort((a,b)=>a.queuedAt.localeCompare(b.queuedAt));}
 finally{db.close();}
}
async function writeLocal(accountId:string,value:QueuedEvent){
 const db=await openQueue(accountId);
 try{const tx=db.transaction("events","readwrite");const req=tx.objectStore("events").put(value);
  await done(req);await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 finally{db.close();}
}
async function removeAcked(accountId:string,eventId:string){
 const db=await openQueue(accountId);
 try{const tx=db.transaction("events","readwrite"),store=tx.objectStore("events");
  // Delete only the exact immutable event after a matching server ACK.
  await done(store.delete(eventId));
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 finally{db.close();}
}
export async function queueVerifiedSync(accountId:string,scope:Scope,recordKey:string,expectedRevision:number,
 data:Record<string,unknown>){
 validate(accountId,scope,recordKey);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||!data||typeof data!=="object"||Array.isArray(data))
  throw new Error("SYNC_INPUT_INVALID");
 const event:QueuedEvent={eventId:crypto.randomUUID(),accountId,scope,recordKey,expectedRevision,
  data,queuedAt:new Date().toISOString(),status:"pending"};
 await writeLocal(accountId,event);
 return event.eventId;
}
export async function readPendingSync(accountId:string){
 const values=await localEvents(accountId);
 return {pending:values.filter(x=>x.status==="pending").length,
  conflicts:values.filter(x=>x.status==="conflict").length,events:values};
}
async function sessionMatches(accountId:string){
 const response=await fetch("/api/accounts",{credentials:"same-origin",cache:"no-store"});
 if(!response.ok)throw new Error("SESSION_UNAVAILABLE");
 const state=await response.json() as {account?:{accountId?:string;deviceApproved?:boolean}};
 if(state.account?.accountId!==accountId||state.account.deviceApproved!==true)throw new Error("ACCOUNT_SWITCHED");
}
const activeFlush=new Set<string>();
export async function flushVerifiedSync(accountId:string,signal?:AbortSignal):Promise<{
 sent:number;remaining:number;conflicts:number;error?:string}>{
 validate(accountId);
 if(activeFlush.has(accountId))throw new Error("SYNC_ALREADY_RUNNING");
 activeFlush.add(accountId);
 let sent=0,error="";
 try{
  await sessionMatches(accountId);
  for(const event of await localEvents(accountId)){
   if(signal?.aborted)break;
   if(event.status!=="pending"||event.accountId!==accountId)continue;
   try{
    const response=await fetch("/api/accounts/sync",{method:"POST",credentials:"same-origin",cache:"no-store",signal,
     headers:{"content-type":"application/json"},
     body:JSON.stringify({action:"write",accountId,eventId:event.eventId,scope:event.scope,recordKey:event.recordKey,
      expectedRevision:event.expectedRevision,data:event.data})});
    const data=await response.json() as {ok?:boolean;result?:Acknowledgment;code?:string;error?:string};
    if(response.status===409&&data.code==="SYNC_CONFLICT"){
     await writeLocal(accountId,{...event,status:"conflict",error:"Phiên bản đã thay đổi trên máy chủ; cần người dùng xử lý."});
     continue;
    }
    if(!response.ok||data.ok!==true){
     error=data.code??"SYNC_SERVER_UNAVAILABLE";break;
    }
    const ack=data.result;
    if(!ack?.acknowledged||ack.eventId!==event.eventId||ack.scope!==event.scope||
      ack.recordKey!==event.recordKey||ack.serverRevision!==event.expectedRevision+1){
     error="SYNC_ACK_INVALID";break;
    }
    await removeAcked(accountId,event.eventId);sent++;
   }catch(e){
    error=e instanceof Error?e.message:"SYNC_NETWORK_UNAVAILABLE";break;
   }
  }
  const status=await readPendingSync(accountId);
  return {sent,remaining:status.pending,conflicts:status.conflicts,...(error?{error}:{})};
 }finally{activeFlush.delete(accountId);}
}
export async function discardConflictedSync(accountId:string,eventId:string,confirm:boolean){
 if(!confirm)throw new Error("SYNC_CONFIRMATION_REQUIRED");
 const match=(await localEvents(accountId)).find(x=>x.eventId===eventId);
 if(!match||match.status!=="conflict")throw new Error("SYNC_CONFLICT_NOT_FOUND");
 await removeAcked(accountId,eventId);
 // Discard is explicit; never run automatically after a 409 or logout.
 return {discarded:true,eventId};
}
