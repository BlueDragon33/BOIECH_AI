import {classKey, classNames, type TrainingBoard, type TrainingPerson, type TrainingResource} from "./training-types";
import styles from "./manager-workspace.module.css";

export type DisplayPreferences = {theme:"system"|"light"|"dark"; textSize:"standard"|"large"};
export const defaultDisplay: DisplayPreferences = {theme:"system", textSize:"standard"};
export function parseDisplayPreferences(raw:string|null):DisplayPreferences {
  try {
    const value=JSON.parse(raw||"null");
    if(!value||Array.isArray(value)||typeof value!=="object")return {...defaultDisplay};
    return {theme:["system","light","dark"].includes(value.theme)?value.theme:"system",textSize:value.textSize==="large"?"large":"standard"};
  } catch { return {...defaultDisplay}; }
}
export function eligible(person:TrainingPerson) { return person.registered&&person.status==="approved"&&!person.expired; }

export function roomOccupancy(roomId:string,board:TrainingBoard) {
  const from=Date.parse(board.from),to=Date.parse(board.to);
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return {valid:false,totalMinutes:0,occupiedMinutes:0,freeMinutes:0,percent:0,bookingCount:0};
  const intervals=board.sessions.filter(s=>s.roomId===roomId&&s.status!=="cancelled")
    .map(s=>[Math.max(from,Date.parse(s.startsAt)),Math.min(to,Date.parse(s.endsAt))])
    .filter(([start,end])=>Number.isFinite(start)&&Number.isFinite(end)&&end>start).sort((a,b)=>a[0]-b[0]);
  let covered=0,lastStart:number|null=null,lastEnd=0;
  for(const [start,end] of intervals){
    if(lastStart===null){lastStart=start;lastEnd=end;}
    else if(start>lastEnd){covered+=lastEnd-lastStart;lastStart=start;lastEnd=end;}
    else lastEnd=Math.max(lastEnd,end);
  }
  if(lastStart!==null)covered+=lastEnd-lastStart;
  const totalMinutes=(to-from)/60_000,occupiedMinutes=covered/60_000;
  return {valid:true,totalMinutes,occupiedMinutes,freeMinutes:totalMinutes-occupiedMinutes,percent:covered/(to-from)*100,bookingCount:intervals.length};
}

export function personReadiness(person:TrainingPerson,resources:TrainingResource[]) {
  const names=new Set((person.role==="teacher"?classNames(person.className):[person.className]).map(classKey));
  const assigned=resources.filter(r=>r.kind==="class"&&names.has(classKey(r.name)));
  const hasActiveClass=assigned.some(r=>r.status==="active");
  const ready=eligible(person)&&hasActiveClass;
  const label=person.status==="blocked"?"Đã khóa":!person.registered?"Chưa đủ hồ sơ":person.status==="pending"?"Chờ duyệt":person.expired?"Hết hạn":!hasActiveClass?(assigned.length?"Lớp tạm ngừng":"Chưa phân lớp"):person.bookingCount?"Đã có lịch":"Sẵn sàng xếp lịch";
  const tone=!eligible(person)?"inactive":!hasActiveClass?"missing":person.bookingCount?"full":"available";
  return {ready,label,tone,assignedClassIds:assigned.map(r=>r.id),stages:[
    {label:"Hồ sơ",complete:person.registered},
    {label:"Duyệt",complete:person.status==="approved"},
    {label:"Còn hạn",complete:!person.expired},
    {label:"Phân lớp",complete:hasActiveClass},
  ]};
}

