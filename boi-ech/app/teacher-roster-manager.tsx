"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";

type Credential={version:2;privateKey:CryptoKey|null;publicKey:JsonWebKey};
type RosterItem={name:string;personCode:string;className:string;status:"approved";lastSeenAt:string};
type RosterResponse={canManage:false;roster:RosterItem[];counts:{pending:0;approved:number;blocked:0};
  syncedAt:string;error?:string};
const EMPTY:RosterResponse={canManage:false,roster:[],counts:{pending:0,approved:0,blocked:0},syncedAt:""};
function clock(v:string|null){
  if(!v)return "Chưa đồng bộ";
  const date=new Date(v);
  return Number.isNaN(date.getTime())?"Chưa đồng bộ":
    new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"}).format(date);
}
async function credential(){
  const db=await new Promise<IDBDatabase>((ok,no)=>{
    const request=indexedDB.open(document.documentElement.dataset.accountLocalDatabase||"boi-ech-doc-lap",4);
    request.onsuccess=()=>ok(request.result);request.onerror=()=>no(request.error);
  });
  try{return await new Promise<Credential|undefined>((ok,no)=>{
    const request=db.transaction("thiet-bi","readonly").objectStore("thiet-bi").get("chinh");
    request.onsuccess=()=>ok(request.result as Credential|undefined);
    request.onerror=()=>no(request.error);
  });}finally{db.close();}
}
async function deviceIdFromKey(){
  const shell=document.querySelector<HTMLElement>(".app-shell");
  const direct=shell?.getAttribute("data-device-id")??"";
  if(/^[a-f0-9]{64}$/i.test(direct))return direct;
  const key=await credential();if(!key?.publicKey)return "";
  const p=key.publicKey;
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(
    JSON.stringify({kty:p.kty,crv:p.crv,x:p.x,y:p.y})));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function readApprovedRoster(deviceId:string){
  const key=await credential();
  if(!key?.privateKey)throw new Error("Không tìm thấy khóa P-256 của Giảng viên.");
  const challengeResponse=await fetch("/api/device",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({action:"challenge",deviceId})});
  const challenge=await challengeResponse.json() as {challenge?:string;error?:string};
  if(!challengeResponse.ok||!challenge.challenge)throw new Error(challenge.error||"Không xác minh được thiết bị.");
  const bytes=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key.privateKey,
    new TextEncoder().encode(`boi-ech:${deviceId}:${challenge.challenge}`));
  const binary=[...new Uint8Array(bytes)].map(b=>String.fromCharCode(b)).join("");
  const signature=btoa(binary).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
  const response=await fetch("/api/teacher/roster",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({action:"list",deviceId,challenge:challenge.challenge,signature})});
  const data=await response.json() as RosterResponse;
  if(!response.ok)throw new Error(data.error??"Không thể đồng bộ danh sách học viên.");
  if(data.canManage!==false)throw new Error("Máy chủ không xác nhận được chế độ chỉ đọc.");
  if(data.roster.some(person=>person.status!=="approved"))
    throw new Error("Máy chủ trả hồ sơ ngoài phạm vi học viên đã duyệt.");
  return data;
}
function CompactSync({loading,syncedAt,onSync}:{loading:boolean;syncedAt:string;onSync:()=>void}){
  return <div className="teacher-roster-sync-compact" data-teacher-roster-ui>
    <div><small>Tự đồng bộ 60 giây · Chỉ đọc</small><span>{clock(syncedAt)}</span></div>
    <button type="button" disabled={loading} onClick={onSync}>{loading?"Đang đồng bộ…":"Đồng bộ dữ liệu"}</button>
  </div>;
}
function RosterPanel({data,loading,error,onSync}:{data:RosterResponse;loading:boolean;error:string;onSync:()=>void}){
  const [query,setQuery]=useState("");
  const term=query.trim().toLocaleLowerCase("vi");
  const listed=data.roster.filter(person=>!term||
    [person.name,person.className].join(" ").toLocaleLowerCase("vi").includes(term));
  return <section className="teacher-roster-manager" data-teacher-roster-ui>
    <header><div><span>DANH SÁCH HỌC VIÊN ĐÃ DUYỆT</span><h2>Theo dõi lớp phụ trách</h2>
      <p>Chỉ xem học viên đã được Cán bộ quản lý duyệt và phân công đúng lớp.
        Giảng viên không thể duyệt, loại, khóa hay khôi phục tài khoản học viên.</p></div>
      <button type="button" disabled={loading} onClick={onSync}>{loading?"Đang đồng bộ…":"Đồng bộ dữ liệu"}</button>
    </header>
    <div className="teacher-roster-summary">
      <div><strong>{data.counts.approved}</strong><span>Học viên đã duyệt</span></div>
      <div className="synced"><strong>{clock(data.syncedAt)}</strong><span>Lần đồng bộ cuối</span></div>
    </div>
    <div className="teacher-roster-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)}
      placeholder="Tìm theo tên hoặc lớp" aria-label="Tìm học viên đã duyệt"/></div>
    {error?<p className="teacher-roster-error" role="alert">{error}</p>:null}
    <div className="teacher-roster-table-wrap"><table className="teacher-roster-table">
      <thead><tr><th>Học viên</th><th>Lớp phụ trách</th><th>Trạng thái</th><th>Hoạt động gần nhất</th></tr></thead>
      <tbody>{listed.map(person=><tr key={person.personCode||person.name}>
        <td><strong>{person.name}</strong></td><td>{person.className||"Chưa có lớp"}</td>
        <td><span className="teacher-roster-status approved">Đang học</span></td>
        <td>{clock(person.lastSeenAt)}</td>
      </tr>)}</tbody>
    </table>
    {!listed.length?<div className="teacher-roster-empty">Không có học viên đã duyệt phù hợp trong phạm vi lớp.</div>:null}
    </div>
  </section>;
}
export default function TeacherRosterManager(){
  const [mounts,setMounts]=useState<HTMLElement[]>([]);
  const [panel,setPanel]=useState<HTMLElement|null>(null);
  const [data,setData]=useState<RosterResponse>(EMPTY);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const generation=useRef(0),busy=useRef(false),device=useRef("");
  const sync=useCallback(async()=>{
    if(document.body.dataset.teacherRoleUi!=="active"||busy.current)return;
    const epoch=generation.current;
    busy.current=true;setLoading(true);setError("");
    try{
      const id=await deviceIdFromKey();
      if(!id)throw new Error("Không tìm thấy thiết bị Giảng viên đã được xác thực.");
      const result=await readApprovedRoster(id);
      if(epoch!==generation.current||document.body.dataset.teacherRoleUi!=="active")return;
      device.current=id;setData(result);
    }catch(e){if(epoch===generation.current)setError(e instanceof Error?e.message:"Không đồng bộ được học viên.");}
    finally{if(epoch===generation.current){busy.current=false;setLoading(false);}}
  },[]);
  useEffect(()=>{
    if(location.pathname!=="/")return;
    let timer=0;
    const align=()=>{
      timer=0;
      const active=document.body.dataset.teacherRoleUi==="active";
      const items=active?[...document.querySelectorAll<HTMLElement>("[data-teacher-sync-mount]")]:[];
      const panelNode=active?document.querySelector<HTMLElement>("[data-teacher-roster-manager-mount]"):null;
      setMounts(prev=>prev.length===items.length&&prev.every((node,i)=>node===items[i])?prev:items);
      setPanel(prev=>prev===panelNode?prev:panelNode);
      const liveDevice=active?document.querySelector<HTMLElement>(".app-shell")?.getAttribute("data-device-id")??"":"";
      if(active&&liveDevice&&device.current&&liveDevice!==device.current){
        // Account changes cannot leave a previous user's roster on screen.
        generation.current++;device.current="";busy.current=false;
        setData(EMPTY);setError("");setLoading(false);
      }
      if(active&&!device.current&&!busy.current)void sync();
      if(!active&&device.current){
        generation.current++;device.current="";busy.current=false;
        setData(EMPTY);setError("");setLoading(false);
      }
    };
    const schedule=()=>{if(!timer)timer=window.setTimeout(align,0);};
    schedule();
    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,
      attributeFilter:["data-teacher-role-ui","data-device-id","data-person-role"]});
    const check=window.setInterval(()=>{if(document.body.dataset.teacherRoleUi==="active")void sync();},60000);
    const onVisible=()=>{if(!document.hidden&&document.body.dataset.teacherRoleUi==="active")void sync();};
    window.addEventListener("focus",onVisible);
    return()=>{if(timer)window.clearTimeout(timer);window.clearInterval(check);
      observer.disconnect();window.removeEventListener("focus",onVisible);generation.current++;};
  },[sync]);
  return <>
    {mounts.map(node=>createPortal(<CompactSync key={node.dataset.teacherSyncMount||"teacher"} loading={loading}
      syncedAt={data.syncedAt} onSync={()=>void sync()}/>,node))}
    {panel?createPortal(<RosterPanel data={data} loading={loading} error={error}
      onSync={()=>void sync()}/>,panel):null}
  </>;
}
