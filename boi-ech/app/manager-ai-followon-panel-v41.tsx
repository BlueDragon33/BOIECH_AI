"use client";

import {useState} from "react";
import type {TrainingBoard,TrainingSession} from "./training-types";
import type {ManagerAiReport} from "./manager-ai-evidence-v41";
import {
 scanAllManagerConflicts,reviewTeacherCandidates,summarizeManagerTrainingQuality,
 compareRoomOptions,auditManagerEvidence,MANAGER_AI_FUTURE_CAPABILITIES,
} from "./manager-ai-followon-v41";
import styles from "./manager-ai-followon-v41.module.css";

type Panel="operations"|"quality"|"simulator"|"audit";
const panels:{key:Panel;label:string;help:string}[]=[
 {key:"operations",label:"Xung đột & nhân sự",help:"V41.0-P1"},
 {key:"quality",label:"Chất lượng đào tạo",help:"V41.1"},
 {key:"simulator",label:"Mô phỏng lịch",help:"V41.2"},
 {key:"audit",label:"Kiểm toán AI",help:"V41.3"},
];
const statusLabel={
 conflict:"Có xung đột",
 "review-required":"Cần kiểm tra thêm",
 "no-conflict-in-loaded-window":"Không trùng trong dữ liệu đã tải",
 invalid:"Không hợp lệ",
};
function date(value:string){
 const d=new Date(value);return Number.isFinite(d.getTime())?
  new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(d):"Không xác minh";
}
function toLocal(value:string){
 const d=new Date(value);return Number.isFinite(d.getTime())?
  new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16):"";
}
function icon(name:"clock"|"users"|"audit"|"chart"){
 const paths={
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
  users:<><circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 21v-2a6 6 0 0 1 12 0v2M14 14a6 6 0 0 1 8 5v2"/></>,
  audit:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8m-8 4 2 2 5-5"/></>,
  chart:<><path d="M3 20h18M6 17v-6m6 6V5m6 12v-9"/></>,
 };
 return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export default function ManagerAiFollowonV41({board,report}:{
 board:TrainingBoard;report:ManagerAiReport;
}){
 const [panel,setPanel]=useState<Panel>("operations");
 const [teacherClass,setTeacherClass]=useState("");
 const [session,setSession]=useState("");
 const [start,setStart]=useState("");
 const [requested,setRequested]=useState(false);
 const [showAllCandidates,setShowAllCandidates]=useState(false);
 const conflicts=scanAllManagerConflicts(board,70);
 const quality=summarizeManagerTrainingQuality(board);
 const audit=auditManagerEvidence(board,report);
 const classes=board.resources.filter(r=>r.kind==="class"&&r.status==="active");
 const classId=classes.some(r=>r.id===teacherClass)?teacherClass:classes[0]?.id??"";
 const candidates=classId?reviewTeacherCandidates(board,classId,40):[];
 const lessons=board.sessions.filter(s=>s.status!=="cancelled"&&Number.isFinite(Date.parse(s.startsAt)));
 const chosen=lessons.find(s=>s.id===session)??lessons[0]??null;
 const selectedStart=start||(chosen?toLocal(chosen.startsAt):"");
 const proposedStart=selectedStart&&Number.isFinite(new Date(selectedStart).getTime())?
  new Date(selectedStart).toISOString():"";
 const suggestions=requested&&chosen&&proposedStart?
  compareRoomOptions(board,chosen.id,proposedStart,12):[];
 const visibleCandidates=showAllCandidates?candidates:candidates.slice(0,6);
 return <section className={styles.root} aria-label="Các giai đoạn AI Manager tiếp theo" data-manager-ai-followon="V41.1-V41.3">
  <header className={styles.heading}><span>{icon("chart")}</span><div><small>AI MANAGER · FOLLOW-ON</small>
    <h3>Phân tích nâng cao & mô phỏng quyết định</h3>
    <p>Tiếp nối V41.0: mở rộng các bằng chứng được phép xem. Không tự cấp quyền hay ghi thay đổi.</p></div></header>
  <nav className={styles.tabs} aria-label="Giai đoạn AI Manager mở rộng">
   {panels.map(p=><button key={p.key} type="button" aria-pressed={panel===p.key}
     onClick={()=>setPanel(p.key)}>{p.label}<small>{p.help}</small></button>)}
  </nav>

  {panel==="operations"?<div className={styles.content} aria-label="Kiểm tra lịch và nhân sự">
   <div className={styles.summary}>
    <article><strong>{conflicts.totalPairs}</strong><span>Cặp buổi trùng nguồn lực trong khoảng dữ liệu tải</span></article>
    <article><strong>{conflicts.scannedSessions}</strong><span>Buổi hợp lệ đã kiểm tra</span></article>
    <article><strong>{conflicts.pairDisplayTruncated?"Có":"Không"}</strong><span>Danh sách chi tiết bị rút gọn</span></article>
   </div>
   <p className={styles.context}>{conflicts.coverageNote} Mốc: {date(conflicts.observedAt)}.</p>
   <div className={styles.columns}>
    <section className={styles.card}><h4>Đối chiếu từng cặp xung đột</h4>
     <div className={styles.scroll}>
      {conflicts.shownPairs.map(c=><div className={styles.record} key={c.firstId+"-"+c.secondId}>
       <strong>Buổi {c.firstId} ↔ {c.secondId}</strong>
       <span>Trùng {c.reasons.map(r=>r==="teacher"?"giảng viên":r==="room"?"phòng/bể":"lớp").join(", ")} · {date(c.firstStart)}</span>
      </div>)}
      {!conflicts.totalPairs?<div className={styles.empty}>Không phát hiện cặp trùng trong các phiên đã tải; không phải chứng nhận toàn hệ thống không xung đột.</div>:null}
     </div>
    </section>
    <section className={styles.card}><h4>Đối chiếu khả năng nhận lớp</h4>
     <label className={styles.field}>Chọn lớp đang hoạt động<select value={classId} onChange={e=>{setTeacherClass(e.target.value);setShowAllCandidates(false);}}>
      {classes.length?classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>):<option value="">Không có lớp</option>}
     </select></label>
     <div className={styles.scroll}>
      {visibleCandidates.map(c=><div key={c.teacherId} className={styles.record}>
       <strong>{c.displayName}</strong>
       <span>{c.currentClassLoad} lớp · {c.overlappingExistingSessions} buổi trùng giờ đã tải</span>
       <span>{c.assessment==="conflict-found"?"Cần xử lý xung đột":c.assessment==="not-verifiable"?"Chưa có lịch lớp để kiểm tra":"Chưa xác minh chứng chỉ/chuyên môn"}</span>
      </div>)}
      {!candidates.length?<div className={styles.empty}>Chưa có tài khoản giảng viên đủ điều kiện trong phạm vi dữ liệu.</div>:null}
     </div>
     {candidates.length>6?<button type="button" className={styles.secondary} onClick={()=>setShowAllCandidates(!showAllCandidates)}>
      {showAllCandidates?"Thu gọn":"Hiển thị thêm "+(candidates.length-6)+" giảng viên"}</button>:null}
     <p className={styles.context}>Đây là danh sách để cán bộ xem xét, không phải xác nhận giảng viên đủ năng lực hoặc sẵn sàng nhận lớp.</p>
    </section>
   </div>
  </div>:null}

  {panel==="quality"?<div className={styles.content} aria-label="Chỉ số chất lượng dữ liệu đào tạo">
   <div className={styles.summary}>
    {[
     ["Học viên được duyệt còn hạn",quality.learnerAccounts.active],
     ["Chưa khớp lớp hoạt động",quality.learnerAccounts.withoutActiveClass],
     ["Lớp thiếu giảng viên",quality.classCoverage.withoutTeacher],
     ["Buổi đã hoàn tất trong khoảng xem",quality.sessions.completed],
    ].map(([label,value])=><article key={label}><strong>{value}</strong><span>{label}</span></article>)}
   </div>
   <p className={styles.context}>{quality.explanation}</p>
   <div className={styles.columns}>
    <section className={styles.card}><h4>Phạm vi đã xác minh</h4>
     <dl className={styles.facts}>
      <div><dt>Tổng tài khoản học viên</dt><dd>{quality.learnerAccounts.total}</dd></div>
      <div><dt>Học viên tài khoản chưa hợp lệ</dt><dd>{quality.learnerAccounts.inactiveOrExpired}</dd></div>
      <div><dt>Tên lớp chưa khớp danh mục hoạt động</dt><dd>{quality.learnerAccounts.unmatchedClass}</dd></div>
      <div><dt>Buổi đã xếp / đã hoàn thành / đã hủy</dt><dd>{quality.sessions.scheduled} / {quality.sessions.completed} / {quality.sessions.cancelled}</dd></div>
      <div><dt>Buổi có khoảng giờ bất hợp lệ</dt><dd>{quality.sessions.invalidIntervals}</dd></div>
      <div><dt>Lớp vượt sức chứa cấu hình</dt><dd>{quality.classCoverage.overCapacity}</dd></div>
     </dl>
    </section>
    <section className={styles.card}><h4>Chưa thể kết luận</h4>
     <p>V41.1 chưa được cấp nguồn để đọc kết quả video, tiến bộ kỹ thuật từng học viên, tần suất tham gia thực tế hoặc nội dung tin nhắn.</p>
     <p>Việc thiếu nguồn được công bố công khai thay vì dựng chỉ số chất lượng AI giả định. Để mở rộng, cần API tổng hợp đúng quyền và bằng chứng nguồn.</p>
    </section>
   </div>
  </div>:null}

  {panel==="simulator"?<div className={styles.content} aria-label="So sánh phương án đổi phòng và giờ học">
   <div className={styles.columns}>
    <section className={styles.card}><h4>Mô phỏng phòng/bể và giờ học</h4>
     <p>Giữ nguyên buổi, lớp, giảng viên và thời lượng; thay phòng và thời điểm để kiểm tra ràng buộc lịch trong snapshot.</p>
     <label className={styles.field}>Buổi học hiện có<select value={chosen?.id??""} onChange={e=>{setSession(e.target.value);setStart("");setRequested(false);}}>
      {lessons.length?lessons.map((s:TrainingSession)=><option key={s.id} value={s.id}>{s.title} · {date(s.startsAt)}</option>):<option value="">Không có buổi</option>}
     </select></label>
     <label className={styles.field}>Bắt đầu dự kiến<input type="datetime-local" value={selectedStart} onChange={e=>{setStart(e.target.value);setRequested(false);}}/></label>
     <button className={styles.primary} type="button" disabled={!chosen||!proposedStart} onClick={()=>setRequested(true)}>
      Tìm phương án trong dữ liệu đã tải
     </button>
     <p className={styles.context}>Chỉ mô phỏng, không sửa lịch và không phê duyệt. Nếu giờ mới nằm ngoài khoảng tải, mọi phương án bị từ chối vì không có bằng chứng.</p>
    </section>
    <section className={styles.card}><h4>Kết quả so sánh</h4>
     {!requested?<div className={styles.empty}>Chọn buổi và thời điểm, sau đó chạy mô phỏng.</div>:null}
     {requested&&!suggestions.length?<div className={styles.empty}>Không có phòng hoạt động để đánh giá hoặc thời điểm chưa hợp lệ.</div>:null}
     <div className={styles.scroll}>
     {suggestions.map(option=><div className={styles.record} data-state={option.state} key={option.roomId}>
      <strong>{board.resources.find(r=>r.id===option.roomId)?.name??option.roomId}</strong>
      <span>{statusLabel[option.state]} · {option.reason}</span>
      {option.overlappingSessions.length?<span>Trùng buổi: {option.overlappingSessions.join(", ")}</span>:null}
      {option.warnings.map((w,i)=><span key={i}>{w}</span>)}
     </div>)}
     </div>
    </section>
   </div>
  </div>:null}

  {panel==="audit"?<div className={styles.content} aria-label="Kiểm toán bằng chứng AI và năng lực chưa bật">
   <div className={styles.summary}>
    <article><strong>{audit.findingCount}</strong><span>Phân tích trong tập kết quả hiển thị</span></article>
    <article><strong>{audit.referenceCoveragePercent===null?"—":audit.referenceCoveragePercent+"%"}</strong><span>Nhận định có tham chiếu nguồn</span></article>
    <article><strong>{audit.resolvableReferencePercent===null?"—":audit.resolvableReferencePercent+"%"}</strong><span>Tham chiếu đối chiếu được trong snapshot</span></article>
    <article><strong>{audit.duplicateFindingIds.length}</strong><span>Mã cảnh báo trùng</span></article>
   </div>
   <p className={styles.context}>Đây là kiểm tra cấu trúc và tính truy xuất bằng chứng, **không phải điểm chính xác AI** hay xác nhận nguyên nhân–kết quả. Tập cảnh báo có thể bị cắt ở giới hạn hiển thị: {audit.sourcePotentiallyTruncated?"Có":"Không thấy dấu hiệu trong nguồn hiện tải"}.</p>
   <div className={styles.columns}>
    <section className={styles.card}><h4>Kiểm toán tham chiếu</h4>
     <dl className={styles.facts}>
      <div><dt>Tổng tham chiếu trong phần hiển thị</dt><dd>{audit.totalReferences}</dd></div>
      <div><dt>Đối chiếu được</dt><dd>{audit.resolvableReferences}</dd></div>
      <div><dt>Không tìm thấy / sai mốc</dt><dd>{audit.missingEvidenceIds.length}</dd></div>
     </dl>
     {audit.missingEvidenceIds.length?<div className={styles.scroll}>{audit.missingEvidenceIds.map(id=><p key={id} className={styles.issue}>{id}</p>)}</div>:null}
     <p>Cần so sánh các cảnh báo với kiểm tra thủ công để biết false-positive/false-negative; V41.3 chưa có nhãn đánh giá đã phê duyệt.</p>
    </section>
    <section className={styles.card}><h4>Năng lực chờ cấp quyền / dữ liệu</h4>
     <div className={styles.scroll}>{MANAGER_AI_FUTURE_CAPABILITIES.map(cap=><div key={cap.name} className={styles.record}>
      <strong>{cap.name}</strong><span>{cap.reason}</span>
      <span>{cap.status==="unavailable"?"Chưa có dữ liệu":cap.status==="approval-required"?"Chờ phê duyệt":"Đã triển khai"}</span>
     </div>)}</div>
    </section>
   </div>
  </div>:null}
 </section>;
}
