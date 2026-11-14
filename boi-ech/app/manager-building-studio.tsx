"use client";

import {useState} from "react";
import {CampusBuildingArt} from "./manager-campus-illustration";
import type {TrainingBoard,TrainingResource,TrainingSession} from "./training-types";
import styles from "./manager-building-studio.module.css";

type Props={
 board:TrainingBoard; busy:boolean;
 onCreateBuilding:()=>void; onEditBuilding:(resource:TrainingResource)=>void;
 onCreateRoom:(buildingId:string)=>void; onEditRoom:(resource:TrainingResource)=>void;
 onCreateSession:(roomId:string)=>void;
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
export default function ManagerBuildingStudio({board,busy,onCreateBuilding,onEditBuilding,onCreateRoom,onEditRoom,onCreateSession}:Props){
 const [search,setSearch]=useState("");
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [statusFilter,setStatusFilter]=useState<"all"|"active"|"unavailable"|"archived">("all");
 const buildings=board.resources.filter(r=>r.kind==="building");
 const rooms=board.resources.filter(r=>r.kind==="room");
 const visible=buildings.filter(b=>(statusFilter==="all"||b.status===statusFilter)&&
  (b.name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"))||
    rooms.some(r=>r.parentId===b.id&&r.name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")))));
 const current=visible.find(b=>b.id===selectedId)??visible[0]??null;
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
  <div className={styles.campus} aria-label="Danh sách tòa học trực quan">
   <div className={styles.sky} aria-hidden="true"/>
   <div className={styles.buildingGallery}>
    {visible.map((building,index)=>{
     const linked=rooms.filter(r=>r.parentId===building.id);
     const occupied=linked.filter(r=>stateOf(board,r)==="occupied").length;
     return <button type="button" key={building.id} className={styles.buildingCard}
      aria-pressed={current?.id===building.id} onClick={()=>setSelectedId(building.id)}>
      <span className={styles.art}><CampusBuildingArt variant={index}/></span>
      <strong>{building.name}</strong>
      <span className={styles.buildingInfo}>{linked.length} phòng <span aria-hidden="true">·</span> {occupied} đang học</span>
      <span className={styles.state} data-status={building.status} data-tone={building.state}>{buildingStatus[building.status]}</span>
     </button>;
    })}
    {!visible.length?<div className={styles.noBuilding}><strong>{buildings.length?"Không có tòa phù hợp":"Chưa có tòa nhà"}</strong>
     <p>{buildings.length?"Đổi bộ lọc hoặc từ khóa để xem các tòa khác.":"Tạo tòa học đầu tiên để bắt đầu xây dựng hệ thống phòng."}</p>
     {!buildings.length?<button type="button" disabled={busy} onClick={onCreateBuilding}>＋ Tạo tòa đầu tiên</button>:null}
    </div>:null}
   </div>
  </div>
  {current?<div className={styles.detail} aria-live="polite">
    <div className={styles.detailHeader}>
     <div><span className={styles.eyebrow}>CHI TIẾT TÒA ĐANG CHỌN</span><h4>{current.name}</h4>
      <span className={styles.state} data-status={current.status} data-tone={current.state}>{buildingStatus[current.status]}</span></div>
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
    <div className={styles.roomTitle}><h4>Danh mục phòng thuộc {current.name}</h4><small>{currentRooms.length} phòng thực tế</small></div>
    <div className={styles.roomList}>
     {currentRooms.map(room=>{
      const state=stateOf(board,room),next=nextSession(board,room.id);
      const klass=next?board.resources.find(r=>r.id===next.classId)?.name:null;
      return <article className={styles.room} key={room.id}>
       <div className={styles.roomAvatar} aria-hidden="true">▦</div>
       <div className={styles.roomCopy}><strong>{room.name}</strong>
        <small>{room.capacity} chỗ · {next?(`${klass??"Lớp chưa xác định"} · ${clock(next.startsAt)}–${clock(next.endsAt)}`):"Chưa có lịch trong khoảng xem"}</small></div>
       <span className={styles.roomState} data-state={state}>{labels[state]}</span>
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
