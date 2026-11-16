"use client";

import {useMemo,useState} from "react";
import type {TrainingBoard} from "./training-types";
import type {ManagerAiDestination} from "./manager-ai-evidence-v41";
import {buildAllocationReview,type AllocationProposal} from "./manager-ai-allocation-v42";
import styles from "./manager-ai-allocation-v42.module.css";

function date(value:string){
 const d=new Date(value);
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(d):"Chưa xác minh";
}
function Shortlist({title,rows,empty,navigate,target}:{
 title:string;rows:AllocationProposal[];empty:string;navigate:(target:ManagerAiDestination)=>void;
 target:ManagerAiDestination;
}){
 const [showAll,setShowAll]=useState(false);
 const [expanded,setExpanded]=useState<string|null>(null);
 const visible=showAll?rows:rows.slice(0,8);
 return <section className={styles.column} aria-label={title}>
  <header><h4>{title}</h4><small>{rows.length} phương án xem xét, không tự áp dụng</small></header>
  <div className={styles.records}>
   {visible.map((r)=><article key={r.id} className={styles.record}>
    <div className={styles.recordHead}><span>{r.priority==="high"?"Ưu tiên":"Đề xuất"}</span>
     <strong>{r.personName}</strong></div>
    <p><b>{r.className}</b> · {r.reason}</p>
    <dl><div><dt>Sĩ số cấu hình</dt><dd>{r.currentLearnerCount}/{r.classCapacity}</dd></div>
      <div><dt>Giảng viên hiện có</dt><dd>{r.teacherCoverage}</dd></div>
      {r.currentClassLoad!==null?<div><dt>Tải của ứng viên</dt><dd>{r.currentClassLoad} lớp</dd></div>:null}
    </dl>
    <div className={styles.actions}>
      <button type="button" aria-expanded={expanded===r.id} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
       {expanded===r.id?"Ẩn căn cứ":"Vì sao đề xuất?"}
      </button>
      <button type="button" onClick={()=>navigate(target)}>Mở {target==="people"?"Nhân sự":"Lớp học"} để xét duyệt</button>
    </div>
    {expanded===r.id?<div className={styles.evidence}>
      <strong>Bằng chứng · {date(r.observedAt)}</strong>
      {r.sourceRecords.map(x=><small key={x.source+":"+x.id}>{x.source} · {x.id}</small>)}
      {r.warnings.map((w,i)=><p key={i}>{w}</p>)}
      <p>Chưa có thay đổi dữ liệu hoặc thông báo phân công chính thức.</p>
    </div>:null}
   </article>)}
   {!rows.length?<p className={styles.empty}>{empty}</p>:null}
  </div>
  {rows.length>8?<button type="button" className={styles.showAll} onClick={()=>setShowAll(!showAll)}>
   {showAll?"Thu gọn":"Xem thêm "+(rows.length-8)+" phương án"}</button>:null}
 </section>;
}
export default function ManagerAiAllocationPanelV42({board,onNavigate}:{
 board:TrainingBoard;onNavigate:(id:ManagerAiDestination)=>void;
}){
 const review=useMemo(()=>buildAllocationReview(board),[board]);
 return <section className={styles.root} aria-label="Đề xuất phân bổ học viên và giảng viên" data-manager-ai-allocation="V42">
  <header className={styles.hero}>
   <div><small>V42 · PHÂN BỔ CÓ GIẢI THÍCH</small><h3>Gợi ý phân lớp & giảng viên</h3>
    <p>Ứng viên được tự động sắp theo sĩ số, số lớp đang nhận và lịch có trong hệ thống. Cán bộ chọn quyết định cuối cùng.</p></div>
   <span>Chỉ đề xuất · Không tự lưu</span>
  </header>
  <div className={styles.stats}>
   <div><strong>{review.classesNeedingTeachers}</strong><span>Lớp cần bổ sung người</span></div>
   <div><strong>{review.unassignedTeachers}</strong><span>Giảng viên chưa khớp lớp</span></div>
   <div><strong>{review.unassignedLearners}</strong><span>Học viên chưa khớp lớp</span></div>
   <div><strong>{date(review.observedAt)}</strong><span>Mốc dữ liệu xác thực</span></div>
  </div>
  <p className={styles.qualification} role="note">
   Chưa có trong snapshot: năng lực/chứng chỉ chuyên môn, giờ rảnh từ hồ sơ bổ sung,
   nhu cầu học viên và ràng buộc an toàn thực tế. Vì vậy hệ thống chỉ xếp hạng ứng viên,
   không xác nhận đã phù hợp tuyệt đối. {review.sourceMayBeTruncated?"Nguồn có thể bị giới hạn số bản ghi.":""}
  </p>
  <div className={styles.columns}>
   <Shortlist title="01 · Giảng viên → lớp thiếu người" rows={review.teacherShortlist}
     empty="Không có ứng viên không trùng giờ được nhận diện trong dữ liệu tải; xem xét thủ công."
     target="people" navigate={onNavigate}/>
   <Shortlist title="02 · Học viên → lớp còn chỗ" rows={review.learnerShortlist}
     empty="Chưa tìm thấy hồ sơ học viên cần phân lớp hoặc lớp còn sức chứa/đủ giảng viên cấu hình."
     target="class" navigate={onNavigate}/>
  </div>
  <footer>Thứ tự là gợi ý theo bộ quy tắc {review.rulesVersion}, không phải điểm phù hợp AI dự báo.
   Quyết định cần đối chiếu hồ sơ, giờ học, tiêu chuẩn an toàn và xác nhận có thẩm quyền.</footer>
 </section>;
}
