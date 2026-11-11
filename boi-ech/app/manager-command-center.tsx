import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {classKey,classNames,type ResourceKind,type TrainingBoard,type TrainingPerson,type TrainingResource,type TrainingSession} from "./training-types";
import {AppIcon,Badge,ResourceStatusBars,eligible,roomOccupancy,stateText} from "./manager-status";
import type {DetailTarget} from "./manager-details";
import styles from "./manager-command-center.module.css";

type Destination="schedule"|"people"|"class"|"room"|"building"|"settings"|"review";
type Props={
 board:TrainingBoard;
 busy:boolean;
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
 return usage.valid&&usage.occupiedMinutes===0;
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
function membersOfClass(board:TrainingBoard,resource:TrainingResource){
 const scheduledTeacherIds=new Set(sessionsInWindow(board).filter(session=>session.classId===resource.id).map(session=>session.teacherId));
 return board.people.filter(person=>person.role==="teacher"
   ? scheduledTeacherIds.has(person.id)||classNames(person.className).some(name=>classKey(name)===classKey(resource.name))
   : [person.className].some(name=>classKey(name)===classKey(resource.name)));
}
const formatTime=(value:string)=>new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit"}).format(new Date(value));
const formatDate=(value:string)=>new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value));

/** A real scoped class roster. Portal prevents overflow clipping in the campus. */
function ClassRosterDialog({klass,room,board,people,onClose,onOpenDetail,onNavigate}:{
 klass:TrainingResource;room:TrainingResource;board:TrainingBoard;people:TrainingPerson[];
 onClose:()=>void;onOpenDetail:(target:DetailTarget)=>void;onNavigate:(to:Destination)=>void;
}){
 const closeRef=useRef<HTMLButtonElement>(null);
 const dialogRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  closeRef.current?.focus();
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();onClose();}
   if(event.key!=="Tab"||!dialogRef.current)return;
   const focusable=[...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')]
      .filter(node=>node.getClientRects().length>0);
   if(!focusable.length)return;
   if(event.shiftKey&&document.activeElement===focusable[0]){
    event.preventDefault();focusable[focusable.length-1].focus();
   }else if(!event.shiftKey&&document.activeElement===focusable[focusable.length-1]){
    event.preventDefault();focusable[0].focus();
   }
  };
  document.addEventListener("keydown",keydown);
  return()=>{document.removeEventListener("keydown",keydown);document.body.style.overflow=oldOverflow;previous?.focus();};
 },[onClose]);
 const teachers=people.filter(person=>person.role==="teacher");
 const learners=people.filter(person=>person.role==="learner");
 const sessions=sessionsInWindow(board).filter(session=>session.roomId===room.id&&session.classId===klass.id);
 if(typeof document==="undefined")return null;
 return createPortal(<div className={styles.classModalBackdrop}
   onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
   <section className={styles.classModal} ref={dialogRef} role="dialog" aria-modal="true"
    aria-label={`Danh sách học viên và giảng viên lớp ${klass.name}`}>
    <header className={styles.classModalHeader}>
      <div><small>SƠ ĐỒ TÒA → PHÒNG → LỚP</small><h2>{klass.name}</h2>
       <p>{room.name} · {sessions.length} ca học trong khoảng xem · {stateText[klass.state]}</p></div>
      <button ref={closeRef} type="button" aria-label="Đóng danh sách lớp" onClick={onClose}>×</button>
    </header>
    <div className={styles.classModalBody}>
      <div className={styles.rosterCounts}>
       <span><strong>{teachers.length}</strong> Giảng viên</span>
       <span><strong>{learners.length}</strong> Học viên</span>
       <span><strong>{sessions.length}</strong> Ca học</span>
      </div>
      <div className={styles.classStatus}><ResourceStatusBars resource={klass} board={board}/></div>
      <section className={styles.rosterSection}><h3>Giảng viên · {teachers.length}</h3>
       <div className={styles.rosterPeople}>{teachers.map(person=>
        <button type="button" key={person.id} onClick={()=>{onClose();onOpenDetail({kind:"person",id:person.id});}}>
          <AppIcon name="people"/><span><strong>{person.name||"Chưa có tên"}</strong>
            <small>{person.status==="approved"?"Đã duyệt":person.status==="blocked"?"Bị khóa":"Trạng thái: "+person.status}</small>
          </span><span aria-hidden="true">›</span></button>)}
        {!teachers.length?<p>Chưa có giảng viên được phân công cho lớp này.</p>:null}
       </div>
      </section>
      <section className={styles.rosterSection}><h3>Học viên · {learners.length}</h3>
       <div className={styles.rosterPeople}>{learners.map(person=>
        <button type="button" key={person.id} onClick={()=>{onClose();onOpenDetail({kind:"person",id:person.id});}}>
         <AppIcon name="people"/><span><strong>{person.name||"Chưa có tên"}</strong>
          <small>{person.status==="approved"?"Đã duyệt":person.status==="blocked"?"Bị khóa":"Trạng thái: "+person.status}</small>
         </span><span aria-hidden="true">›</span></button>)}
         {!learners.length?<p>Chưa có học viên thuộc lớp này.</p>:null}
       </div>
      </section>
    </div>
    <footer className={styles.classModalFooter}>
      <button type="button" onClick={()=>{onClose();onOpenDetail({kind:"resource",id:klass.id});}}>Xem thông tin lớp</button>
      <button type="button" onClick={()=>{onClose();onNavigate("people");}}>Mở quản lý nhân sự</button>
    </footer>
   </section>
  </div>,document.body);
}