export const stateText={available:"Còn trống",full:"Đã xếp",missing:"Còn thiếu",overloaded:"Quá sức chứa",inactive:"Tạm ngừng"};
export function Badge({tone,children}:{tone:string;children:React.ReactNode}) {
  return <span className={styles.badge} data-tone={tone}>{children}</span>;
}
function MetricBar({label,value,total,tone,detail}:{label:string;value:number;total:number;tone:string;detail:string}) {
  const maximum=Math.max(1,total),percent=Math.max(0,Math.min(100,value/maximum*100));
  return <div className={styles.metric} data-tone={tone}>
    <div className={styles.metricHeading}><span>{label}</span><strong>{value} / {total}</strong></div>
    <div className={styles.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={Math.max(0,Math.min(value,maximum))} aria-valuetext={`${value} / ${total}. ${detail}`}>
      <i style={{width:`${percent}%`}}/>
    </div>
    <span className={styles.metricDetail}>{detail}</span>
  </div>;
}
const minutes=(value:number)=>new Intl.NumberFormat("vi-VN",{maximumFractionDigits:1}).format(value);
export function ResourceStatusBars({resource:r,board}:{resource:TrainingResource;board:TrainingBoard}) {
  if(r.kind==="class")return <div className={styles.statusBars} aria-label={`Trạng thái lớp ${r.name}`}>
    <MetricBar label="Học viên" value={r.learnerCount} total={r.capacity} tone={r.learnerCount>r.capacity?"overloaded":r.state==="inactive"?"inactive":r.learnerCount>=r.capacity?"full":"available"} detail={r.learnerCount>r.capacity?`Vượt ${r.learnerCount-r.capacity} học viên`:r.remaining?`Còn ${r.remaining} chỗ học viên`:"Đã đủ học viên"}/>
    <MetricBar label="Giảng viên" value={r.teacherCount} total={r.requiredTeachers} tone={r.state==="inactive"?"inactive":r.missingTeachers?"missing":"full"} detail={r.missingTeachers?`Thiếu ${r.missingTeachers} giảng viên`:"Đủ giảng viên phụ trách"}/>
  </div>;
  if(r.kind==="room"){
    const usage=roomOccupancy(r.id,board);
    if(!usage.valid)return <p className={styles.metricDetail}>Chưa có khoảng thời gian hợp lệ.</p>;
    return <div className={styles.statusBars} aria-label={`Trạng thái phòng ${r.name}`}>
      <div className={styles.metric} data-tone={r.state==="inactive"?"inactive":usage.occupiedMinutes?"full":"available"}>
        <div className={styles.metricHeading}><span>Thời gian có lịch</span><strong>{minutes(usage.occupiedMinutes)} / {minutes(usage.totalMinutes)} phút</strong></div>
        <div className={styles.track} role="progressbar" aria-label="Thời gian phòng đã xếp" aria-valuemin={0} aria-valuemax={usage.totalMinutes} aria-valuenow={usage.occupiedMinutes} aria-valuetext={`${minutes(usage.occupiedMinutes)} phút đã xếp, tổng ${minutes(usage.freeMinutes)} phút trống`}><i style={{width:`${usage.percent}%`}}/></div>
        <span className={styles.metricDetail}>Tổng {minutes(usage.freeMinutes)} phút trống · {usage.bookingCount} buổi</span>
      </div>
    </div>;
  }
  return <div className={styles.statusBars} aria-label={`Trạng thái tòa ${r.name}`}>
    <MetricBar label="Phòng còn trống" value={r.remaining} total={r.roomCount} tone={r.status!=="active"?"inactive":"available"} detail={r.roomCount?`${r.roomCount} phòng · ${r.bookingCount} buổi trong khoảng xem`:"Chưa có phòng học"}/>
  </div>;
}

export function PersonStatusBar({person,resources}:{person:TrainingPerson;resources:TrainingResource[]}) {
  const status=personReadiness(person,resources);
  return <div className={styles.personStatus} data-tone={status.tone}>
    <div className={styles.stageStrip} role="group" aria-label={`Trạng thái hồ sơ ${person.name}`}>
      {status.stages.map(stage=><span key={stage.label} data-complete={stage.complete} aria-label={`${stage.label}: ${stage.complete?"đã có":"cần xử lý"}`}><i aria-hidden="true"/>{stage.label}</span>)}
    </div>
    <span className={styles.metricDetail}>{status.label}{person.bookingCount?` · ${person.bookingCount} buổi trong khoảng xem`:""}</span>
  </div>;
}

export function AppIcon({name}:{name:string}) {
  const paths:Record<string,React.ReactNode>={
    overview:<><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
    schedule:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/></>,
    people:<><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v2"/></>,
    class:<><path d="m2 8 10-5 10 5-10 5Zm4 3v6c4 3 8 3 12 0v-6m4-3v8"/></>,
    room:<><path d="M4 21h16M6 21V4l12-1v18M14 12h1"/></>,
    building:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h1m6 0h1m-8 4h1m6 0h1m-6 10v-6h4v6"/></>,
    settings:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></>,
  };
  return <span className={styles.appIcon} data-icon={name}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.overview}</svg></span>;
}
