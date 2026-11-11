import {useState} from "react";
import {classKey,classNames,type ResourceKind,type TrainingBoard,type TrainingPerson,type TrainingResource,type TrainingSession} from "./training-types";
import {AppIcon,Badge,ResourceStatusBars,eligible,roomOccupancy,stateText} from "./manager-status";
import type {DetailTarget} from "./manager-details";
import styles from "./manager-command-center.module.css";

type Destination="schedule"|"people"|"class"|"room"|"building"|"settings"|"review";
type Props={
 board:TrainingBoard;
 busy:boolean;
 pendingReviewCount?:number|null;
 onNavigate:(destination:Destination)=>void;
 onOpenDetail:(target:DetailTarget)=>void;
 onAssignPerson:(person:TrainingPerson)=>void;
 onCreateResource:(kind:ResourceKind,buildingId?:string)=>void;
 onCreateSession:(roomId?:string,classId?:string)=>void;
};
function overlaps(session:TrainingSession,board:TrainingBoard){
 const from=Date.parse(board.from),to=Date.parse(board.to);
 const start=Date.parse(session.startsAt),end=Date.parse(session.endsAt);
 return session.status!=="cancelled"&&[from,to,start,end].every(Number.isFinite)&&to>from&&end>start&&start<to&&end>from;
}
export function sessionsInWindow(board:TrainingBoard):TrainingSession[]{
 return board.sessions.filter(session=>overlaps(session,board)).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.id.localeCompare(b.id));
}
export function classesInRoom(board:TrainingBoard,roomId:string):TrainingResource[]{
 const ids=new Set(sessionsInWindow(board).filter(session=>session.roomId===roomId).map(session=>session.classId));
 return board.resources.filter(resource=>resource.kind==="class"&&ids.has(resource.id));
}
/** A room is free only when its time window is valid and its parent is active. */
function activeRoom(board:TrainingBoard,room:TrainingResource){
 return room.status==="active"&&room.state!=="inactive"&&board.resources.some(parent=>parent.kind==="building"&&parent.id===room.parentId&&parent.status==="active");
}
export function roomHasNoBookings(board:TrainingBoard,roomId:string):boolean {
 const room=board.resources.find(resource=>resource.kind==="room"&&resource.id===roomId);
 if(!room||!activeRoom(board,room))return false;
 const usage=roomOccupancy(roomId,board);
 // Global occupancy is retained even when session details are scope-filtered.
 return room.bookingCount===0&&usage.valid&&usage.occupiedMinutes===0;
}
/** Surface unusable rooms and any scheduled class with staffing/capacity problems. */
export function roomNeedsAttention(board:TrainingBoard,roomId:string,windowSessions?:TrainingSession[]):boolean {
 const room=board.resources.find(resource=>resource.kind==="room"&&resource.id===roomId);
 if(!room)return false;
 if(!activeRoom(board,room))return true;
 const roomSessions=(windowSessions??sessionsInWindow(board)).filter(session=>session.roomId===roomId);
 // Scheduled uses of one physical room must not overlap, even for different classes.
 if(roomSessions.some((session,index)=>index>0&&Date.parse(session.startsAt)<Date.parse(roomSessions[index-1].endsAt)))return true;
 return roomSessions.some(session=>{
  const klass=board.resources.find(resource=>resource.kind==="class"&&resource.id===session.classId);
  const teacher=board.people.find(person=>person.id===session.teacherId);
  return !klass||klass.status!=="active"||klass.state==="overloaded"||klass.missingTeachers>0||!teacher||teacher.role!=="teacher"||!eligible(teacher)||!classNames(teacher.className).some(name=>classKey(name)===classKey(klass.name));
 });
}
function membersOfClass(people:TrainingPerson[],resource:TrainingResource){
 return people.filter(person=>(person.role==="teacher"?classNames(person.className):[person.className]).some(name=>classKey(name)===classKey(resource.name)));
}
const formatTime=(value:string)=>new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit"}).format(new Date(value));
const formatDate=(value:string)=>new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value));

