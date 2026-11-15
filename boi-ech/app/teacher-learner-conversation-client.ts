"use client";

type StoredCredential={version:2;privateKey:CryptoKey|null;publicKey:JsonWebKey};
export type ConversationItem={id:number;role:"teacher"|"learner";channel:"chat"|"request";message:string;subject:string;requestId:number|null;createdAt:string;senderName:string};
export type IncomingItem=ConversationItem&{learnerPersonCode:string;learnerName:string;className:string};
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
export async function conversationRequest(deviceId:string,payload:Record<string,unknown>,signal?:AbortSignal){
 if(!/^[a-f0-9]{64}$/i.test(deviceId))throw new Error("Chưa nhận diện được thiết bị.");
 const credential=await storedCredential();
 signal?.throwIfAborted();
 const challengeResponse=await fetch("/api/device",{method:"POST",credentials:"same-origin",cache:"no-store",signal,
  headers:{"content-type":"application/json"},body:JSON.stringify({action:"challenge",deviceId})});
 const challengeData=await challengeResponse.json() as {challenge?:string;error?:string};
 if(!challengeResponse.ok||!challengeData.challenge)throw new Error(challengeData.error||"Không lấy được mã xác thực.");
 const bytes=new TextEncoder().encode(`boi-ech:${deviceId}:${challengeData.challenge}`);
 const signature=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},credential.privateKey!,bytes);
 signal?.throwIfAborted();
 const response=await fetch("/api/course/conversations",{method:"POST",credentials:"same-origin",cache:"no-store",signal,
  headers:{"content-type":"application/json"},
  body:JSON.stringify({...payload,deviceId,challenge:challengeData.challenge,signature:base64Url(new Uint8Array(signature))})});
 const data=await response.json() as {error?:string;messages?:ConversationItem[];recent?:IncomingItem[];ok?:boolean;cursor?:number};
 if(!response.ok)throw new Error(data.error||"Không thể đồng bộ tin nhắn.");
 return data;
}
export const newClientEventId=()=>`conversation:${Date.now()}:${crypto.randomUUID()}`;
