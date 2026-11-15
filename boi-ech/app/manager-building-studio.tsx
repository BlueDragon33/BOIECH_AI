"use client";

import {useState} from "react";
import ManagerCampusMap from "./manager-campus-map";
import {MainLectureHallArt} from "./manager-lecture-hall-art";
import {MAIN_LECTURE_HALL_ID,MAIN_LECTURE_HALL_NAME,existingMainLectureHall,isMainLectureHall} from "./manager-lecture-hall";
import {PracticePoolBasinArt} from "./manager-practice-pool-art";
import {PRACTICE_POOL_BUILDING_ID,PRACTICE_POOL_BUILDING_NAME,
 PRACTICE_POOL_ROOM_NAME,existingPracticePoolBuilding,existingPracticePoolRoom,
 isPracticePoolBuilding,isPracticePoolRoom} from "./manager-practice-pool";
import type {TrainingBoard,TrainingResource,TrainingSession} from "./training-types";
import styles from "./manager-building-studio.module.css";

type Props={
 board:TrainingBoard; busy:boolean;
 onCreateBuilding:()=>void; onEditBuilding:(resource:TrainingResource)=>void;
 onCreateRoom:(buildingId:string)=>void; onEditRoom:(resource:TrainingResource)=>void;
 onCreateSession:(roomId:string)=>void;
 onInstallPoolTemplate:()=>Promise<boolean>;
 onInstallMainHallTemplate:()=>Promise<boolean>;
};
function stateOf(board:TrainingBoard,room:TrainingResource){
 if(room.status!=="active")return "unavailable" as const;
 const now=Date.parse(board.observedAt);
 if(board.sessions.some(s=>s.roomId===room.id&&s.status!=="cancelled"&&Date.parse(s.startsAt)<=now&&Date.parse(s.endsAt)>now))return "occupied" as const;
 if(board.sessions.some(s=>s.roomId===room.id&&s.status!=="cancelled"))return "scheduled" as const;
 return "free" as const;
}
const labels={occupied:"Đang sử dụng",scheduled:"Có lịch",free:"Chưa có lịch",unavailable:"Không khả dụng"};
const buildingStatus={active:"Đang hoạt động",unavailable:"Tạm ngừng",archived:"Lưu trữ"};
function nextSession(board:TrainingBoard,roomId:string):TrainingSession|null{
 const valid=board.sessions.filter(s=>s.roomId===roomId&&s.status!=="cancelled").sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
 return valid.find(s=>Date.parse(s.endsAt)>Date.parse(board.observedAt))??valid[0]??null;
}
function clock(iso:string){const date=new Date(iso);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit"}).format(date):"—";}

/** Building-first editor; all numbers and writes come from the verified TrainingBoard APIs. */
export default function ManagerBuildingStudio({board,busy,onCreateBuilding,onEditBuilding,onCreateRoom,onEditRoom,onCreateSession,onInstallPoolTemplate,onInstallMainHallTemplate}:Props){
 const [search,setSearch]=useState("");
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [showPoolPreview,setShowPoolPreview]=useState(false);
 const [showMainPreview,setShowMainPreview]=useState(false);
 const [installingMain,setInstallingMain]=useState(false);
 const [installingPool,setInstallingPool]=useState(false);
 const [statusFilter,setStatusFilter]=useState<"all"|"active"|"unavailable"|"archived">("all");
 const buildings=board.resources.filter(r=>r.kind==="building");
 const rooms=board.resources.filter(r=>r.kind==="room");
 const poolBuilding=existingPracticePoolBuilding(buildings);
 const mainHall=existingMainLectureHall(buildings);
 async function installMainHall(){
  if(busy||installingMain)return;
  setInstallingMain(true);
  try{
   const created=await onInstallMainHallTemplate();
   if(created){setSelectedId(mainHall?.id??MAIN_LECTURE_HALL_ID);setShowMainPreview(false);setShowPoolPreview(false);setSearch("");setStatusFilter("all");}
  }finally{setInstallingMain(false);}
 }
 const poolRoom=poolBuilding?existingPracticePoolRoom(rooms,poolBuilding.id):undefined;
 async function installPool(){
  if(installingPool||busy)return;
  setInstallingPool(true);
  try{
   const created=await onInstallPoolTemplate();
   if(created){setSelectedId(poolBuilding?.id??PRACTICE_POOL_BUILDING_ID);setShowPoolPreview(false);setShowMainPreview(false);setSearch("");setStatusFilter("all");}
  }finally{setInstallingPool(false);}
 }
 const visible=buildings.filter(b=>(statusFilter==="all"||b.status===statusFilter)&&
  (b.name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"))||
    rooms.some(r=>r.parentId===b.id&&r.name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")))));
 const current=(showPoolPreview&&!poolBuilding)||(showMainPreview&&!mainHall)?null:(visible.find(b=>b.id===selectedId)??visible[0]??null);
 const currentRooms=current?rooms.filter(r=>r.parentId===current.id):[];
 const activeRooms=rooms.filter(r=>r.status==="active").length;
 const occupiedRooms=rooms.filter(r=>stateOf(board,r)==="occupied").length;
 const openSeats=rooms.filter(r=>r.status==="active").reduce((sum,r)=>sum+r.capacity,0);

 return <section className={styles.studio} aria-label="Xưởng quản lý và tạo tòa học">
  <div className={styles.hero}>
   <div><span className={styles.eyebrow}>BƠI ẾCH AI · BUILDING STUDIO</span>
    <h3>Quản lý hệ thống tòa học</h3>
    <p>Tạo tòa nhà, quản trị từng phòng và phân phối lịch học trên cùng dữ liệu hệ thống.</p>
   </div>
   <button type="button" className={styles.create} onClick={onCreateBuilding} disabled={busy}>＋ Tạo tòa học</button>
  </div>
  <div className={styles.metrics} aria-label="Thống kê tòa và phòng">
   <div><span>Tòa học</span><strong>{buildings.length}</strong><small>Đã ghi nhận</small></div>
   <div><span>Phòng hoạt động</span><strong>{activeRooms}</strong><small>Trên {rooms.length} phòng</small></div>
   <div><span>Phòng đang học</span><strong>{occupiedRooms}</strong><small>Tại thời điểm máy chủ ghi nhận</small></div>
   <div><span>Chỗ học tối đa</span><strong>{openSeats.toLocaleString("vi-VN")}</strong><small>Không phải số học viên hiện diện</small></div>
  </div>
  <div className={styles.toolbar}>
   <label>Tìm tòa nhà hoặc phòng<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tên tòa, tên phòng…"/></label>
   <label>Trạng thái<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}>
    <option value="all">Tất cả</option><option value="active">Đang hoạt động</option>
    <option value="unavailable">Tạm ngừng</option><option value="archived">Lưu trữ</option>
   </select></label>
   <span className={styles.readback}>Dữ liệu: {new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(board.observedAt))}</span>
  </div>
  <div className={styles.mapHead}><div><h4>Bản đồ tòa nhà</h4><p>Chọn một tòa để quản lý chi tiết hoặc thêm phòng.</p></div><strong>{visible.length} / {buildings.length} tòa</strong></div>
  <ManagerCampusMap board={board} mode="studio" busy={busy} selectedId={current?.id}
    onSelectBuilding={building=>{setSelectedId(building.id);setSearch("");setStatusFilter("all");setShowPoolPreview(false);setShowMainPreview(false);}}
    onOpenMainTemplate={()=>{setShowMainPreview(true);setShowPoolPreview(false);setSelectedId(null);}}
    onOpenPoolTemplate={()=>{setShowPoolPreview(true);setShowMainPreview(false);setSelectedId(null);}}
    onCreateBuilding={onCreateBuilding}/>
  {!mainHall&&(showMainPreview||!buildings.length)?<div className={styles.lecturePreview} aria-label="Tạo Tòa giảng đường trung tâm">
    <div className={styles.lectureArt}><MainLectureHallArt/></div>
    <div className={styles.lectureIntro}><span className={styles.eyebrow}>TÒA CHÍNH · CHƯA THÊM VÀO DỮ LIỆU</span>
      <h4>{MAIN_LECTURE_HALL_NAME}</h4>
      <p>Tòa giảng đường chính lớn nhất ở trung tâm sơ đồ. Chọn tạo để lưu tòa thật, sau đó thêm các phòng học và lịch sử dụng vào tòa.</p></div>
    <button className={styles.create} type="button" disabled={busy||installingMain}
      onClick={()=>void installMainHall()}>{installingMain?"Đang tạo và đồng bộ…":"＋ Tạo Tòa giảng đường trung tâm"}</button>
   </div>:null}
  {(!poolBuilding&&(showPoolPreview||!buildings.length))?<div className={styles.poolPreview} aria-label="Mẫu tòa bể bơi thực hành">
    <div className={styles.poolSampleArt}><PracticePoolBasinArt/></div>
    <div className={styles.poolPreviewText}>
     <span className={styles.eyebrow}>MẪU DỰNG SẴN · Chưa thêm vào dữ liệu · CHƯA TÍNH VÀO SỐ LIỆU</span>
     <h4>{PRACTICE_POOL_BUILDING_NAME}</h4>
     <p>Bên trong có 01 {PRACTICE_POOL_ROOM_NAME.toLocaleLowerCase("vi")} để bố trí các buổi học dưới nước.
      Bể mới mặc định chưa mở lịch cho đến khi cán bộ xác nhận sức chứa thật.</p>
    </div>
    <button type="button" className={styles.create} disabled={busy||installingPool}
     onClick={()=>void installPool()}>{installingPool?"Đang tạo và xác minh…":"＋ Tạo tòa và bể bơi thực hành"}</button>
   </div>:null}
  {current?<div className={styles.detail} aria-live="polite">
    <div className={styles.detailHeader}>
     <div><span className={styles.eyebrow}>CHI TIẾT TÒA ĐANG CHỌN</span><h4>{current.name}</h4>
      <span className={styles.state} data-status={current.status} data-tone={current.state}>{buildingStatus[current.status]}</span>
      {isPracticePoolBuilding(current)?<small className={styles.practiceLabel}>Khu học thực hành bơi ếch</small>:null}
      {isMainLectureHall(current)?<small className={styles.practiceLabel}>Tòa giảng đường trung tâm · Tòa chính</small>:null}</div>
     <div className={styles.actions}>
      <button type="button" onClick={()=>onEditBuilding(current)} disabled={busy}>Cấu hình tòa</button>
      <button type="button" className={styles.create} onClick={()=>onCreateRoom(current.id)} disabled={busy||current.status!=="active"}>＋ Thêm phòng</button>
     </div>
    </div>
    <div className={styles.summaryGrid}>
     <div><strong>{currentRooms.length}</strong><span>Tổng số phòng</span></div>
     <div><strong>{currentRooms.filter(r=>stateOf(board,r)==="occupied").length}</strong><span>Đang sử dụng</span></div>
     <div><strong>{currentRooms.filter(r=>stateOf(board,r)==="free").length}</strong><span>Chưa có lịch</span></div>
     <div><strong>{currentRooms.reduce((sum,r)=>sum+(r.status==="active"?r.capacity:0),0)}</strong><span>Chỗ học khả dụng</span></div>
    </div>
    {isPracticePoolBuilding(current)&&!poolRoom?<div className={styles.poolPreview}>
      <div className={styles.poolSampleArt}><PracticePoolBasinArt/></div>
      <div className={styles.poolPreviewText}><strong>Chưa có bể thực hành</strong>
       <p>Tạo bể bơi mẫu trong tòa này; khi tạo xong, nhập sức chứa thực tế và kích hoạt để xếp lịch.</p></div>
      <button type="button" className={styles.create} disabled={busy||installingPool||current.status!=="active"}
       onClick={()=>void installPool()}>{installingPool?"Đang tạo bể…":"＋ Thêm bể thực hành mẫu"}</button>
     </div>:null}
    <div className={styles.roomTitle}><h4>Danh mục {isPracticePoolBuilding(current)?"phòng / bể bơi":"phòng"} thuộc {current.name}</h4><small>{currentRooms.length} khu thực tế</small></div>
    <div className={styles.roomList}>
     {currentRooms.map(room=>{
      const state=stateOf(board,room),next=nextSession(board,room.id);
      const klass=next?board.resources.find(r=>r.id===next.classId)?.name:null;
      return <article className={styles.room} key={room.id}>
       <div className={styles.roomAvatar} aria-hidden="true">{isPracticePoolRoom(room)?<PracticePoolBasinArt/>:"▦"}</div>
       <div className={styles.roomCopy}><strong>{room.name}</strong>
        <small>{isPracticePoolRoom(room)&&room.status!=="active"?"Chờ xác nhận sức chứa · Chưa mở lịch":`${room.capacity} chỗ`} · {next?(`${klass??"Lớp chưa xác định"} · ${clock(next.startsAt)}–${clock(next.endsAt)}`):"Chưa có lịch trong khoảng xem"}</small></div>
       <span className={styles.roomState} data-state={state}>{labels[state]}</span>
       {isPracticePoolRoom(room)?<span className={styles.practiceLabel}>Thực hành dưới nước</span>:null}
       <div className={styles.roomActions}><button type="button" disabled={busy} onClick={()=>onEditRoom(room)}>Thiết lập</button>
       <button type="button" disabled={busy||room.status!=="active"} onClick={()=>onCreateSession(room.id)}>＋ Xếp lịch</button></div>
      </article>;
     })}
     {!currentRooms.length?<div className={styles.empty}><p>Tòa này chưa có phòng học. Chọn “Thêm phòng” để thiết lập phòng đầu tiên.</p>
      <button type="button" disabled={busy||current.status!=="active"} onClick={()=>onCreateRoom(current.id)}>＋ Tạo phòng</button></div>:null}
    </div>
    <p className={styles.schemaNote}>Cấu trúc dữ liệu hiện hành: Tòa học → Phòng học → Ca học / Lớp. Chưa có thực thể “tầng” hoặc “khối” riêng nên giao diện không tự giả lập số tầng; phần này cần được bổ sung vào cơ sở dữ liệu trước khi cho phép quản trị.</p>
   </div>:null}
 </section>;
}
