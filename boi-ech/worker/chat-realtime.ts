/**
 * BOIECH V16: authenticated, event-only WebSocket broker.
 * Chat text stays in D1; sockets send only change hints. Clients must re-read
 * through the signed, scoped REST API. No browser polling while connected.
 */
import { DurableObject } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";

type HubEnv={DB:D1Database};
type Session={
  deviceId:string; role:"teacher"|"learner"; personCode:string;
  classes:string[]; expiresAt:number;
};
type Ticket=Session&{ticket:string; ticketExpires:number};
type Notice={
  type:"conversation_changed"; id:number; learnerDeviceId:string;
  learnerPersonCode:string; learnerClass:string;
};
const onlyCode=(value:unknown)=>typeof value==="string"&&/^[a-f0-9]{32}$/.test(value);
const validDevice=(value:unknown)=>typeof value==="string"&&/^[a-f0-9]{64}$/i.test(value);
const normalize=(value:unknown)=>String(value??"").trim().toLocaleLowerCase("vi");
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store"}});

export class ChatRealtimeHub extends DurableObject<HubEnv>{
  async fetch(req:Request):Promise<Response>{
    const path=new URL(req.url).pathname;
    if(path==="/ticket"&&req.method==="POST"){
      const item=await req.json() as Ticket;
      if(!onlyCode(item.ticket)||!validDevice(item.deviceId)||
         !["teacher","learner"].includes(item.role)||
         !Array.isArray(item.classes)||item.classes.length<1||item.classes.length>12||
         item.classes.some(v=>typeof v!=="string"||v.length>120)||
         !Number.isFinite(item.ticketExpires)||item.ticketExpires<=Date.now()||
         item.ticketExpires>Date.now()+35000||
         !Number.isFinite(item.expiresAt)||item.expiresAt<=Date.now()||
         item.expiresAt>Date.now()+180000){
        return reply({error:"Invalid realtime session"},400);
      }
      await this.ctx.storage.put("ticket:"+item.ticket,item);
      await this.ctx.storage.setAlarm(Date.now()+60000);
      return reply({ok:true});
    }
    if(path==="/socket"&&req.headers.get("upgrade")?.toLowerCase()==="websocket"){
      const protocols=(req.headers.get("sec-websocket-protocol")??"").split(",").map(x=>x.trim());
      const ticket=protocols.length===2&&protocols[0]==="boi-ech.v16"&&protocols[1].startsWith("ticket.")
        ? protocols[1].slice(7):"";
      if(!onlyCode(ticket))return reply({error:"Invalid ticket"},401);
      const found=await this.ctx.blockConcurrencyWhile(async()=>{
        const value=await this.ctx.storage.get<Ticket>("ticket:"+ticket);
        if(value)await this.ctx.storage.delete("ticket:"+ticket);
        return value;
      });
      if(!found||found.ticketExpires<=Date.now())return reply({error:"Expired ticket"},401);
      const pair=new WebSocketPair();
      const [client,server]=Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const session:Session={deviceId:found.deviceId,role:found.role,personCode:found.personCode,
        classes:found.classes.map(normalize),expiresAt:found.expiresAt};
      server.serializeAttachment(session);
      return new Response(null,{status:101,webSocket:client,headers:{"sec-websocket-protocol":"boi-ech.v16"}} as ResponseInit&{webSocket:WebSocket});
    }
    if(path==="/publish"&&req.method==="POST"){
      const notice=await req.json() as Notice;
      if(notice.type!=="conversation_changed"||!Number.isSafeInteger(notice.id)||notice.id<1||
         !validDevice(notice.learnerDeviceId)||
         typeof notice.learnerPersonCode!=="string"||
         typeof notice.learnerClass!=="string")return reply({error:"Invalid event"},400);
      const learnerClass=normalize(notice.learnerClass);
      const sockets=this.ctx.getWebSockets();
      let delivered=0;
      for(const ws of sockets){
        const session=ws.deserializeAttachment() as Session|null;
        if(!session)continue;
        if(session.expiresAt<=Date.now()){try{ws.close(1000,"Session expired");}catch{}continue;}
        const eligible=session.role==="learner"
          ?session.deviceId===notice.learnerDeviceId
          :session.classes.includes(learnerClass);
        if(!eligible)continue;
        // Recheck current D1 role, approval, scope and legacy expiry. No message
        // content is ever emitted from this broker, including on revoked sockets.
        const state=await this.env.DB.prepare(
          "SELECT person_role,status,class_name,access_expires_at FROM device_access WHERE device_id=?"
        ).bind(session.deviceId).first<{person_role:string;status:string;class_name:string;access_expires_at:string|null}>();
        const granted=state?.status==="approved"&&state.person_role===session.role&&
          !(state.access_expires_at&&Date.parse(state.access_expires_at)<=Date.now())&&
          (session.role==="learner"||String(state.class_name??"").split(/[;,\n]+/).some(c=>normalize(c)===learnerClass));
        if(!granted){try{ws.close(1008,"Access revoked");}catch{}continue;}
        try{ws.send(JSON.stringify({type:"conversation_changed",id:notice.id,
          learnerPersonCode:notice.learnerPersonCode}));delivered++;}catch{}
      }
      return reply({ok:true,delivered});
    }
    return reply({error:"Not found"},404);
  }
  async alarm(){
    const tickets=await this.ctx.storage.list<Ticket>({prefix:"ticket:"});
    for(const [key,value] of tickets){
      if(value.ticketExpires<=Date.now())await this.ctx.storage.delete(key);
    }
    if([...tickets.values()].some(v=>v.ticketExpires>Date.now())){
      await this.ctx.storage.setAlarm(Date.now()+60000);
    }
  }
  webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){
    // This is a push-only socket: messages are accepted exclusively by signed REST.
    if(message==='ping'){ws.send('pong');return;}
    try{ws.close(1008,"Push-only channel");}catch{}
  }
}
