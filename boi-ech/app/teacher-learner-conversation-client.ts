"use client";

type StoredCredential={version:2;privateKey:CryptoKey|null;publicKey:JsonWebKey};
export type ConversationItem={id:number;role:"teacher"|"learner";channel:"chat"|"request";message:string;subject:string;requestId:number|null;createdAt:string;senderName:string};
export type IncomingItem=ConversationItem&{learnerPersonCode:string;learnerName:string;className:string;unread?:boolean};
export type ConversationUnread={chat:number;request:number};
export const compactUnread=(value:number)=>value>9?"9+":String(Math.max(0,value));
export type ConversationChannel="chat"|"request";

function base64Url(bytes:Uint8Array){
 let raw="";for(const b of bytes)raw+=String.fromCharCode(b);
 return btoa(raw).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
async function storedCredential():Promise<StoredCredential>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{
  const req=indexedDB.open(document.documentElement.dataset.accountLocalDatabase||"boi-ech-doc-lap",4);
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
 try{
  const item=await new Promise<StoredCredential|undefined>((resolve,reject)=>{
   const req=db.transaction("thiet-bi","readonly").objectStore("thiet-bi").get("chinh");
   req.onsuccess=()=>resolve(req.result as StoredCredential|undefined);
   req.onerror=()=>reject(req.error);
  });
  if(!item?.privateKey||!crypto.subtle)throw new Error("Không có khóa xác thực thiết bị.");
  return item;
 }finally{db.close();}
}
// All conversation consumers share one serialized challenge/signing path.
// A teacher workspace mounts the navigation unread hook and chat view at once;
// concurrent D1 nonce writes must not turn a transient outage into a request storm.
let proofQueue:Promise<unknown>=Promise.resolve();
const transientStatus=(status:number)=>[429,500,502,503,504].includes(status);
async function signedConversationProof(deviceId:string,signal?:AbortSignal){
 const run=async()=>{
  signal?.throwIfAborted();
  const credential=await storedCredential();
  for(let attempt=0;attempt<3;attempt++){
   signal?.throwIfAborted();
   let response:Response;
   try{
    response=await fetch("/api/device",{method:"POST",credentials:"same-origin",cache:"no-store",signal,
     headers:{"content-type":"application/json"},body:JSON.stringify({action:"challenge",deviceId})});
   }catch(error){
    if(signal?.aborted||attempt===2)throw error;
    await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)));
    continue;
   }
   if(transientStatus(response.status)&&attempt<2){
    await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)));
    continue;
   }
   const data=await response.json() as {challenge?:string;error?:string;code?:string};
   if(!response.ok||!data.challenge)
    throw new Error((data.error||"Không lấy được mã xác thực.")+
     (data.code==="DEVICE_SERVICE_ERROR"?" (DEVICE_SERVICE_ERROR)":""));
   const bytes=new TextEncoder().encode(`boi-ech:${deviceId}:${data.challenge}`);
   const signature=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},credential.privateKey!,bytes);
   signal?.throwIfAborted();
   return {deviceId,challenge:data.challenge,signature:base64Url(new Uint8Array(signature))};
  }
  throw new Error("Dịch vụ xác thực thiết bị chưa phản hồi. Giữ nguyên nội dung và thử lại.");
 };
 const job=proofQueue.then(run,run);
 proofQueue=job.then(()=>undefined,()=>undefined);
 return job;
}
export async function conversationRequest(deviceId:string,payload:Record<string,unknown>,signal?:AbortSignal){
 if(!/^[a-f0-9]{64}$/i.test(deviceId))throw new Error("Chưa nhận diện được thiết bị.");
 const proof=await signedConversationProof(deviceId,signal);
 signal?.throwIfAborted();
 const response=await fetch("/api/course/conversations",{method:"POST",credentials:"same-origin",cache:"no-store",signal,
  headers:{"content-type":"application/json"},body:JSON.stringify({...payload,...proof})});
 const data=await response.json() as {error?:string;messages?:ConversationItem[];recent?:IncomingItem[];unread?:ConversationUnread;ok?:boolean;cursor?:number;realtime?:boolean;ticket?:string;mode?:string};
 if(!response.ok)throw new Error(data.error||"Không thể đồng bộ tin nhắn.");
 return data;
}
export const newClientEventId=()=>`conversation:${Date.now()}:${crypto.randomUUID()}`;