export default function ManagerCommandCenter({board,busy,pendingReviewCount,onNavigate,onOpenDetail,onAssignPerson,onCreateResource,onCreateSession}:Props){
 const [buildingId,setBuildingId]=useState("");
 const [roomId,setRoomId]=useState("");
 const [classId,setClassId]=useState("");
 const [roomFilter,setRoomFilter]=useState<"all"|"free"|"attention">("all");
 const buildings=board.resources.filter(resource=>resource.kind==="building");
 const rooms=board.resources.filter(resource=>resource.kind==="room");
 const classes=board.resources.filter(resource=>resource.kind==="class");
 const activeSessions=sessionsInWindow(board);
 const selectedBuilding=buildings.find(resource=>resource.id===buildingId)||buildings[0];
 const buildingRooms=rooms.filter(resource=>resource.parentId===selectedBuilding?.id);
 const filteredRooms=buildingRooms.filter(resource=>roomFilter==="all"||(roomFilter==="free"?roomHasNoBookings(board,resource.id):roomNeedsAttention(board,resource.id,activeSessions)));
 const selectedRoom=filteredRooms.find(resource=>resource.id===roomId)||filteredRooms[0];
 const selectedRoomSessions=selectedRoom?activeSessions.filter(session=>session.roomId===selectedRoom.id):[];
 const roomClassIds=new Set(selectedRoomSessions.map(session=>session.classId));
 const roomClasses=classes.filter(resource=>roomClassIds.has(resource.id));
 const selectedClass=roomClasses.find(resource=>resource.id===classId)||roomClasses[0];
 const selectedMembers=selectedClass?membersOfClass(board.people,selectedClass):[];
 const pending=board.people.filter(person=>person.status==="pending"||!person.registered);
 const displayedPending=pendingReviewCount===undefined?pending.length:pendingReviewCount??"—";
 const blockedOrExpired=board.people.filter(person=>person.status==="blocked"||person.expired);
 const teacherCount=board.people.filter(person=>person.role==="teacher").length;
 const learnerCount=board.people.filter(person=>person.role==="learner").length;
 const urgentClasses=classes.filter(resource=>resource.status==="active"&&(resource.state==="overloaded"||resource.missingTeachers>0));
 const occupiedRoomCount=rooms.filter(room=>room.bookingCount>0).length;
 const bookingCount=rooms.reduce((sum,room)=>sum+room.bookingCount,0);
 const relevantRoomCount=rooms.filter(resource=>resource.status==="active").length;
 const metrics=[
  {label:"Học viên",value:learnerCount,icon:"people",destination:"people" as Destination,note:"Hồ sơ trong hệ thống"},
  {label:"Giảng viên / HLV",value:teacherCount,icon:"people",destination:"people" as Destination,note:"Danh sách giảng dạy"},
  {label:"Lớp học",value:classes.length,icon:"class",destination:"class" as Destination,note:urgentClasses.length+" lớp cần chú ý"},
  {label:"Phòng / Hồ",value:rooms.length,icon:"room",destination:"room" as Destination,note:occupiedRoomCount+" phòng có lịch trong khoảng"},
  {label:"Cơ sở / Tòa",value:buildings.length,icon:"building",destination:"building" as Destination,note:"Dữ liệu cơ sở đã ghi nhận"},
  {label:"Hồ sơ cần xem",value:displayedPending,icon:"people",destination:"review" as Destination,note:pendingReviewCount===null?"Mở hàng chờ xét duyệt":"Chờ duyệt / thiếu đăng ký"},
 ];
 function selectBuilding(id:string){setBuildingId(id);setRoomId("");setClassId("");setRoomFilter("all");}
 function selectRoom(id:string){setRoomId(id);setClassId("");}
 return <div className={styles.commandCenter}>
  <section className={styles.hero} aria-label="Trung tâm điều hành">
   <div><p className={styles.eyebrow}>BƠI ẾCH AI · MANAGER CONSOLE</p><h2>Trung tâm điều hành <span aria-hidden="true">✦</span></h2><p>Quản lý cơ sở, phân phòng, lớp, ca học và hồ sơ trên cùng dữ liệu điều phối.</p><small>Ảnh chụp dữ liệu lúc {formatDate(board.observedAt)} · Khoảng xem {formatDate(board.from)} – {formatDate(board.to)}</small></div>
   <button type="button" disabled={busy} onClick={()=>onCreateSession()} className={styles.heroAction}>＋ Xếp buổi học</button>
  </section>

  <section className={styles.metrics} aria-label="Thống kê quản lý">
   {metrics.map((metric,index)=><button type="button" className={styles.metricTile} data-variant={index%6} key={metric.label} onClick={()=>onNavigate(metric.destination)}>
    <AppIcon name={metric.icon}/><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small>
   </button>)}
  </section>

  <div className={styles.diagramLayout}>
   <section className={styles.diagramPanel} aria-label="Sơ đồ cơ sở tương tác">
    <div className={styles.panelHeading}><div><small>SƠ ĐỒ & GIÁM SÁT</small><h3>Hệ thống cơ sở / tòa học</h3></div><button type="button" onClick={()=>onNavigate("building")}>Danh sách tòa →</button></div>
    <div className={styles.campus} role="group" aria-label="Chọn tòa để xem phòng và lớp">
     <div className={styles.campusGlow} aria-hidden="true"/><div className={styles.campusPath} aria-hidden="true"/>
     {buildings.length?buildings.map((building,index)=>{
      const related=rooms.filter(resource=>resource.parentId===building.id);
      const activeCount=related.filter(resource=>resource.status==="active").length;
      return <button type="button" className={styles.buildingNode} data-selected={selectedBuilding?.id===building.id} data-index={index%6} key={building.id} onClick={()=>selectBuilding(building.id)} aria-pressed={selectedBuilding?.id===building.id}>
       <span className={styles.buildingIllustration} aria-hidden="true"><AppIcon name="building"/></span>
       <strong>{building.name}</strong><small>{activeCount}/{related.length} phòng hoạt động</small>
       <span className={styles.nodeState} data-status={building.status}>{building.status==="active"?"● Đang hoạt động":building.status==="unavailable"?"● Tạm ngừng":"● Đã lưu trữ"}</span>
      </button>;
     }):<div className={styles.diagramEmpty}><strong>Chưa có tòa học</strong><p>Thiết lập tòa và phòng để bắt đầu sơ đồ.</p><button type="button" onClick={()=>onCreateResource("building")} disabled={busy}>＋ Tạo tòa</button></div>}
    </div>
    <div className={styles.diagramLegend}><span><i data-state="active"/>Hoạt động</span><span><i data-state="unavailable"/>Tạm ngừng</span><span><i data-state="archived"/>Lưu trữ</span></div>
    <div className={styles.facilityTotals}><span><strong>{relevantRoomCount}</strong> phòng hoạt động</span><span><strong>{occupiedRoomCount}</strong> phòng có lịch</span><span><strong>{bookingCount}</strong> buổi trong khoảng xem</span></div>
   </section>

   <section className={styles.drillPanel} aria-label="Sơ đồ phân cấp tòa phòng lớp">
    <div className={styles.panelHeading}><div><small>PHÂN CẤP TƯƠNG TÁC</small><h3>Tòa → Phòng / Hồ → Lớp / Ca</h3></div></div>
    <div className={styles.breadcrumb}><span>{selectedBuilding?.name||"Chưa có tòa"}</span><span aria-hidden="true">›</span><span>{selectedRoom?.name||"Chưa chọn phòng"}</span><span aria-hidden="true">›</span><span>{selectedClass?.name||"Chưa có lớp"}</span></div>
    <div className={styles.drillHeading}><h4>Phòng / Hồ thuộc {selectedBuilding?.name||"tòa"}</h4><button type="button" disabled={busy||!selectedBuilding} onClick={()=>onCreateResource("room",selectedBuilding?.id)}>＋ Phòng</button></div>
    <div className={styles.roomFilters} aria-label="Lọc phòng">{([{id:"all",label:"Tất cả"},{id:"free",label:"Chưa có lịch"},{id:"attention",label:"Cần xử lý"}] as const).map(filter=><button key={filter.id} type="button" aria-pressed={roomFilter===filter.id} onClick={()=>{setRoomFilter(filter.id);setRoomId("");setClassId("");}}>{filter.label}</button>)}</div>
    <div className={styles.roomGrid}>
     {filteredRooms.map(room=>{
      const sessions=activeSessions.filter(session=>session.roomId===room.id);
      const needsAttention=roomNeedsAttention(board,room.id,activeSessions);
      return <button type="button" className={styles.roomNode} data-selected={selectedRoom?.id===room.id} key={room.id} aria-pressed={selectedRoom?.id===room.id} onClick={()=>selectRoom(room.id)}>
       <span className={styles.roomNodeHead}><AppIcon name="room"/><strong>{room.name}</strong></span>
       <small>{room.status!=="active"?"Tạm ngừng / lưu trữ":sessions.length?String(new Set(sessions.map(s=>s.classId)).size)+" lớp · "+sessions.length+" ca":room.bookingCount>0?"Có lịch ngoài phạm vi":"Chưa có ca"}</small>
       <span className={styles.roomNodeState} data-alert={needsAttention}>{needsAttention?"Cần xử lý":stateText[room.state]}</span>
      </button>;
     })}
     {!filteredRooms.length?<div className={styles.emptyCompact}>{buildingRooms.length?"Không có phòng theo bộ lọc này.":"Tòa chưa có phòng. Hãy tạo phòng trước khi xếp lịch."}</div>:null}
    </div>
    {selectedRoom?<><div className={`${styles.drillHeading} ${styles.roomContextHeading}`}><h4>{selectedRoom.name} · {roomClasses.length} lớp / {selectedRoomSessions.length} ca</h4><div className={styles.roomContextActions}><button type="button" disabled={busy} onClick={()=>onCreateSession(selectedRoom.id,selectedClass?.id)}>＋ Thêm ca</button><button type="button" onClick={()=>onOpenDetail({kind:"resource",id:selectedRoom.id})}>Chi tiết phòng →</button></div></div>
     <div className={styles.sessionList}>{selectedRoomSessions.map(session=>{
      const klass=classes.find(resource=>resource.id===session.classId);
      const teacher=board.people.find(person=>person.id===session.teacherId);
      return <button type="button" className={styles.sessionRow} key={session.id} aria-pressed={selectedClass?.id===klass?.id} onClick={()=>klass&&setClassId(klass.id)} disabled={!klass}>
       <span className={styles.sessionTime}>{formatTime(session.startsAt)} – {formatTime(session.endsAt)}</span>
       <span className={styles.sessionText}><strong>{klass?.name||"Lớp không còn trong danh sách"}</strong><small>{session.title} · {teacher?.name||"Chưa rõ HLV"}</small></span>
       <span className={styles.sessionState}>{session.status==="completed"?"Hoàn thành":"Đã xếp"}</span>
      </button>;
     })}{!selectedRoomSessions.length?<p className={styles.emptyCompact}>{selectedRoom.bookingCount>0?"Các ca của phòng trong khoảng này nằm ngoài phạm vi được xem.":"Chưa có buổi học trong khoảng đang xem. Một phòng có thể phục vụ nhiều lớp ở các khung giờ khác nhau."}</p>:null}</div>
    </>:null}
    {selectedClass?<div className={styles.classFocus}>
     <div className={styles.drillHeading}><h4>{selectedClass.name}</h4><Badge tone={selectedClass.state}>{stateText[selectedClass.state]}</Badge></div>
     <ResourceStatusBars resource={selectedClass} board={board}/>
     <div className={styles.classMembers}>{selectedMembers.filter(person=>person.role==="teacher").slice(0,3).map(person=><button type="button" key={person.id} onClick={()=>onAssignPerson(person)}>Phân công HLV: {person.name} →</button>)}</div>
     <div className={styles.classActions}><button type="button" onClick={()=>onOpenDetail({kind:"resource",id:selectedClass.id})}>Xem lớp / học viên</button><button type="button" onClick={()=>onNavigate("people")}>Phân công →</button></div>
    </div>:null}
   </section>
  </div>

  <div className={styles.bottomPanels}>
   <section className={styles.actionPanel}><div className={styles.panelHeading}><h3>Ưu tiên xử lý</h3><button type="button" onClick={()=>onNavigate("class")}>Mở quản lý →</button></div>
    <button type="button" onClick={()=>onNavigate("class")}><Badge tone={urgentClasses.length?"missing":"available"}>{urgentClasses.length}</Badge><span>Lớp quá sĩ số hoặc thiếu giảng viên</span></button>
    <button type="button" onClick={()=>onNavigate("review")}><Badge tone={displayedPending===0?"available":"missing"}>{displayedPending}</Badge><span>Hồ sơ thiếu đăng ký / chờ duyệt</span></button>
    <button type="button" onClick={()=>onNavigate("people")}><Badge tone={blockedOrExpired.length?"inactive":"available"}>{blockedOrExpired.length}</Badge><span>Hồ sơ bị khóa / hết hạn</span></button>
   </section>
   <section className={styles.actionPanel}><div className={styles.panelHeading}><h3>Lịch trong khoảng xem</h3><button type="button" onClick={()=>onNavigate("schedule")}>Toàn bộ lịch →</button></div>
    {activeSessions.slice(0,3).map(session=><button type="button" onClick={()=>onNavigate("schedule")} key={session.id}><Badge tone="full">{formatTime(session.startsAt)}</Badge><span>{session.title}<small>{classes.find(resource=>resource.id===session.classId)?.name||"Lớp không xác định"} · {rooms.find(resource=>resource.id===session.roomId)?.name||"Phòng không xác định"}</small></span></button>)}
    {!activeSessions.length?<p>Không có lịch trong khoảng đang xem.</p>:null}
   </section>
   <section className={styles.actionPanel}><div className={styles.panelHeading}><h3>Tác vụ nhanh</h3></div>
    <div className={styles.quickActionGrid}><button type="button" disabled={busy} onClick={()=>onCreateResource("class")}><AppIcon name="class"/> Tạo lớp</button><button type="button" disabled={busy} onClick={()=>onCreateResource("room")}><AppIcon name="room"/> Tạo phòng</button><button type="button" disabled={busy} onClick={()=>onCreateSession()}><AppIcon name="schedule"/> Xếp lịch</button><button type="button" onClick={()=>onNavigate("people")}><AppIcon name="people"/> Phân công</button></div>
   </section>
  </div>
 </div>;
}
