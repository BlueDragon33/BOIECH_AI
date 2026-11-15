"use client";

import {MainLectureHallArt} from "./manager-lecture-hall-art";
import {CampusBuildingArt} from "./manager-campus-illustration";
import {PracticePoolBuildingArt} from "./manager-practice-pool-art";
import {MAIN_LECTURE_HALL_NAME,CAMPUS_CLASSROOM_LABELS,existingMainLectureHall,isMainLectureHall} from "./manager-lecture-hall";
import {PRACTICE_POOL_BUILDING_NAME,existingPracticePoolBuilding,isPracticePoolBuilding} from "./manager-practice-pool";
import type {TrainingBoard,TrainingResource} from "./training-types";
import styles from "./manager-campus-map.module.css";

type Props={
 board:TrainingBoard;
 mode:"overview"|"studio"|"room";
 busy?:boolean;
 selectedId?:string|null;
 onSelectBuilding:(resource:TrainingResource)=>void;
 onOpenMainTemplate:()=>void;
 onOpenPoolTemplate:()=>void;
 onCreateBuilding:()=>void;
};
type Slot={key:string;title:string;resource:TrainingResource|null;art:"main"|"pool"|"classroom";index:number};
const statusText={active:"Đang hoạt động",unavailable:"Tạm ngừng",archived:"Lưu trữ"} as const;
const norm=(s:string)=>s.trim().normalize("NFC").toLocaleLowerCase("vi");
export function campusSlots(buildings:TrainingResource[]):{main:Slot;sub:Slot[];extra:TrainingResource[]}{
 const mainResource=existingMainLectureHall(buildings)??null;
 const poolResource=existingPracticePoolBuilding(buildings)??null;
 const pool:Slot={key:"pool",title:PRACTICE_POOL_BUILDING_NAME,resource:poolResource,art:"pool",index:0};
 const assigned=new Set([mainResource?.id,poolResource?.id].filter((id):id is string=>Boolean(id)));
 const other=buildings.filter(b=>!assigned.has(b.id));
 const choose=(label:string,index:number):Slot=>{
   let match=other.find(b=>!assigned.has(b.id)&&norm(b.name)===norm(label));
   if(!match)match=other.find(b=>!assigned.has(b.id));
   if(match)assigned.add(match.id);
   return {key:label,title:label,resource:match??null,art:"classroom",index};
 };
 const a=choose(CAMPUS_CLASSROOM_LABELS[0],0);
 const b=choose(CAMPUS_CLASSROOM_LABELS[1],1);
 const c=choose(CAMPUS_CLASSROOM_LABELS[2],2);
 return {
  main:{key:"main",title:MAIN_LECTURE_HALL_NAME,resource:mainResource,art:"main",index:0},
  sub:[a,b,pool,c],
  extra:buildings.filter(b=>!assigned.has(b.id))
 };
}
function ratio(part:number,total:number){return total>0?Math.min(100,Math.round(100*part/total)):null;}
function BuildingArt({art,index}:{art:Slot["art"];index:number}){
 return art==="main"?<MainLectureHallArt/>:art==="pool"?<PracticePoolBuildingArt/>:<CampusBuildingArt variant={index}/>;
}

