"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {classifyRosterActivity,formatRosterMoment} from "./teacher-roster-activity";

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
type RosterFilter = "all" | "recent" | "older" | "unknown";
type RosterDisplay = "list" | "grid";
const ROSTER_DISPLAY_PREFERENCE = "boi-ech:teacher-roster:view:v52";

function RosterPanel({data,loading,error,onSync}:{data:RosterResponse;loading:boolean;error:string;onSync:()=>void}){
  const [query,setQuery]=useState("");
  const [activityFilter,setActivityFilter]=useState<RosterFilter>("all");
  const [display,setDisplay]=useState<RosterDisplay>(()=>{
    try{return typeof window!=="undefined" &&
      window.localStorage.getItem(ROSTER_DISPLAY_PREFERENCE)==="grid"?"grid":"list";}
    catch{return "list";}
  });
  const [nowMs,setNowMs]=useState(()=>Date.now());
  useEffect(()=>{
    // Display-only clock: must never trigger account authorization/network calls.
    const timer=window.setInterval(()=>setNowMs(Date.now()),60_000);
    return()=>window.clearInterval(timer);
  },[]);

  const term=query.trim().toLocaleLowerCase("vi");
  const classified=data.roster.map(person=>({
    person,activity:classifyRosterActivity(person.lastSeenAt,data.syncedAt,nowMs,!error)
  }));
  const counts={
    recent:classified.filter(item=>item.activity.kind==="recent").length,
    older:classified.filter(item=>item.activity.kind==="older").length,
    unknown:classified.filter(item=>item.activity.kind==="unknown").length,
  };
  const listed=classified.filter(({person,activity})=>
    (!term||[person.name,person.className].join(" ").toLocaleLowerCase("vi").includes(term)) &&
    (activityFilter==="all"||activity.kind===activityFilter));
  const changeDisplay=(next:RosterDisplay)=>{
    setDisplay(next);
    try{window.localStorage.setItem(ROSTER_DISPLAY_PREFERENCE,next);}
    catch{/* Display preference is optional; never blocks a signed roster. */}
  };
  const snapshotFresh=Boolean(data.syncedAt) && !error &&
    Math.abs(nowMs-Date.parse(data.syncedAt))<=180_000;

  return <section className="teacher-roster-manager teacher-roster-v52" data-teacher-roster-ui aria-label="Học viên lớp phụ trách">
    <header className="teacher-roster-heading">
      <div>
        <span className="teacher-roster-eyebrow">HỌC VIÊN · LỚP PHỤ TRÁCH</span>
        <h2>Danh sách học viên đã duyệt</h2>
        <p>Tài khoản được duyệt không có nghĩa đang trực tuyến. Giảng viên chỉ được xem học viên thuộc lớp đã phân công.</p>
      </div>
      <div className="teacher-roster-heading-actions">
        <span className={snapshotFresh?"teacher-roster-snapshot fresh":"teacher-roster-snapshot stale"} role="status">
          {snapshotFresh?"Dữ liệu vừa đồng bộ":"Chưa có dữ liệu đồng bộ mới"}
        </span>
        <button type="button" disabled={loading} onClick={onSync}>
          {loading?"Đang đồng bộ…":"Làm mới dữ liệu"}
        </button>
      </div>
    </header>
    <div className="teacher-roster-summary">
      <div><strong>{data.counts.approved}</strong><span>Học viên đã duyệt</span></div>
      <div><strong>{counts.recent}</strong><span>Tương tác gần đây*</span></div>
      <div><strong>{counts.older+counts.unknown}</strong><span>Không có tín hiệu mới / chưa rõ</span></div>
      <div className="synced"><strong>{formatRosterMoment(data.syncedAt)}</strong><span>Lần đồng bộ cuối</span></div>
    </div>
    <div className="teacher-roster-toolbar">
      <label className="teacher-roster-search">
        <span className="sr-only">Tìm học viên hoặc lớp</span>
        <input value={query} onChange={event=>setQuery(event.target.value)}
          placeholder="Tìm học viên hoặc lớp…" aria-label="Tìm học viên đã duyệt"/>
      </label>
      <label className="teacher-roster-select-label">
        <span className="sr-only">Lọc theo hoạt động</span>
        <select aria-label="Lọc theo hoạt động" value={activityFilter}
          onChange={event=>setActivityFilter(event.target.value as RosterFilter)}>
          <option value="all">Mọi hoạt động</option>
          <option value="recent">Có tương tác gần đây</option>
          <option value="older">Chưa có tín hiệu mới</option>
          <option value="unknown">Chưa xác định</option>
        </select>
      </label>
      <div className="teacher-roster-display" role="group" aria-label="Kiểu xem danh sách">
        <button type="button" aria-pressed={display==="list"}
          className={display==="list"?"selected":""} onClick={()=>changeDisplay("list")}>☷ Danh sách</button>
        <button type="button" aria-pressed={display==="grid"}
          className={display==="grid"?"selected":""} onClick={()=>changeDisplay("grid")}>▦ Thẻ</button>
      </div>
    </div>
    {error?<p className="teacher-roster-error" role="alert">
      {error} · Đang hiển thị dữ liệu lần cuối, không xác nhận trạng thái trực tuyến.
    </p>:null}
    {display==="list"?
      <div className="teacher-roster-table-wrap">
        <table className="teacher-roster-table">
          <thead><tr><th>Học viên</th><th>Lớp</th><th>Tài khoản</th><th>Hoạt động ghi nhận</th><th>Lần ghi nhận cuối</th></tr></thead>
          <tbody>{listed.map(({person,activity})=>
            <tr key={person.personCode||person.name}>
              <td><div className="teacher-roster-person">
                <span className="teacher-roster-avatar" aria-hidden="true">{person.name.trim().slice(0,1).toLocaleUpperCase("vi")||"H"}</span>
                <strong>{person.name}</strong>
              </div></td>
              <td>{person.className||"Chưa có lớp"}</td>
              <td><span className="teacher-roster-status approved">Đã duyệt</span></td>
              <td><span className={`teacher-roster-activity ${activity.kind}`} title={activity.explanation}>{activity.label}</span></td>
              <td><span className="teacher-roster-lastseen">
                {activity.recordedAt!==null?<time dateTime={new Date(activity.recordedAt).toISOString()}>{formatRosterMoment(person.lastSeenAt)}</time>:"Chưa ghi nhận"}
                <small>Ghi nhận thiết bị, không phải giờ học</small>
              </span></td>
            </tr>
          )}</tbody>
        </table>
      </div>:
      <div className="teacher-roster-grid" role="list" aria-label="Thẻ học viên đã duyệt">
        {listed.map(({person,activity})=><article key={person.personCode||person.name} role="listitem">
          <header><span className="teacher-roster-avatar" aria-hidden="true">{person.name.trim().slice(0,1).toLocaleUpperCase("vi")||"H"}</span>
            <div><strong>{person.name}</strong><small>{person.className||"Chưa có lớp"}</small></div></header>
          <div className="teacher-roster-grid-badges">
            <span className="teacher-roster-status approved">Đã duyệt</span>
            <span className={`teacher-roster-activity ${activity.kind}`} title={activity.explanation}>{activity.label}</span>
          </div>
          <p>Lần ghi nhận: {formatRosterMoment(person.lastSeenAt)}</p>
        </article>)}
      </div>}
    {!listed.length?<div className="teacher-roster-empty">Không có học viên phù hợp với bộ lọc trong phạm vi lớp.</div>:null}
    <footer className="teacher-roster-disclaimer">
      * “Tương tác gần đây” chỉ có nghĩa thiết bị được xác minh trong 5 phút gần nhất và dữ liệu vừa đồng bộ.
      Không khẳng định học viên đang online, đang xem bài hay đang học. Trạng thái trực tuyến thực cần heartbeat có thời hạn và quyền hợp lệ.
    </footer>
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
