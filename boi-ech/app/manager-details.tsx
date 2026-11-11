import {useEffect,useRef,type ReactNode} from "react";
import {classKey,classNames,type TrainingBoard,type TrainingPerson,type TrainingResource,type TrainingSession} from "./training-types";
import {Badge,PersonStatusBar,ResourceStatusBars,personReadiness,stateText} from "./manager-status";
import styles from "./manager-workspace.module.css";

export type DetailTarget={kind:"resource"|"person";id:string};
export function ManagerSheet({title,onClose,children,busy=false,error=""}:{title:string;onClose:()=>void;children:ReactNode;busy?:boolean;error?:string}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const el=dialog.current,previous=document.activeElement;
    if(el&&!el.open)el.showModal();
    return()=>{if(el?.open)el.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
  },[]);
  return <dialog ref={dialog} className={styles.sheet} aria-label={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <div className={styles.sheetHandle} aria-hidden="true"/>
    <header className={styles.sheetHeader}><h2>{title}</h2><button type="button" className={styles.closeButton} disabled={busy} onClick={onClose} aria-label="Đóng chi tiết">×</button></header>
    <div className={styles.sheetBody}>{error?<p className={styles.error} role="alert">{error}</p>:null}{children}</div>
  </dialog>;
}
export function ManagerDetailSheet({target,board,onClose,onEditResource,onAssignPerson,onEditSession,busy=false,readOnly=false}:{target:DetailTarget;board:TrainingBoard;onClose:()=>void;onEditResource:(r:TrainingResource)=>void;onAssignPerson:(p:TrainingPerson)=>void;onEditSession:(s:TrainingSession)=>void;busy?:boolean;readOnly?:boolean}) {
  const resource=target.kind==="resource"?board.resources.find(r=>r.id===target.id):undefined;
  const person=target.kind==="person"?board.people.find(p=>p.id===target.id):undefined;
  const label=(id:string)=>board.resources.find(r=>r.id===id)?.name||id;
  const belongs=(p:TrainingPerson,r:TrainingResource)=>(p.role==="teacher"?classNames(p.className):[p.className]).some(name=>classKey(name)===classKey(r.name));
  const people=resource?.kind==="class"?board.people.filter(p=>belongs(p,resource)):[];
  const rooms=resource?.kind==="building"?board.resources.filter(r=>r.kind==="room"&&r.parentId===resource.id):[];
  const classes=person?board.resources.filter(r=>r.kind==="class"&&belongs(person,r)):[];
  const sessions=board.sessions.filter(s=>resource?(resource.kind==="class"?s.classId===resource.id:resource.kind==="room"?s.roomId===resource.id:rooms.some(r=>r.id===s.roomId)):person?(person.role==="teacher"?s.teacherId===person.id:classes.some(r=>r.id===s.classId)):false).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  const date=(value:string)=>new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(value));
  return <ManagerSheet title={resource?.name||person?.name||"Không còn trong danh sách"} onClose={onClose}><fieldset className={styles.detailFieldset} disabled={busy}>
    {!resource&&!person?<p>Dữ liệu đã thay đổi. Đóng chi tiết và đồng bộ lại trước khi thao tác.</p>:null}
    {resource?<><Badge tone={resource.state}>{stateText[resource.state]}</Badge><ResourceStatusBars resource={resource} board={board}/><p>{resource.kind==="room"?`${label(resource.parentId||"")} · ${resource.capacity} chỗ`:resource.kind==="class"?"Sĩ số tính trên hồ sơ đã duyệt, còn hạn.":`${resource.roomCount} phòng học`}</p>{!readOnly?<button type="button" className={styles.primaryButton} onClick={()=>onEditResource(resource)}>Thiết lập {resource.kind==="class"?"lớp":resource.kind==="room"?"phòng":"tòa"}</button>:null}</>:null}
    {person?<><Badge tone={personReadiness(person,board.resources).tone}>{personReadiness(person,board.resources).label}</Badge><p>{person.role==="teacher"?"Giảng viên":"Học viên"} · {person.code}</p><PersonStatusBar person={person} resources={board.resources}/><p>Lớp / đơn vị: {person.className||"Chưa phân lớp"}</p>{!readOnly?<button type="button" className={styles.primaryButton} onClick={()=>onAssignPerson(person)}>Phân {person.role==="teacher"?"công lớp":"lớp"}</button>:null}</>:null}
    {people.length?<section className={styles.detailSection}><h3>Nhân sự trong lớp · {people.length}</h3>{people.map(p=><div className={styles.detailRow} key={p.id}><div><strong>{p.name}</strong><small>{p.role==="teacher"?"Giảng viên":"Học viên"} · {personReadiness(p,board.resources).label}</small></div>{!readOnly?<button type="button" onClick={()=>onAssignPerson(p)}>Phân lớp</button>:null}</div>)}</section>:resource?.kind==="class"?<p>Chưa có học viên hoặc giảng viên được phân vào lớp.</p>:null}
    {rooms.length?<section className={styles.detailSection}><h3>Phòng trong tòa</h3>{rooms.map(r=><div key={r.id} className={styles.detailRow}><div><strong>{r.name}</strong><small>{stateText[r.state]} · {r.capacity} chỗ</small></div>{!readOnly?<button type="button" onClick={()=>onEditResource(r)}>Thiết lập</button>:null}</div>)}</section>:null}
    <section className={styles.detailSection}><h3>Lịch trong khoảng đang xem · {sessions.length}</h3>{sessions.map(s=><div className={styles.detailRow} key={s.id}><div><strong>{s.title}</strong><small>{date(s.startsAt)} → {date(s.endsAt)}</small><small>{label(s.classId)} · {label(s.roomId)} · {s.status==="cancelled"?"Đã hủy":s.status==="completed"?"Hoàn thành":"Đã xếp"}</small></div>{!readOnly?<button type="button" onClick={()=>onEditSession(s)}>Đổi lịch</button>:null}</div>)}{!sessions.length?<p>Chưa có lịch liên quan trong khoảng đang xem.</p>:null}</section>
  </fieldset></ManagerSheet>;
}
