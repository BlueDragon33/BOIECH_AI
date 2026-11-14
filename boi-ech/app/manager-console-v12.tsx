"use client";

import {useState,type FormEvent} from "react";
import {ManagerSheet} from "./manager-details";
import {AppIcon} from "./manager-status";
import {classKey,classNames,type TrainingBoard,type TrainingPerson,type TrainingResource,type TrainingSession,type TrainingClassLeader} from "./training-types";
import styles from "./manager-console-v12.module.css";
import {CampusBuildingArt} from "./manager-campus-illustration";

type Tab="class"|"people"|"room";
type Slot="cadre"|"student";
type Source="none"|"cadre"|"class"|"outside";
type LeaderDraft={classId:string;slot:Slot;source:Source;memberDeviceId:string;displayName:string;birthDate:string;militaryRank:string;battalion:string;expectedVersion:number};
type Props={board:TrainingBoard;tab:Tab;busy:boolean;managerName:string;
 onCommand:(payload:Record<string,unknown>)=>Promise<boolean>;
 onAssignPerson:(p:TrainingPerson,classId?:string)=>void;
 onEditResource:(r:TrainingResource)=>void;onCreateRoom:(buildingId:string)=>void;
 onEditSession:(s?:TrainingSession,roomId?:string,classId?:string)=>void;
 onWindowChange:(value:{from:string;to:string})=>void;
 onSelectPerson:(p:TrainingPerson)=>void;
};
function localDay(iso:string){const d=new Date(iso);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
function dayWindow(day:string){const d=new Date(day+"T00:00:00");if(!Number.isFinite(d.getTime()))throw new Error("Ngày chọn không hợp lệ.");const t=new Date(d);t.setDate(t.getDate()+1);return {from:d.toISOString(),to:t.toISOString()};}
function fmt(iso:string){return new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit"}).format(new Date(iso));}
function when(iso:string){return new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(iso));}
function belongs(p:TrainingPerson,c:TrainingResource){return classKey(p.className)===classKey(c.name);}
function sessionForRoom(board:TrainingBoard,id:string){return board.sessions.filter(s=>s.roomId===id&&s.status!=="cancelled").sort((a,b)=>a.startsAt.localeCompare(b.startsAt));}
function sessionState(board:TrainingBoard,sessions:TrainingSession[],resource:TrainingResource){
 if(resource.status!=="active")return "unavailable" as const;
 const now=Date.parse(board.observedAt);
 if(sessions.some(s=>Date.parse(s.startsAt)<=now&&Date.parse(s.endsAt)>now))return "occupied" as const;
 if(sessions.some(s=>Date.parse(s.startsAt)>now))return "upcoming" as const;
 return sessions.length?"scheduled" as const:"vacant" as const;
}
const stateLabel={occupied:"Đang học",upcoming:"Sắp có lịch",scheduled:"Có lịch",vacant:"Trống",unavailable:"Không khả dụng"};
function draftLeader(classId:string,slot:Slot,old?:TrainingClassLeader):LeaderDraft{
 return {classId,slot,source:old?.source==="none"?(slot==="cadre"?"cadre":"class"):old?.source??(slot==="cadre"?"cadre":"class"),
  memberDeviceId:old?.memberDeviceId??"",displayName:old?.displayName??"",birthDate:old?.birthDate??"",
  militaryRank:old?.militaryRank??"",battalion:old?.battalion??"",expectedVersion:old?.version??0};
}
export default function ManagerConsoleV12({board,tab,busy,managerName,onCommand,onAssignPerson,onEditResource,
 onCreateRoom,onEditSession,onWindowChange,onSelectPerson}:Props){
 const [query,setQuery]=useState("");
 const [selectedRoomBuilding,setSelectedRoomBuilding]=useState<string|null>(null);
 const [selectedClass,setSelectedClass]=useState<string|null>(null);
 const [showUnassigned,setShowUnassigned]=useState(false);
 const [leaderEditor,setLeaderEditor]=useState<LeaderDraft|null>(null);
 const [error,setError]=useState("");
 const resources=board.resources;
 const classes=resources.filter(r=>r.kind==="class");
 const buildings=resources.filter(r=>r.kind==="building");
 const teachers=board.people.filter(p=>p.role==="teacher");
 const learners=board.people.filter(p=>p.role==="learner");
 const nameOf=(id:string)=>resources.find(x=>x.id===id)?.name??"Không xác định";
 const teacherName=(id:string|null|undefined)=>id?teachers.find(p=>p.id===id)?.name??"Không có hồ sơ": "Chưa phân công";
 const matches=(text:string)=>text.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"));
 function matchesBuilding(b:TrainingResource){return matches(b.name)||resources.some(r=>r.kind==="room"&&r.parentId===b.id&&matches(r.name));}
 const visibleBuildings=buildings.filter(b=>matchesBuilding(b));
 const activeBuilding=visibleBuildings.find(b=>b.id===selectedRoomBuilding)??visibleBuildings[0]??null;
 const cls=classes.find(x=>x.id===selectedClass);
 const inClass=cls?learners.filter(p=>belongs(p,cls)):[];
 const unassigned=learners.filter(p=>p.registered&&(!p.className.trim()||!classes.some(c=>belongs(p,c))));
 const editorClass=classes.find(c=>c.id===leaderEditor?.classId);
 const notInClass=editorClass?learners.filter(p=>p.registered&&!belongs(p,editorClass)):[];
 const leader=(id:string,slot:Slot)=>board.leaders?.find(l=>l.classId===id&&l.slot===slot);
 const todaySessions=board.sessions.filter(s=>s.status!=="cancelled");
 const observed=Date.parse(board.observedAt);
 const observedLabel=when(board.observedAt);

 function openLeader(classId:string,slot:Slot){setSelectedClass(null);setLeaderEditor(draftLeader(classId,slot,leader(classId,slot)));setError("");}
 async function saveLeader(event:FormEvent){
  event.preventDefault();if(!leaderEditor)return;
  setError("");
  const {classId,slot,source,memberDeviceId,displayName,birthDate,militaryRank,battalion,expectedVersion}=leaderEditor;
  const saved=await onCommand({action:"save-leader",classId,slot,source,memberDeviceId:memberDeviceId||null,
   displayName:source==="none"?null:displayName,birthDate:source==="cadre"?birthDate:null,
   militaryRank:source==="cadre"?militaryRank:null,battalion:source==="cadre"?battalion:null,expectedVersion});
  if(saved){setLeaderEditor(null);setSelectedClass(classId);}else setError("Chưa lưu được. Kiểm tra thông báo hệ thống và đồng bộ thủ công trước khi thử lại.");
 }
 async function clearLeader(){
  if(!leaderEditor)return;setError("");
  const ok=await onCommand({action:"save-leader",classId:leaderEditor.classId,slot:leaderEditor.slot,
   source:"none",memberDeviceId:null,displayName:null,birthDate:null,militaryRank:null,battalion:null,
   expectedVersion:leaderEditor.expectedVersion});
  if(ok){setLeaderEditor(null);setSelectedClass(leaderEditor.classId);}
  else setError("Chưa thể bỏ bổ nhiệm. Có thể dữ liệu hoặc phiên bản đã thay đổi.");
 }
 const heading=tab==="class"?"Lớp học":tab==="people"?"Nhân sự giảng viên":"Phòng học theo tòa";
 return <section className={styles.console} aria-label={"V12 · "+heading}>
  <div className={styles.hero}>
   <div><span className={styles.eyebrow}>BƠI ẾCH AI · MANAGER CONSOLE V12</span>
    <h3><AppIcon name={tab}/> {heading}</h3>
    <p>{tab==="class"?"Sĩ số, chức danh và học viên đúng lớp":tab==="people"?"Giảng viên, lớp trực tiếp dạy và phòng trong khung đang xem":"Tòa học → Phòng học → Lịch sử dụng thật"}</p>
   </div>
   <div className={styles.heroStat}><strong>{tab==="class"?classes.length:tab==="people"?teachers.length:resources.filter(r=>r.kind==="room").length}</strong><small>{tab==="class"?"Lớp":tab==="people"?"Giảng viên":"Phòng"}</small></div>
  </div>
  <div className={styles.toolbar}>
    <label>Tìm kiếm<input value={query} onChange={e=>setQuery(e.target.value)}
     placeholder={tab==="class"?"Tên lớp, khóa…":tab==="people"?"Tên giảng viên, lớp…":"Tòa, số phòng…"}/></label>
    <label>Ngày / khoảng đang xem<input aria-label="Chọn ngày học" type="date" value={localDay(board.from)}
      onChange={e=>{if(e.target.value){onWindowChange(dayWindow(e.target.value));}}}/></label>
    <span className={styles.readback}>Đọc từ máy chủ: {observedLabel}<small>Không tự đồng bộ theo timer</small></span>
  </div>
  {tab==="class"?<div className={styles.classGrid}>
   {classes.filter(c=>matches(c.name)).map(c=>{
    const students=learners.filter(p=>belongs(p,c));
    const classSessions=todaySessions.filter(s=>s.classId===c.id);
    const next=classSessions.find(s=>Date.parse(s.endsAt)>observed)??classSessions[0];
    return <article key={c.id} className={styles.classCard}>
      <button type="button" className={styles.classCardOpen} onClick={()=>{setSelectedClass(c.id);setShowUnassigned(false);}}>
       <span className={styles.classEmblem}><AppIcon name="class"/></span>
       <span><strong>{c.name}</strong><small>{c.status==="active"?"Đang hoạt động":"Tạm ngừng"}</small></span>
       <span className={styles.openChevron} aria-hidden="true">↗</span>
      </button>
      <div className={styles.metrics}>
       <span><strong>{c.learnerCount}/{c.capacity}</strong><small>Sĩ số</small></span>
       <span><strong>{c.teacherCount}</strong><small>Giảng viên</small></span>
       <span><strong>{classSessions.length}</strong><small>Buổi đã xếp</small></span>
      </div>
      <div className={styles.progress} role="progressbar" aria-label={"Sĩ số "+c.name}
        aria-valuenow={c.learnerCount} aria-valuemin={0} aria-valuemax={c.capacity}>
        <span style={{width:Math.min(100,c.learnerCount/Math.max(1,c.capacity)*100)+"%"}}/>
      </div>
      <p className={styles.cardMeta}>{next?`Phòng ${nameOf(next.roomId)} · ${fmt(next.startsAt)}–${fmt(next.endsAt)}`:"Chưa có lịch trong khoảng xem"}</p>
      <div className={styles.leaderSlots}>
       {(["cadre","student"] as const).map(slot=>{
        const l=leader(c.id,slot);
        return <button key={slot} type="button" onClick={()=>openLeader(c.id,slot)} disabled={busy}
         aria-label={(l&&l.source!=="none"?"Thay thế ":"Thêm ")+(slot==="cadre"?"Cán bộ phụ trách":"Lớp trưởng học viên")+" lớp "+c.name}>
         <span className={styles.slotIcon}>{l&&l.source!=="none"?"✦":"+"}</span>
         <span><small>{slot==="cadre"?"Cán bộ phụ trách":"Lớp trưởng (Học viên)"}</small>
          <strong>{l&&l.source!=="none"?l.displayName:"Chưa bổ nhiệm"}</strong>
          {l?.source==="outside"?<em>Chờ liên kết / phân lớp</em>:null}
         </span>
        </button>;
       })}
      </div>
      <button type="button" className={styles.detailButton} onClick={()=>{setSelectedClass(c.id);setShowUnassigned(false);}}>
       Xem học viên và phân lớp <span aria-hidden="true">→</span>
      </button>
    </article>;
   })}
   {!classes.some(c=>matches(c.name))?<p className={styles.empty}>Không có lớp phù hợp. Tạo lớp tại nút “+ Thêm lớp” phía trên.</p>:null}
  </div>:null}
  {tab==="people"?<div className={styles.staffGrid}>
   {teachers.filter(t=>matches(t.name+" "+t.className)).map(t=>{
    const assigned=classes.filter(c=>classNames(t.className).some(n=>classKey(n)===classKey(c.name)));
    const sessions=todaySessions.filter(s=>s.teacherId===t.id||s.assistantTeacherId===t.id).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
    const active=sessions.find(s=>Date.parse(s.startsAt)<=observed&&Date.parse(s.endsAt)>observed);
    return <article key={t.id} className={styles.teacherCard}>
     <button type="button" className={styles.teacherIdentity} onClick={()=>onSelectPerson(t)}>
      <span className={styles.avatar}>{t.name.slice(0,1)}</span>
      <span><strong>{t.name}</strong><small>Giảng viên · {t.recordSource==="account-first"?"Tài khoản mới":"Hồ sơ đã có"}</small></span>
      <span aria-hidden="true">↗</span>
     </button>
     <div className={styles.teacherClasses}><small>Lớp trực tiếp phụ trách</small>
      <div>{assigned.length?assigned.map(c=><span key={c.id}>{c.name}</span>):<em>Chưa phân lớp</em>}</div>
     </div>
     <div className={styles.teacherSchedule}>
      <strong>{active?"Đang giảng dạy":sessions.length?"Lịch trong khoảng xem":"Chưa có lịch"}</strong>
      {sessions.map(s=><div key={s.id}><span>{fmt(s.startsAt)}–{fmt(s.endsAt)} · {nameOf(s.classId)}</span>
       <small>{nameOf(s.roomId)} · {s.teacherId===t.id?"Giảng viên chính":"Giảng viên phụ"}
       {s.periodStart!==null?` · Tiết ${s.periodStart}–${s.periodEnd}`:""}</small></div>)}
     </div>
     <button type="button" className={styles.detailButton} onClick={()=>onAssignPerson(t)}>Phân công lớp</button>
    </article>;
   })}
   {!teachers.some(t=>matches(t.name+" "+t.className))?<p className={styles.empty}>Không tìm thấy giảng viên. Tab này không hiển thị học viên.</p>:null}
  </div>:null}
  {tab==="room"?<div className={styles.buildings}>
   <section className={styles.campusOverview} aria-label="Sơ đồ tòa học dạng trực quan">
    <div className={styles.campusTitle}><strong>Chọn tòa học</strong><small>Tòa → Phòng học → Lịch sử dụng thực tế</small></div>
    <div className={styles.campusNodes}>
     {visibleBuildings.map((b,index)=>{
      const related=resources.filter(r=>r.kind==="room"&&r.parentId===b.id);
      const busyRooms=related.filter(r=>sessionState(board,sessionForRoom(board,r.id),r)==="occupied").length;
      return <button type="button" className={styles.campusNode} aria-pressed={activeBuilding?.id===b.id}
       key={b.id} onClick={()=>setSelectedRoomBuilding(b.id)}>
       <span className={styles.campusArtwork}><CampusBuildingArt variant={index}/></span>
       <strong>{b.name}</strong><small>{related.length} phòng · {busyRooms} đang học</small>
      </button>;
     })}
    </div>
    {!buildings.length?<p className={styles.empty}>Chưa có tòa học. Mở tab Tòa học và tạo tòa đầu tiên.</p>:null}
    {buildings.length>0&&!visibleBuildings.length?<p className={styles.empty}>Không tìm thấy tòa hoặc phòng phù hợp. Thử từ khóa khác.</p>:null}
   </section>
   {visibleBuildings.filter(b=>b.id===activeBuilding?.id).map((b,index)=>{
    const rooms=resources.filter(r=>r.kind==="room"&&r.parentId===b.id);
    const occupied=rooms.filter(r=>sessionState(board,sessionForRoom(board,r.id),r)==="occupied").length;
    const available=rooms.filter(r=>sessionState(board,sessionForRoom(board,r.id),r)==="vacant").length;
    return <details key={b.id} className={styles.building} open>
     <summary><span className={styles.buildingArtwork}><CampusBuildingArt variant={index}/></span>
      <span><strong>{b.name}</strong><small>{rooms.length} phòng · {occupied} đang học · {available} trống</small></span>
      <span className={styles.openChevron}>⌄</span>
     </summary>
     <div className={styles.roomGrid}>
      {rooms.filter(r=>matches(b.name)||matches(r.name)).map(r=>{
       const schedules=sessionForRoom(board,r.id);
       const running=schedules.find(s=>Date.parse(s.startsAt)<=observed&&Date.parse(s.endsAt)>observed);
       const next=running??schedules.find(s=>Date.parse(s.startsAt)>observed)??schedules[0];
       const state=sessionState(board,schedules,r);
       return <article key={r.id} className={styles.roomCard}>
        <div className={styles.roomHeading}><span className={styles.roomIcon}><AppIcon name="room"/></span>
         <span><strong>{r.name}</strong><small>{r.capacity} chỗ</small></span><span className={styles.roomState} data-state={state}>{stateLabel[state]}</span></div>
        {next?<div className={styles.roomDetails}>
         <p><strong>Lớp:</strong> {nameOf(next.classId)}</p>
         <p><strong>Thời gian:</strong> {fmt(next.startsAt)}–{fmt(next.endsAt)}</p>
         <p><strong>Tiết:</strong> {next.periodStart!==null?`${next.periodStart}–${next.periodEnd}`:"Chưa cấu hình"}</p>
         <p><strong>GV chính:</strong> {teacherName(next.teacherId)}</p>
         <p><strong>GV phụ:</strong> {teacherName(next.assistantTeacherId)}</p>
        </div>:<p className={styles.roomFree}>Không có lịch trong khoảng đã chọn</p>}
        <div className={styles.roomActions}>
         <button type="button" onClick={()=>onEditResource(r)}>Thiết lập</button>
         <button type="button" onClick={()=>onEditSession(next,r.id,next?.classId)} disabled={busy}>Đổi lịch</button>
         <button type="button" onClick={()=>onEditSession(undefined,r.id)} disabled={busy}>+ Phân phòng</button>
        </div>
       </article>;
      })}
      {!rooms.length?<p className={styles.empty}>Tòa chưa có phòng. Thêm phòng bằng nút bên dưới.</p>:null}
     </div>
     <button type="button" className={styles.buildingAdd} disabled={busy} onClick={()=>onCreateRoom(b.id)}>+ Thêm phòng vào {b.name}</button>
    </details>;
   })}
   {!buildings.length?<p className={styles.empty}>Chưa có tòa học. Tạo Tòa tại tab Tòa học trước khi thêm phòng.</p>:null}
  </div>:null}
  {cls?<ManagerSheet title={"Lớp "+cls.name+" · Danh sách học viên"} busy={busy} onClose={()=>{setSelectedClass(null);setShowUnassigned(false);}}>
   <div className={styles.classDetail}>
    <div className={styles.hierarchy}><strong>Quyền cao nhất: Cán bộ quản lý</strong><span>{managerName}</span>
      <small>Hai chức danh bên dưới không được tự cấp quyền quản trị.</small></div>
    <div className={styles.detailSlotGrid}>
      {(["cadre","student"] as const).map(slot=>{
        const l=leader(cls.id,slot);
        return <button type="button" key={slot} disabled={busy} onClick={()=>openLeader(cls.id,slot)}>
         <span className={styles.largePlus}>{l&&l.source!=="none"?"✦":"+"}</span>
         <strong>{slot==="cadre"?"Cán bộ phụ trách (Cán bộ khung)":"Lớp trưởng học viên"}</strong>
         <span>{l&&l.source!=="none"?l.displayName:"Chưa có người"}</span>
         <small>{l?.source==="outside"?"Ngoài danh sách · Chờ liên kết":l&&l.source!=="none"?"Thay thế / xem hồ sơ":"+ Thêm người"}</small>
        </button>;
      })}
    </div>
    <div className={styles.rosterTop}><strong>Học viên thuộc lớp ({inClass.length})</strong>
      <button type="button" onClick={()=>setShowUnassigned(!showUnassigned)}>+ Thêm học viên chưa có lớp</button></div>
    {showUnassigned?<div className={styles.unassigned}><strong>Hồ sơ chưa được phân vào lớp hợp lệ ({unassigned.length})</strong>
      <p>Chọn hồ sơ để mở form phân lớp có kiểm tra xung đột. Không tự chuyển từ lớp khác.</p>
      {unassigned.map(p=><div key={p.id} className={styles.rosterRow}><span><strong>{p.name}</strong><small>{p.className||"Chưa phân lớp"} · {p.status}</small></span>
        <button type="button" disabled={busy} onClick={()=>{setSelectedClass(null);onAssignPerson(p,cls.id);}}>Chọn và phân lớp</button></div>)}
      {!unassigned.length?<p>Không có hồ sơ chưa phân lớp phù hợp.</p>:null}
    </div>:null}
    {inClass.map(p=><div key={p.id} className={styles.rosterRow}><span className={styles.avatar}>{p.name.slice(0,1)}</span>
      <span><strong>{p.name}</strong><small>{p.status==="approved"?"Đã duyệt":"Chờ xác minh"} · {p.recordSource??"Hồ sơ"}</small></span>
      <button type="button" onClick={()=>{setSelectedClass(null);onSelectPerson(p);}}>Chi tiết</button></div>)}
    {!inClass.length?<p className={styles.empty}>Lớp chưa có học viên.</p>:null}
   </div>
  </ManagerSheet>:null}
  {leaderEditor?<ManagerSheet title={(leaderEditor.expectedVersion?"Thay thế ":"Thêm ")+(leaderEditor.slot==="cadre"?"Cán bộ phụ trách":"Lớp trưởng học viên")} busy={busy} error={error}
    onClose={()=>{setLeaderEditor(null);setError("");}}>
   <form className={styles.leaderForm} onSubmit={e=>void saveLeader(e)}>
    <p className={styles.formHint}>Lớp: <strong>{nameOf(leaderEditor.classId)}</strong> · Lưu có kiểm tra phiên bản và lịch sử thay thế.</p>
    {leaderEditor.slot==="student"?<><label>Nguồn học viên<select value={leaderEditor.source}
      onChange={e=>setLeaderEditor({...leaderEditor,source:e.target.value as Source,memberDeviceId:"",displayName:""})}>
      <option value="class">Học viên đã phân vào lớp</option><option value="outside">Học viên / thông tin ngoài danh sách lớp</option>
     </select></label>
     <label>Chọn hồ sơ học viên
      <select value={leaderEditor.memberDeviceId} onChange={e=>{
       const p=learners.find(person=>person.id===e.target.value);
       setLeaderEditor({...leaderEditor,memberDeviceId:e.target.value,displayName:p?.name??""});
      }}>
       <option value="">Chọn hồ sơ hoặc nhập tên ngoài danh sách</option>
       {(leaderEditor.source==="class"?learners.filter(p=>p.registered&&classes.some(c=>c.id===leaderEditor.classId&&belongs(p,c))&&p.status==="approved"):notInClass)
         .map(p=><option key={p.id} value={p.id}>{p.name} · {p.className||"Chưa phân lớp"}</option>)}
      </select>
     </label>
     {leaderEditor.source==="outside"?<p className={styles.provisional}>Nguồn bên ngoài được lưu là chờ liên kết. Không tự tạo tài khoản, cấp quyền hoặc thay đổi sĩ số lớp.</p>:null}
    </>:null}
    <label>Họ tên<input required maxLength={80} value={leaderEditor.displayName}
       readOnly={leaderEditor.slot==="student"&&!!leaderEditor.memberDeviceId}
       onChange={e=>setLeaderEditor({...leaderEditor,displayName:e.target.value})}/></label>
    {leaderEditor.slot==="cadre"?<>
      <label>Ngày sinh<input required type="date" value={leaderEditor.birthDate}
        onChange={e=>setLeaderEditor({...leaderEditor,birthDate:e.target.value})}/></label>
      <label>Quân hàm<input required maxLength={60} value={leaderEditor.militaryRank}
        onChange={e=>setLeaderEditor({...leaderEditor,militaryRank:e.target.value})}/></label>
      <label>Tiểu đoàn<input required maxLength={60} value={leaderEditor.battalion}
        onChange={e=>setLeaderEditor({...leaderEditor,battalion:e.target.value})}/></label>
    </>:null}
    <div className={styles.formActions}><button disabled={busy} type="submit" className={styles.save}>Lưu / Thay thế</button>
     {leaderEditor.expectedVersion>0?<button type="button" disabled={busy} onClick={()=>void clearLeader()}>Bỏ bổ nhiệm</button>:null}
     <button type="button" disabled={busy} onClick={()=>setLeaderEditor(null)}>Hủy</button>
    </div>
   </form>
   <section className={styles.history}><h4>Lịch sử thay thế (chỉ Cán bộ quản lý)</h4>
    {(board.leaderHistory??[]).filter(row=>row.classId===leaderEditor.classId&&row.slot===leaderEditor.slot).slice(0,10)
      .map(row=><p key={row.id}><strong>{row.previousDisplayName||"Chưa có người"}</strong> · {row.previousSource}
        <small>{when(row.replacedAt)} · Phiên bản {row.previousVersion}</small></p>)}
   </section>
  </ManagerSheet>:null}
 </section>;
}
