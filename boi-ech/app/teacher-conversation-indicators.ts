"use client";

import {useEffect,useState} from "react";
import {conversationRequest,compactUnread,type ConversationUnread} from "./teacher-learner-conversation-client";

export {compactUnread};
const empty:ConversationUnread={chat:0,request:0};
export const showUnread=(count:number)=>Math.max(0,Math.floor(Number(count)||0));

/**
 * Teacher navigation stays mounted even when the Messages page is closed.
 * A signed inbox read is authoritative; WebSocket hints cause immediate
 * refetch. Polling is enabled only when the socket is unavailable.
 */
export function useTeacherConversationIndicators(deviceId:string,active:boolean):ConversationUnread{
 const [snapshot,setSnapshot]=useState<{deviceId:string;counts:ConversationUnread}>({deviceId:"",counts:empty});
 useEffect(()=>{
  if(!active||!/^[a-f0-9]{64}$/i.test(deviceId))return;
  let closed=false,pending=false,again=false,retries=0;
  let socket:WebSocket|null=null;
  let fallback:number|undefined,reconnect:number|undefined;
  const refresh=()=>{
   if(closed||!navigator.onLine||document.visibilityState!=="visible")return;
   if(pending){again=true;return;}
   pending=true;
   void conversationRequest(deviceId,{action:"inbox"}).then(data=>{
    if(!closed&&data.unread)setSnapshot({deviceId,counts:{
     chat:showUnread(data.unread.chat),request:showUnread(data.unread.request)
    }});
   }).catch(()=>{ /* Do not present an invented zero count if sync fails. */ })
    .finally(()=>{pending=false;if(again&&!closed){again=false;queueMicrotask(refresh);}});
  };
  const stopFallback=()=>{
   if(fallback!==undefined){window.clearInterval(fallback);fallback=undefined;}
  };
  const startFallback=()=>{
   if(closed||fallback!==undefined)return;
   fallback=window.setInterval(refresh,8000);
  };
  const retry=()=>{
   if(closed||reconnect!==undefined)return;
   const delay=Math.min(30000,750*Math.pow(2,Math.min(retries++,6)));
   reconnect=window.setTimeout(()=>{reconnect=undefined;void connect();},delay);
  };
  async function connect(){
   if(closed||!navigator.onLine||document.visibilityState!=="visible")return;
   if(socket&&(socket.readyState===WebSocket.CONNECTING||socket.readyState===WebSocket.OPEN))return;
   try{
    const session=await conversationRequest(deviceId,{action:"connect"});
    if(closed)return;
    if(session.realtime!==true||!session.ticket){startFallback();return;}
    const url=new URL("/api/course/conversations/socket",window.location.origin);
    url.protocol=url.protocol==="https:"?"wss:":"ws:";
    const ws=new WebSocket(url.toString(),["boi-ech.v16","ticket."+session.ticket]);
    socket=ws;
    ws.onopen=()=>{
     if(closed){ws.close();return;}
     retries=0;stopFallback();refresh();
    };
    ws.onmessage=(event)=>{
     if(closed||typeof event.data!=="string")return;
     try{
      if((JSON.parse(event.data) as {type?:string}).type==="conversation_changed")refresh();
     }catch{}
    };
    ws.onerror=()=>{ /* A connection failure is handled by onclose. */ };
    ws.onclose=()=>{
     if(closed||socket!==ws)return;
     socket=null;startFallback();retry();
    };
   }catch{if(!closed){startFallback();retry();}}
  }
  const wake=()=>{
   if(document.visibilityState!=="visible"||!navigator.onLine)return;
   refresh();
   if(!socket||socket.readyState===WebSocket.CLOSED){
    if(reconnect!==undefined){window.clearTimeout(reconnect);reconnect=undefined;}
    void connect();
   }
  };
  refresh();void connect();
  window.addEventListener("boi:conversation:new",refresh);
  window.addEventListener("boi:conversation:read",refresh);
  window.addEventListener("online",wake);
  document.addEventListener("visibilitychange",wake);
  return ()=>{
   closed=true;
   if(reconnect!==undefined)window.clearTimeout(reconnect);
   stopFallback();
   window.removeEventListener("boi:conversation:new",refresh);
   window.removeEventListener("boi:conversation:read",refresh);
   window.removeEventListener("online",wake);
   document.removeEventListener("visibilitychange",wake);
   socket?.close(1000,"Navigation unmounted");
  };
 },[deviceId,active]);
 return active&&snapshot.deviceId===deviceId?snapshot.counts:empty;
}