export default function ManagerCommandCenter({board,busy,onNavigate,onOpenDetail,onAssignPerson,onCreateResource,onCreateSession}:Props){
 const [buildingId,setBuildingId]=useState("");
 const [roomId,setRoomId]=useState("");
 const [classId,setClassId]=useState("");
 const [classModalOpen,setClassModalOpen]=useState(false);
 const [roomFilter,setRoomFilter]=useState<"all"|"free"|"attention">("all");
 const buildings=board.resources.filter(resource=>resource.kind==="building");
 const rooms=board.resources.filter(resource=>resource.kind==="room");
 const classes=board.resources.filter(resource=>resource.kind==="class");
 const activeSessions=sessionsInWindow(board);
 const selectedBuilding=buildings.find(resource=>resource.id===buildingId)||null;
 const buildingRooms=rooms.filter(resource=>resource.parentId===selectedBuilding?.id);
 const filteredRooms=buildingRooms.filter(resource=>roomFilter==="all"||(roomFilter==="free"?roomHasNoBookings(board,resource.id):roomNeedsAttention(board,resource.id,activeSessions)));
 const selectedRoom=buildingRooms.find(resource=>resource.id===roomId)||null;
 const selectedRoomSessions=selectedRoom?activeSessions.filter(session=>session.roomId===selectedRoom.id):[];
 const roomClasses=selectedRoom?classesInRoom(board,selectedRoom.id):[];
 const selectedClass=roomClasses.find(resource=>resource.id===classId)||null;
 const selectedMembers=selectedClass?membersOfClass(board,selectedClass):[];
 const blockedOrExpired=board.people.filter(person=>person.status==="blocked"||person.expired);
 const teacherCount=board.people.filter(person=>person.role==="teacher").length;
 const learnerCount=board.people.filter(person=>person.role==="learner").length;
 const urgentClasses=classes.filter(resource=>resource.status==="active"&&(resource.state==="overloaded"||resource.missingTeachers>0));
 const knownRoomIds=new Set(rooms.map(room=>room.id));
 const occupiedRoomIds=new Set(activeSessions.filter(session=>knownRoomIds.has(session.roomId)).map(session=>session.roomId));
 const relevantRoomCount=rooms.filter(resource=>resource.status==="active").length;
 const metrics=[
  {label:"Học viên",value:learnerCount,icon:"people",destination:"people" as Destination,note:"Hồ sơ trong hệ thống"},
  {label:"Giảng viên / HLV",value:teacherCount,icon:"people",destination:"people" as Destination,note:"Danh sách giảng dạy"},
  {label:"Lớp học",value:classes.length,icon:"class",destination:"class" as Destination,note:urgentClasses.length+" lớp cần chú ý"},
  {label:"Phòng / Hồ",value:rooms.length,icon:"room",destination:"room" as Destination,note:occupiedRoomIds.size+" phòng có lịch trong khoảng"},
  {label:"Cơ sở / Tòa",value:buildings.length,icon:"building",destination:"building" as Destination,note:"Dữ liệu cơ sở đã ghi nhận"},
  {label:"Ca học",value:activeSessions.length,icon:"schedule",destination:"schedule" as Destination,note:"Ca trong khoảng xem đã chọn"},
 ];
 function selectBuilding(id:string){setBuildingId(id);setRoomId("");setClassId("");setClassModalOpen(false);setRoomFilter("all");}
 function selectRoom(id:string){setRoomId(id);setClassId("");setClassModalOpen(false);}
 function openClass(id:string){setClassId(id);setClassModalOpen(true);}
 function closeClass(){setClassModalOpen(false);}
 function allBuildings(){selectBuilding("");}
 function backToRooms(){selectRoom("");}
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
   <section className={styles.diagramPanel} aria-label="Sơ đồ phân cấp cơ sở tương tác">
    <div className={styles.panelHeading}>
      <div><small>SƠ ĐỒ TƯƠNG TÁC · DỮ LIỆU THỰC</small>
        <h3>Tòa → Phòng / Hồ → Lớp → Cá nhân</h3></div>
      <button type="button" onClick={()=>onNavigate("building")}>Quản lý cơ sở →</button>
    </div>
    <nav className={styles.hierarchyBreadcrumb} aria-label="Đường dẫn phân cấp">
      <button type="button" aria-current={!selectedBuilding?"page":undefined} onClick={allBuildings}>Tất cả tòa</button>
      {selectedBuilding?<><span aria-hidden="true">›</span>
        <button type="button" aria-current={!selectedRoom?"page":undefined} onClick={backToRooms}>{selectedBuilding.name}</button></>:null}
      {selectedRoom?<><span aria-hidden="true">›</span>
        <span aria-current="page">{selectedRoom.name}</span></>:null}
    </nav>
    <div className={styles.campus} data-stage={!selectedBuilding?"buildings":selectedRoom?"classes":"rooms"}
      role="group" aria-label="Sơ đồ tương tác chọn tòa, phòng, lớp">
      <div className={styles.campusGlow} aria-hidden="true"/><div className={styles.campusPath} aria-hidden="true"/>
      {!selectedBuilding?<div className={styles.campusBuildingGrid}>
       {buildings.map((building,index)=>{
        const related=rooms.filter(room=>room.parentId===building.id);
        const activeCount=related.filter(room=>room.status==="active").length;
        return <button type="button" className={styles.buildingNode} data-selected={false} data-index={index%6}
          key={building.id} onClick={()=>selectBuilding(building.id)} aria-label={`Mở tòa ${building.name}`}>
          <span className={styles.buildingIllustration} aria-hidden="true"><AppIcon name="building"/></span>
          <strong>{building.name}</strong><small>{activeCount}/{related.length} phòng hoạt động</small>
          <span className={styles.nodeState} data-status={building.status}>{building.status==="active"?"● Đang hoạt động":building.status==="unavailable"?"● Tạm ngừng":"● Đã lưu trữ"}</span>
        </button>;
       })}
       {!buildings.length?<div className={styles.diagramEmpty}><strong>Chưa có tòa học</strong>
         <p>Hãy thêm cơ sở và phòng từ nguồn điều phối thực tế.</p>
         <button type="button" disabled={busy} onClick={()=>onCreateResource("building")}>＋ Tạo tòa</button></div>:null}
      </div>:<div className={styles.hierarchyWorkspace}>
       <aside className={styles.compactRail} aria-label="Chuyển tòa nhanh">
        <strong>Tòa khác</strong>
        {buildings.filter(building=>building.id!==selectedBuilding.id).map(building=>
         <button type="button" key={building.id} onClick={()=>selectBuilding(building.id)}
          aria-label={`Chuyển sang tòa ${building.name}`} title={building.name}>
          <AppIcon name="building"/><span>{building.name}</span></button>)}
        {!buildings.some(building=>building.id!==selectedBuilding.id)?<small>Chỉ có một tòa</small>:null}
       </aside>
       <div className={styles.focusedContent}>
        <div className={styles.focusHeading}>
         <div><small>{selectedRoom?"PHÒNG / HỒ ĐANG CHỌN":"TÒA ĐANG CHỌN"}</small>
           <h4>{selectedRoom?selectedRoom.name:selectedBuilding.name}</h4>
           <p>{selectedRoom?
             `${roomClasses.length} lớp có ca · ${selectedRoomSessions.length} ca học trong khoảng xem`:
             `${buildingRooms.length} phòng/hồ hiện có · ${buildingRooms.filter(room=>room.status==="active").length} đang hoạt động`}</p>
         </div>
         <button type="button" onClick={selectedRoom?backToRooms:allBuildings}>
           {selectedRoom?"← Tất cả phòng":"← Tất cả tòa"}</button>
        </div>
        {!selectedRoom?<section className={styles.focusLevel} aria-label={`Các phòng trong tòa ${selectedBuilding.name}`}>
          <div className={styles.focusToolbar}>
           <strong>Phòng / Hồ trong {selectedBuilding.name}</strong>
           <button type="button" disabled={busy} onClick={()=>onCreateResource("room",selectedBuilding.id)}>＋ Phòng</button>
          </div>
          <div className={styles.roomFilters} aria-label="Lọc phòng">
            {([{id:"all",label:"Tất cả"},{id:"free",label:"Chưa có lịch"},{id:"attention",label:"Cần xử lý"}] as const).map(filter=>
             <button type="button" key={filter.id} aria-pressed={roomFilter===filter.id}
              onClick={()=>{setRoomFilter(filter.id);setRoomId("");setClassId("");setClassModalOpen(false);}}>{filter.label}</button>)}
          </div>
          <div className={styles.focusIconGrid}>
           {filteredRooms.map(room=>{
             const sessions=activeSessions.filter(session=>session.roomId===room.id);
             const alert=roomNeedsAttention(board,room.id,activeSessions);
             return <button type="button" key={room.id} className={styles.roomNode}
               onClick={()=>selectRoom(room.id)} aria-label={`Mở phòng ${room.name}`}>
               <span className={styles.roomNodeHead}><AppIcon name="room"/><strong>{room.name}</strong></span>
               <small>{room.status!=="active"?"Tạm ngừng / lưu trữ":sessions.length?
                  `${new Set(sessions.map(s=>s.classId)).size} lớp · ${sessions.length} ca`:"Chưa có ca"}</small>
               <span className={styles.roomNodeState} data-alert={alert}>{alert?"Cần xử lý":stateText[room.state]}</span>
             </button>;
           })}
           {!filteredRooms.length?<p className={styles.emptyCompact}>{buildingRooms.length?
             "Không có phòng theo bộ lọc này.":"Tòa chưa có phòng/hồ. Hãy tạo phòng trước khi xếp lịch."}</p>:null}
          </div>
         </section>:<div className={styles.roomWorkspace}>
          <aside className={styles.compactRail} aria-label="Chuyển phòng nhanh">
           <strong>Phòng khác</strong>
           {buildingRooms.filter(room=>room.id!==selectedRoom.id).map(room=>
            <button type="button" key={room.id} onClick={()=>selectRoom(room.id)}
             aria-label={`Chuyển sang phòng ${room.name}`} title={room.name}>
             <AppIcon name="room"/><span>{room.name}</span></button>)}
            {!buildingRooms.some(room=>room.id!==selectedRoom.id)?<small>Chỉ có một phòng</small>:null}
          </aside>
          <section className={styles.focusLevel} aria-label={`Lớp học trong ${selectedRoom.name}`}>
           <div className={styles.focusToolbar}>
            <strong>Lớp học trong {selectedRoom.name}</strong>
            <button type="button" disabled={busy} onClick={()=>onCreateSession(selectedRoom.id,selectedClass?.id)}>＋ Thêm ca</button>
           </div>
           <p className={styles.scopeNote}>Các lớp có ca trong khoảng thời gian đang xem. Chọn lớp để mở danh sách Học viên/Giảng viên.</p>
           <div className={styles.focusIconGrid}>
            {roomClasses.map(klass=><button type="button" key={klass.id} className={styles.classIcon}
              aria-label={`Mở danh sách lớp ${klass.name}`} onClick={()=>openClass(klass.id)}>
             <AppIcon name="class"/><strong>{klass.name}</strong>
             <small>{selectedRoomSessions.filter(session=>session.classId===klass.id).length} ca học</small>
            </button>)}
            {!roomClasses.length?<p className={styles.emptyCompact}>Phòng chưa có lớp gắn với ca trong khoảng thời gian đang xem.</p>:null}
           </div>
           <div className={styles.focusToolbar}><strong>Ca học trong phòng</strong>
            <button type="button" onClick={()=>onOpenDetail({kind:"resource",id:selectedRoom.id})}>Chi tiết phòng →</button>
           </div>
           <div className={styles.sessionList}>
            {selectedRoomSessions.map(session=>{
             const klass=classes.find(resource=>resource.id===session.classId);
             const teacher=board.people.find(person=>person.id===session.teacherId);
             return <button type="button" className={styles.sessionRow} key={session.id}
               disabled={!klass} onClick={()=>klass&&openClass(klass.id)}>
              <span className={styles.sessionTime}>{formatTime(session.startsAt)} – {formatTime(session.endsAt)}</span>
              <span className={styles.sessionText}><strong>{klass?.name||"Lớp không còn tồn tại"}</strong>
               <small>{session.title} · {teacher?.name||"Chưa rõ giảng viên"}</small></span>
              <span className={styles.sessionState}>{session.status==="completed"?"Hoàn thành":"Đã xếp"}</span>
             </button>;
            })}
            {!selectedRoomSessions.length?<p className={styles.emptyCompact}>Chưa có buổi học trong khoảng thời gian đang xem.</p>:null}
           </div>
          </section>
         </div>}
       </div>
      </div>}
    </div>
    <div className={styles.diagramLegend}><span><i data-state="active"/>Hoạt động</span>
      <span><i data-state="unavailable"/>Tạm ngừng</span><span><i data-state="archived"/>Lưu trữ</span></div>
    <div className={styles.facilityTotals}>
      <span><strong>{relevantRoomCount}</strong> phòng hoạt động</span>
      <span><strong>{occupiedRoomIds.size}</strong> phòng có lịch</span>
      <span><strong>{activeSessions.length}</strong> buổi trong khoảng xem</span>
    </div>
   </section>
  </div>
  {classModalOpen&&selectedClass&&selectedRoom?
    <ClassRosterDialog klass={selectedClass} room={selectedRoom} board={board} people={selectedMembers}
      onClose={closeClass} onOpenDetail={onOpenDetail} onNavigate={onNavigate}/>:null}

  <div className={styles.bottomPanels}>
   <section className={styles.actionPanel}><div className={styles.panelHeading}><h3>Ưu tiên xử lý</h3><button type="button" onClick={()=>onNavigate("class")}>Mở quản lý →</button></div>
    <button type="button" onClick={()=>onNavigate("class")}><Badge tone={urgentClasses.length?"missing":"available"}>{urgentClasses.length}</Badge><span>Lớp quá sĩ số hoặc thiếu giảng viên</span></button>
    <button type="button" onClick={()=>onNavigate("review")}><AppIcon name="approval"/><span>Kiểm duyệt tài khoản · Mở hàng chờ xác thực</span></button>
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
