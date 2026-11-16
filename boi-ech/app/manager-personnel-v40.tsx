"use client";

import {useMemo,useState,type FormEvent} from "react";
import type {TrainingBoard,TrainingPerson,TrainingResource,TrainingTeacherClassTerm} from "./training-types";
import {classKey,classNames} from "./training-types";
import styles from "./manager-personnel-v40.module.css";

type Category="all"|"assigned"|"unassigned"|"multiple"|"needs-review";
type DeviceCategory="all"|"phone"|"tablet"|"desktop"|"unknown";
type SortKey="classes-desc"|"classes-asc"|"started-new"|"started-old"|"name";
type ClassItem={resource:TrainingResource;term?:TrainingTeacherClassTerm};
type TeacherRow={person:TrainingPerson;assigned:ClassItem[];unmatched:string[];firstStart:string|null;latestStart:string|null};
type Props={board:TrainingBoard;busy:boolean;onSelectPerson:(person:TrainingPerson)=>void;
 onAssignPerson:(person:TrainingPerson)=>void;onCommand:(payload:Record<string,unknown>)=>Promise<boolean>};
type TermDraft={classId:string;teacherDeviceId:string;startedAt:string;plannedEndAt:string;expectedVersion:number};

function Icon({name,size=21}:{name:"phone"|"tablet"|"desktop"|"users"|"layers"|"calendar"|"clock"|"search"|"check"|"alert"|"plus"|"arrow"|"edit";size?:number}){
 const shapes={
  phone:<><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></>,
  tablet:<><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 19h2"/></>,
  desktop:<><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
  users:<><circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 21v-2a6 6 0 0 1 12 0v2M14 14a6 6 0 0 1 8 5v2"/></>,
  layers:<><path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
  check:<><path d="m5 12 5 5L20 7"/></>,
  alert:<><path d="m12 2 10 19H2L12 2zM12 9v5m0 3v.01"/></>,
  plus:<><path d="M12 5v14M5 12h14"/></>,
  arrow:<><path d="M5 12h14m-6-6 6 6-6 6"/></>,
  edit:<><path d="m3 17 0 4 4 0 13-13-4-4L3 17zM14 6l4 4"/></>
 } as const;
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}
const deviceLabel:Record<Exclude<DeviceCategory,"all">,string>={
 phone:"Điện thoại",tablet:"Máy tính bảng",desktop:"Máy tính / laptop",unknown:"Chưa rõ thiết bị"
};
function dateLabel(value:string|null|undefined){
 if(!value||!Number.isFinite(Date.parse(value)))return "Chưa ghi nhận";
 return new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(value));
}
function timeLabel(value:string|null|undefined){
 if(!value||!Number.isFinite(Date.parse(value)))return "Chưa có dữ liệu";
 return new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(value));
}
function localInput(value:string|null|undefined){
 if(!value||!Number.isFinite(Date.parse(value)))return "";
 const date=new Date(value);
 const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
 return local.toISOString().slice(0,16);
}
function isoInput(value:string){
 const d=new Date(value);
 if(!value||!Number.isFinite(d.getTime()))return null;
 return d.toISOString();
}
function classRows(board:TrainingBoard):TeacherRow[]{
 const classes=board.resources.filter(r=>r.kind==="class"&&r.status==="active");
 const terms=board.teacherClassTerms??[];
 return board.people.filter(p=>p.role==="teacher").map(person=>{
  const names=[...new Map(classNames(person.className).filter(n=>!["Chưa phân công","Chưa phân lớp"].includes(n))
   .map(n=>[classKey(n),n] as const)).values()];
  const assigned=classes.filter(c=>names.some(n=>classKey(n)===classKey(c.name))).map(resource=>({
   resource,term:terms.find(x=>x.teacherDeviceId===person.id&&x.classId===resource.id&&!x.endedAt)
  }));
  const unmatched=names.filter(n=>!classes.some(c=>classKey(c.name)===classKey(n)));
  const dates=assigned.map(a=>a.term?.startedAt).filter((x):x is string=>typeof x==="string"&&Number.isFinite(Date.parse(x)));
  dates.sort((a,b)=>a.localeCompare(b));
  return {person,assigned,unmatched,firstStart:dates[0]??null,latestStart:dates.at(-1)??null};
 });
}
function categoryOf(row:TeacherRow):Exclude<Category,"all">{
 if(row.unmatched.length)return "needs-review";
 if(row.assigned.length===0)return "unassigned";
 if(row.assigned.length>1)return "multiple";
 return "assigned";
}
function summaryDevice(people:TrainingPerson[],type:Exclude<DeviceCategory,"all">){
 return people.filter(p=>p.deviceType===type).length;
}
export default function ManagerPersonnelV40({board,busy,onSelectPerson,onAssignPerson,onCommand}:Props){
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState<Category>("all");
 const [device,setDevice]=useState<DeviceCategory>("all");
 const [sort,setSort]=useState<SortKey>("classes-desc");
 const [startFrom,setStartFrom]=useState("");
 const [startTo,setStartTo]=useState("");
 const [selected,setSelected]=useState<string|null>(null);
 const [detailTab,setDetailTab]=useState<"classes"|"device">("classes");
 const [draft,setDraft]=useState<TermDraft|null>(null);
 const [error,setError]=useState("");
 const [savedNotice,setSavedNotice]=useState("");
 const rows=useMemo(()=>classRows(board),[board]);
 const byId=rows.find(r=>r.person.id===selected)??null;
 const assignedCount=rows.filter(r=>r.assigned.length>0).length;
 const unassignedCount=rows.filter(r=>r.assigned.length===0&&!r.unmatched.length).length;
 const multipleCount=rows.filter(r=>r.assigned.length>1).length;
 const needReview=rows.filter(r=>r.unmatched.length>0).length;
 const people=rows.map(r=>r.person);
 const visible=useMemo(()=>{
  const term=query.trim().toLocaleLowerCase("vi");
  const filtered=rows.filter(r=>{
   const matches=[r.person.name,r.person.code,r.person.className,...r.unmatched].join(" ").toLocaleLowerCase("vi").includes(term);
   if(!matches||device!=="all"&&r.person.deviceType!==device)return false;
   if(category==="assigned"&&!r.assigned.length)return false;
   if(category==="unassigned"&&(r.assigned.length>0||r.unmatched.length>0))return false;
   if(category==="multiple"&&r.assigned.length<=1)return false;
   if(category==="needs-review"&&!r.unmatched.length)return false;
   if(startFrom||startTo){
    const dates=r.assigned.map(a=>a.term?.startedAt).filter((s):s is string=>typeof s==="string"&&Number.isFinite(Date.parse(s)));
    if(!dates.some(s=>(!startFrom||s.slice(0,10)>=startFrom)&&(!startTo||s.slice(0,10)<=startTo)))return false;
   }
   return true;
  });
  filtered.sort((a,b)=>{
   if(sort==="classes-desc")return b.assigned.length-a.assigned.length||a.person.name.localeCompare(b.person.name,"vi");
   if(sort==="classes-asc")return a.assigned.length-b.assigned.length||a.person.name.localeCompare(b.person.name,"vi");
   if(sort==="started-new")return (b.latestStart??"").localeCompare(a.latestStart??"")||a.person.name.localeCompare(b.person.name,"vi");
   if(sort==="started-old")return (a.firstStart??"\uffff").localeCompare(b.firstStart??"\uffff")||a.person.name.localeCompare(b.person.name,"vi");
   return a.person.name.localeCompare(b.person.name,"vi");
  });
  return filtered;
 },[rows,query,device,category,sort,startFrom,startTo]);
 function openTerm(teacherDeviceId:string,record:ClassItem){
  setError("");setSavedNotice("");
  setDraft({teacherDeviceId,classId:record.resource.id,startedAt:localInput(record.term?.startedAt),
   plannedEndAt:localInput(record.term?.plannedEndAt),expectedVersion:record.term?.version??0});
 }
 async function saveTerm(event:FormEvent){
  event.preventDefault();if(!draft)return;
  setError("");setSavedNotice("");
  const startedAt=isoInput(draft.startedAt),plannedEndAt=draft.plannedEndAt?isoInput(draft.plannedEndAt):null;
  if(!startedAt||draft.plannedEndAt&&!plannedEndAt||plannedEndAt&&plannedEndAt<=startedAt){
   setError("Vui lòng nhập ngày nhận lớp hợp lệ và ngày kết thúc dự kiến phải muộn hơn ngày bắt đầu.");return;
  }
  try{
   const ok=await onCommand({action:"save-teacher-class-term",teacherDeviceId:draft.teacherDeviceId,classId:draft.classId,
    startedAt,plannedEndAt,expectedVersion:draft.expectedVersion});
   if(ok){setDraft(null);setSavedNotice("Đã lưu mốc thời gian phân công và đồng bộ từ máy chủ.");}
   else setError("Chưa lưu được. Đồng bộ lại dữ liệu và kiểm tra quyền hoặc phiên bản.");
  }catch{setError("Không thể xác minh kết quả lưu. Đồng bộ lại trước khi thử tiếp.");}
 }
 const categories:[Category,string,number][]=[
  ["all","Tất cả",rows.length],["assigned","Có lớp",assignedCount],
  ["unassigned","Chưa có lớp",unassignedCount],["multiple","Từ 2 lớp",multipleCount],
  ["needs-review","Cần đối chiếu",needReview]
 ];
 return <section className={styles.root} aria-label="Nhân sự giảng viên theo lớp và loại thiết bị">
  <header className={styles.hero}>
   <span className={styles.heroIcon}><Icon name="users" size={27}/></span>
   <div><small>QUẢN TRỊ NHÂN SỰ</small><h2>Giảng viên & phân công lớp</h2><p>Tra cứu người phụ trách, số lớp, mốc nhận lớp và thiết bị đã ghi nhận. Không suy đoán trạng thái trực tuyến.</p></div>
  </header>
  <div className={styles.metrics} aria-label="Số liệu nhân sự trong dữ liệu máy chủ">
   {[
    {id:"all" as Category,label:"Tổng giảng viên",value:rows.length,icon:"users" as const,tone:"blue"},
    {id:"assigned" as Category,label:"Đã có lớp",value:assignedCount,icon:"check" as const,tone:"green"},
    {id:"unassigned" as Category,label:"Chưa có lớp",value:unassignedCount,icon:"layers" as const,tone:"orange"},
    {id:"multiple" as Category,label:"Phụ trách từ 2 lớp",value:multipleCount,icon:"layers" as const,tone:"purple"},
    {id:"needs-review" as Category,label:"Phân công cần đối chiếu",value:needReview,icon:"alert" as const,tone:"red"}
   ].map(c=><button key={c.id} type="button" className={styles.metric} data-tone={c.tone} aria-pressed={category===c.id} onClick={()=>setCategory(c.id)}>
    <span><Icon name={c.icon} size={24}/></span><strong>{c.value}</strong><small>{c.label}</small></button>)}
  </div>
  <div className={styles.filters}>
   <div className={styles.chips} role="group" aria-label="Lọc theo phân công lớp">
    {categories.map(([id,label,count])=><button key={id} type="button" aria-pressed={category===id} onClick={()=>setCategory(id)}>{label} <b>{count}</b></button>)}
   </div>
   <div className={styles.formFilters}>
    <label>Tìm giảng viên<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Họ tên, mã, lớp…"/></label>
    <label>Thiết bị đã ghi nhận<select value={device} onChange={e=>setDevice(e.target.value as DeviceCategory)}>
     <option value="all">Tất cả thiết bị</option><option value="phone">Điện thoại</option><option value="tablet">Máy tính bảng</option><option value="desktop">Máy tính / laptop</option><option value="unknown">Chưa rõ loại</option>
    </select></label>
    <label>Sắp xếp<select value={sort} onChange={e=>setSort(e.target.value as SortKey)}>
     <option value="classes-desc">Nhiều lớp nhất trước</option><option value="classes-asc">Ít lớp nhất trước</option>
     <option value="started-new">Nhận lớp gần nhất trước</option><option value="started-old">Nhận lớp sớm nhất trước</option>
     <option value="name">Tên A → Z</option>
    </select></label>
    <label>Nhận lớp từ<input type="date" value={startFrom} max={startTo||undefined} onChange={e=>setStartFrom(e.target.value)}/></label>
    <label>Đến ngày<input type="date" value={startTo} min={startFrom||undefined} onChange={e=>setStartTo(e.target.value)}/></label>
    <button type="button" className={styles.clear} onClick={()=>{setCategory("all");setDevice("all");setSort("classes-desc");setStartFrom("");setStartTo("");setQuery("");}}>Xóa lọc</button>
   </div>
  </div>
  <div className={styles.deviceLegend} aria-label="Phân loại thiết bị trong hồ sơ">
   {(["phone","tablet","desktop","unknown"] as const).map(type=><button key={type} type="button" aria-pressed={device===type} onClick={()=>setDevice(device===type?"all":type)}>
    <Icon name={type==="unknown"?"alert":type} size={18}/><span>{deviceLabel[type]}</span><b>{summaryDevice(people,type)}</b></button>)}
   <small>Loại máy dựa trên đăng ký/nhận diện, không phải xác nhận phần cứng hoặc thiết bị đang online.</small>
  </div>
  <div className={styles.body}>
   <div className={styles.tableCard}><div className={styles.tableHeading}><strong>Danh sách giảng viên</strong><small>Hiển thị {visible.length} / {rows.length} · Các lớp chưa khớp không được tính là đã phân công hợp lệ</small></div>
    <div className={styles.scroll}><table className={styles.table}><thead><tr>
     <th scope="col">Giảng viên</th><th scope="col">Số lớp</th><th scope="col">Lớp được phân</th>
     <th scope="col">Thiết bị</th><th scope="col">Nhận lớp đầu tiên</th><th scope="col">Khoảng phân công</th><th scope="col">Trạng thái</th>
    </tr></thead><tbody>
    {visible.map(row=>{
     const statuses=row.unmatched.length?"review":!row.assigned.length?"none":"assigned";
     const endDates=row.assigned.map(a=>a.term?.plannedEndAt).filter((x):x is string=>typeof x==="string"&&Number.isFinite(Date.parse(x)));
     endDates.sort((a,b)=>a.localeCompare(b));
     return <tr key={row.person.id} data-selected={selected===row.person.id} data-state={statuses}>
      <td><button type="button" className={styles.teacherLink} onClick={()=>{setSelected(row.person.id);setDetailTab("classes");setDraft(null);}}>
       <span className={styles.avatar}>{row.person.name.charAt(0).toUpperCase()}</span><span><strong>{row.person.name}</strong><small>{row.person.code||"Chưa có mã"}</small></span></button></td>
      <td><span className={styles.classNumber}>{row.assigned.length}</span></td>
      <td><div className={styles.classChips}>{row.assigned.slice(0,4).map(a=><span key={a.resource.id}>{a.resource.name}</span>)}{row.assigned.length>4?<small>+{row.assigned.length-4}</small>:null}{!row.assigned.length?<em>Chưa có lớp hợp lệ</em>:null}</div></td>
      <td><span className={styles.devicePill}><Icon name={row.person.deviceType==="unknown"?"alert":row.person.deviceType} size={18}/>{deviceLabel[row.person.deviceType]}</span></td>
      <td>{dateLabel(row.firstStart)}</td>
      <td>{row.firstStart?dateLabel(row.firstStart)+" → "+(endDates.length?dateLabel(endDates.at(-1)):"Chưa đặt ngày kết thúc"):"Chưa ghi nhận"}</td>
      <td><span className={styles.status} data-state={statuses}>{statuses==="review"?"Cần đối chiếu":statuses==="none"?"Chưa có lớp":"Đã có lớp"}</span></td>
     </tr>;
    })}</tbody></table>
    {!visible.length?<div className={styles.empty}><Icon name="search" size={27}/><strong>Không có giảng viên khớp bộ lọc</strong><span>Kiểm tra tên, loại thiết bị và khoảng ngày; không tự bổ sung dữ liệu thiếu.</span></div>:null}
    </div>
   </div>
   <aside className={styles.details} aria-label="Chi tiết giảng viên đang chọn">
    {!byId?<div className={styles.noSelection}><Icon name="users" size={40}/><strong>Chọn một giảng viên</strong><p>Xem danh sách lớp, thời hạn từng phân công và thông tin thiết bị đã ghi nhận.</p></div>:<>
     <div className={styles.profile}><span className={styles.avatarLarge}>{byId.person.name.charAt(0).toUpperCase()}</span><div><strong>{byId.person.name}</strong><small>{byId.person.code||"Chưa có mã"}</small></div>
      <span className={styles.status} data-state={byId.unmatched.length?"review":byId.assigned.length?"assigned":"none"}>{byId.unmatched.length?"Cần đối chiếu":byId.assigned.length?"Có lớp":"Chưa có lớp"}</span></div>
     <div className={styles.detailTabs} role="group" aria-label="Chọn phần chi tiết"><button aria-pressed={detailTab==="classes"} onClick={()=>setDetailTab("classes")} type="button">Phân công lớp ({byId.assigned.length})</button><button aria-pressed={detailTab==="device"} onClick={()=>setDetailTab("device")} type="button">Thiết bị</button></div>
     {detailTab==="device"?<div className={styles.deviceDetail}><span><Icon name={byId.person.deviceType==="unknown"?"alert":byId.person.deviceType} size={34}/></span><strong>{deviceLabel[byId.person.deviceType]}</strong>
      <dl><div><dt>Loại được ghi nhận</dt><dd>{deviceLabel[byId.person.deviceType]}</dd></div><div><dt>Nền tảng</dt><dd>{byId.person.devicePlatform||"Chưa ghi nhận"}</dd></div><div><dt>Lần hoạt động ghi nhận</dt><dd>{timeLabel(byId.person.deviceLastSeenAt)}</dd></div></dl><p>Không xác nhận thiết bị đang online, không phân biệt laptop với PC chỉ từ nhóm “desktop”.</p></div>:<div className={styles.assignments}>
      {!byId.assigned.length?<p className={styles.noClass}>Giảng viên chưa có lớp hợp lệ trong danh sách hiện tại.</p>:null}
      {byId.assigned.map(a=><article className={styles.classDetail} key={a.resource.id}>
       <header><span><Icon name="layers" size={20}/></span><strong>{a.resource.name}</strong><small>{a.resource.status==="active"?"Lớp hoạt động":"Lớp không hoạt động"}</small></header>
       <dl><div><dt>Nhận lớp</dt><dd>{dateLabel(a.term?.startedAt)}</dd></div><div><dt>Hạn dự kiến</dt><dd>{a.term?.plannedEndAt?dateLabel(a.term.plannedEndAt):"Chưa ghi nhận"}</dd></div></dl>
       <button type="button" disabled={busy} onClick={()=>openTerm(byId.person.id,a)}><Icon name="edit" size={15}/> {a.term?"Chỉnh mốc phân công":"Bổ sung mốc phân công"}</button>
      </article>)}
      {byId.unmatched.length?<p className={styles.warning}>Tên lớp chưa khớp danh sách hiện có: {byId.unmatched.join(", ")}. Cần đối chiếu trước khi tính là lớp hợp lệ.</p>:null}
     </div>}
     <div className={styles.detailActions}><button type="button" disabled={busy} onClick={()=>onAssignPerson(byId.person)}><Icon name="plus" size={16}/> Phân công lớp</button>
      <button type="button" onClick={()=>onSelectPerson(byId.person)}>Xem hồ sơ</button></div>
    </>}
   </aside>
  </div>
  {savedNotice?<p role="status" className={styles.success}>{savedNotice}</p>:null}
  {draft&&byId?<div className={styles.termBackdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setDraft(null);}}><form className={styles.termDialog} role="dialog" aria-modal="true" aria-label="Cập nhật mốc phân công giảng viên" onSubmit={e=>void saveTerm(e)}>
   <header><strong>Mốc thời gian nhận lớp</strong><button type="button" onClick={()=>setDraft(null)} disabled={busy} aria-label="Đóng">×</button></header>
   <p>Giảng viên: <b>{byId.person.name}</b> · Lớp: <b>{byId.assigned.find(a=>a.resource.id===draft.classId)?.resource.name||"Không xác định"}</b></p>
   <p className={styles.termNote}>Nếu trước đây chưa lưu ngày nhận lớp, nhập từ nguồn hồ sơ phân công đã được đối chiếu. Không dùng ngày đăng ký tài khoản thay thế.</p>
   <label>Ngày, giờ bắt đầu nhận lớp <input type="datetime-local" required value={draft.startedAt} onChange={e=>setDraft({...draft,startedAt:e.target.value})}/></label>
   <label>Ngày, giờ dự kiến kết thúc (không bắt buộc) <input type="datetime-local" value={draft.plannedEndAt} min={draft.startedAt||undefined} onChange={e=>setDraft({...draft,plannedEndAt:e.target.value})}/></label>
   {error?<p role="alert" className={styles.warning}>{error}</p>:null}
   <footer><button type="button" disabled={busy} onClick={()=>setDraft(null)}>Hủy</button><button disabled={busy||!draft.startedAt} type="submit">Lưu và xác minh</button></footer>
  </form></div>:null}
 </section>;
}