/** Shared true-data campus layout: a dominant lecture hall and four satellites, as in the approved mockup. */
export default function ManagerCampusMap({board,mode,busy=false,selectedId,onSelectBuilding,onOpenMainTemplate,onOpenPoolTemplate,onCreateBuilding}:Props){
 const buildings=board.resources.filter(r=>r.kind==="building");
 const rooms=board.resources.filter(r=>r.kind==="room");
 const {main,sub,extra}=campusSlots(buildings);
 const roomIds=new Set(rooms.map(r=>r.id));
 const start=Date.parse(board.from),end=Date.parse(board.to);
 const bookedIds=new Set(board.sessions.filter(s=>s.status!=="cancelled"&&roomIds.has(s.roomId)&&Date.parse(s.startsAt)<end&&Date.parse(s.endsAt)>start).map(s=>s.roomId));
 const activeBuildings=buildings.filter(b=>b.status==="active").length;
 const activeRooms=rooms.filter(r=>r.status==="active").length;
 const stats=[
  {label:"Tòa đang hoạt động",part:activeBuildings,total:buildings.length,tone:"green"},
  {label:"Phòng khả dụng",part:activeRooms,total:rooms.length,tone:"orange"},
  {label:"Phòng có lịch trong khoảng xem",part:bookedIds.size,total:rooms.length,tone:"blue"}
 ];
 const node=(slot:Slot)=>{
  const real=slot.resource, isMain=slot.key==="main";
  const linked=real?rooms.filter(r=>r.parentId===real.id):[];
  const state=real?statusText[real.status]:"Mẫu có sẵn · Chưa tạo";
  const click=()=>real?onSelectBuilding(real):isMain?onOpenMainTemplate():slot.art==="pool"?onOpenPoolTemplate():onCreateBuilding();
  const role=slot.key==="main"?"main":slot.key==="pool"?"pool":slot.key===CAMPUS_CLASSROOM_LABELS[0]?"a":slot.key===CAMPUS_CLASSROOM_LABELS[1]?"b":"c";
  return <button type="button" key={slot.key} className={styles.node} data-node={role}
    data-template={!real} data-status={real?.status??"template"}
    aria-pressed={Boolean(real&&selectedId===real.id)} disabled={busy}
    aria-label={`${real?.name??slot.title}: ${state}. ${real?"Mở phòng thuộc tòa":"Mở tạo tòa trong phân hệ Tòa học"}`}
    onClick={click}>
    <span className={styles.nodeTitle}><span className={styles.nodeSymbol} aria-hidden="true">{isMain?"▥":slot.art==="pool"?"≋":"⌂"}</span>{real?.name??slot.title}</span>
    <span className={styles.art} aria-hidden="true"><BuildingArt art={slot.art} index={slot.index}/></span>
    <span className={styles.nodeFoot}><span>{real?`${linked.length} phòng/hồ · ${linked.filter(r=>r.status==="active").length} hoạt động`:"Mẫu sơ đồ · Không tính vào số liệu"}</span>
     <span className={styles.nodeStatus} data-status={real?.status??"template"}>{state}</span></span>
   </button>;
 };
 return <section className={styles.shell} data-mode={mode} aria-label="Sơ đồ khuôn viên 3D kiểu tòa chính và các tòa phụ">
  {mode==="overview"?<aside className={styles.health} aria-label="Tình trạng khuôn viên theo dữ liệu thật">
    <span className={styles.eyebrow}>BƠI ẾCH AI · CAMPUS COMMAND</span>
    <h3>Tình trạng khuôn viên</h3>
    {stats.map(s=>{const pct=ratio(s.part,s.total);return <div className={styles.healthItem} key={s.label}>
      <div><span>{s.label}</span><strong>{pct===null?"—":`${pct}%`}</strong></div>
      <div className={styles.track} role="meter" aria-label={s.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct??undefined} aria-valuetext={pct===null?"Chưa có dữ liệu":`${s.part} trên ${s.total}`}>
       <span data-tone={s.tone} style={{width:`${pct??0}%`}}/>
      </div><small>{s.part}/{s.total} tài nguyên ghi nhận</small></div>;})}
    <p className={styles.dataNote}>Chỉ hiển thị số liệu từ hồ sơ hiện có. Tòa mẫu chưa được tạo không cộng vào tổng số.</p>
   </aside>:null}
  <div className={styles.mapArea}>
   <div className={styles.mapHeader}><span>SƠ ĐỒ CƠ SỞ · TÒA CHÍNH VÀ TÒA PHỤ</span><strong>{buildings.length} tòa đã tạo</strong></div>
   <div className={styles.scene}>
    <svg className={styles.links} viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true" focusable="false">
     <defs><filter id="campus-hub-blur"><feGaussianBlur stdDeviation="7"/></filter></defs>
     <path d="M500 485L240 280M500 485L758 280M500 485L244 580M500 485L755 580" stroke="#22bbff" strokeWidth="11" strokeLinecap="round" opacity=".65" fill="none" filter="url(#campus-hub-blur)"/>
     <path d="M500 485L240 280M500 485L758 280M500 485L244 580M500 485L755 580" stroke="#7ee9ff" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
     <circle cx="500" cy="485" r="11" fill="#b9ffff" stroke="#0d7bdf" strokeWidth="3"/>
    </svg>
    {node(main)}
    {sub.map(node)}
   </div>
   {extra.length>0?<div className={styles.extra} aria-label="Các tòa đã tạo khác"><strong>Các tòa khác · {extra.length}</strong>
      <div className={styles.extraGrid}>{extra.map((b,i)=><button key={b.id} type="button" disabled={busy}
       className={styles.extraNode} onClick={()=>onSelectBuilding(b)} aria-pressed={selectedId===b.id}>
       <span aria-hidden="true">{isMainLectureHall(b)?<MainLectureHallArt/>:isPracticePoolBuilding(b)?<PracticePoolBuildingArt/>:<CampusBuildingArt variant={i}/>}</span>
       <strong>{b.name}</strong><small>{rooms.filter(r=>r.parentId===b.id).length} phòng / hồ · {statusText[b.status]}</small></button>)}</div>
    </div>:null}
   <p className={styles.mapNote}>Chọn tòa để xem phòng và lịch. Nhãn “Mẫu có sẵn · Chưa tạo” chỉ là minh họa, không phải tòa đã được lưu.</p>
  </div>
 </section>;
}
