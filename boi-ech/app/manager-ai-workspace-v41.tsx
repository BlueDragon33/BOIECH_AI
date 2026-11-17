"use client";

import {useMemo,useState,type FormEvent} from "react";
import {analyzeManagerBoard,answerManagerQuestion,simulateTeacherAllocation,type ManagerAiArea,type ManagerAiDestination} from "./manager-ai-evidence-v41";
import {classKey,classNames,type TrainingBoard} from "./training-types";
import ManagerAiFollowonV41 from "./manager-ai-followon-panel-v41";
import ManagerAiAllocationPanelV42 from "./manager-ai-allocation-panel-v42";
import {buildAllocationReview} from "./manager-ai-allocation-v42";
import type {TrainingProof} from "./training-client";
import styles from "./manager-ai-workspace-v41.module.css";

const categories:{key:"all"|ManagerAiArea;label:string}[]=[
 {key:"all",label:"Tất cả"},{key:"staff",label:"Nhân sự"},{key:"class",label:"Lớp học"},
 {key:"schedule",label:"Lịch học"},{key:"rooms",label:"Phòng học"},{key:"quality",label:"Dữ liệu"}
];
const samples=[
 "Tổng quan những vấn đề cần xử lý",
 "Lớp nào đang thiếu giảng viên?",
 "Có lớp nào quá sĩ số?",
 "Kiểm tra lịch học trùng nhau",
];
const labelPriority={critical:"Khẩn",high:"Cần xử lý",medium:"Cần xem",info:"Thông tin"} as const;
const labelSource={resources:"Tài nguyên/lớp",people:"Nhân sự",sessions:"Buổi học",teacherClassTerms:"Phân công"} as const;
function date(value:string){const parsed=new Date(value);return Number.isFinite(parsed.getTime())?
  new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(parsed):"Không có mốc xác thực";}
function Glyph({name}:{name:"ai"|"users"|"calendar"|"alert"|"class"|"arrow"|"shield"|"chat"|"filter"}){
 const nodes={
  ai:<><path d="m12 2 2.2 7 6.8 2.5-6.8 2.5L12 21l-2.2-7L3 11.5 9.8 9z"/></>,
  users:<><circle cx="8" cy="8" r="3"/><path d="M2 21v-2a6 6 0 0 1 12 0v2m4-12a3 3 0 0 1 0 6m-1 2a5 5 0 0 1 5 5v1"/></>,
  calendar:<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4m8-4v4M3 10h18"/></>,
  alert:<><path d="m12 3 10 18H2L12 3zM12 9v5m0 3v.01"/></>,
  class:<><path d="m2 8 10-5 10 5-10 5Zm4 3v6c4 3 8 3 12 0v-6"/></>,
  arrow:<><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  shield:<><path d="m12 2 8 3v6c0 5-3 9-8 11-5-2-8-6-8-11V5zM8 12l3 3 5-6"/></>,
  chat:<><path d="M3 4h18v13H8l-5 4V4zm4 5h10M7 13h7"/></>,
  filter:<><path d="M3 5h18l-7 8v6l-4 2v-8z"/></>
 };
 return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{nodes[name]}</svg>;
}
export function ManagerAiContextNoticeV41({board,area,onOpen}:{board:TrainingBoard;area:"people"|"class"|"schedule"|"room";onOpen:()=>void}){
 const report=analyzeManagerBoard(board,60);
 const wanted=area==="people"?["staff"]:area==="class"?["class","staff"]:area==="schedule"?["schedule"]:["schedule"];
 const selected=report.findings.filter(f=>wanted.includes(f.area));
 const urgent=selected.filter(f=>f.priority==="critical"||f.priority==="high");
 const allocation=buildAllocationReview(board);
 const proposed=area==="people"?allocation.teacherShortlist.length:
  area==="class"?allocation.learnerShortlist.length:0;
 return <aside className={styles.contextNotice} aria-label="AI phát hiện theo ngữ cảnh, chỉ đọc">
  <span><Glyph name="ai"/></span>
  <div><strong>AI phân tích · {urgent.length} tín hiệu ưu tiên · {proposed} phương án phân bổ</strong>
   <small>{urgent[0]?urgent[0].title:"Chưa phát hiện cảnh báo ưu tiên cao theo bộ quy tắc hiện tại."} · Dữ liệu có bằng chứng, không tự thực thi.</small></div>
  <button type="button" onClick={onOpen}>Xem phân tích <Glyph name="arrow"/></button>
 </aside>;
}
export function ManagerAiOverviewEntryV41({board,onOpen}:{board:TrainingBoard;onOpen:()=>void}){
 const report=analyzeManagerBoard(board,20);
 const pending=report.counts.critical+report.counts.high;
 const allocation=buildAllocationReview(board);
 const toReview=allocation.teacherShortlist.length+allocation.learnerShortlist.length;
 return <button className={styles.overviewEntry} type="button" onClick={onOpen} aria-label="Mở Trung tâm AI Điều hành, xem cảnh báo có bằng chứng">
  <span className={styles.overviewEntryIcon}><Glyph name="ai"/></span>
  <span><strong>AI Điều hành · V42</strong><small>{pending?"Có "+pending+" cảnh báo khẩn hoặc cần xử lý":"Không phát hiện cảnh báo ưu tiên cao theo bộ quy tắc hiện tại"}</small>
   <small>{toReview} phương án phân bố học viên/giảng viên cần cán bộ chọn · Không tự thực thi</small></span>
  <Glyph name="arrow"/>
 </button>;
}
export default function ManagerAiWorkspaceV41({board,busy,onNavigate,onReviewAllocation,getProof}:{
 board:TrainingBoard;busy:boolean;onNavigate:(id:ManagerAiDestination)=>void;
 onReviewAllocation:(personId:string,classId:string)=>void;
 getProof?:(signal?:AbortSignal)=>Promise<TrainingProof>;
}){
 const report=useMemo(()=>analyzeManagerBoard(board,40),[board]);
 const [area,setArea]=useState<"all"|ManagerAiArea>("all");
 const [question,setQuestion]=useState("");
 const [submitted,setSubmitted]=useState("");
 const [expanded,setExpanded]=useState<string|null>(null);
 const [scenarioClass,setScenarioClass]=useState("");
 const [scenarioTeacher,setScenarioTeacher]=useState("");
 const [simulated,setSimulated]=useState(false);
 const answer=useMemo(()=>submitted?answerManagerQuestion(submitted,report):null,[submitted,report]);
 const findings=report.findings.filter(item=>area==="all"||item.area===area);
 const classes=board.resources.filter(c=>c.kind==="class"&&c.status==="active");
 const teacher=board.people.filter(p=>p.role==="teacher"&&p.registered&&p.status==="approved"&&!p.expired);
 const selectedClass=classes.some(c=>c.id===scenarioClass)?scenarioClass:classes[0]?.id??"";
 const selectedTeacher=teacher.some(p=>p.id===scenarioTeacher)?scenarioTeacher:teacher[0]?.id??"";
 const scenario=simulated&&selectedClass&&selectedTeacher?
  simulateTeacherAllocation(board,selectedClass,selectedTeacher):null;
 const answered=(event:FormEvent)=>{event.preventDefault();setSubmitted(question.trim().slice(0,350));};
 function navigate(target:ManagerAiDestination){onNavigate(target);}
 return <section className={styles.root} aria-label="Trung tâm AI Điều hành có bằng chứng" data-manager-ai-version="V41.0">
   <header className={styles.hero}>
    <span className={styles.heroIcon}><Glyph name="ai"/></span>
    <div><small>AI MANAGER · V41.0 — P0</small><h2>Trung tâm AI Điều hành</h2>
     <p>Phát hiện và giải thích vấn đề từ dữ liệu quản lý thật; mô phỏng trước khi quyết định.</p></div>
    <span className={styles.engineTag}>Phân tích theo quy tắc có kiểm chứng</span>
   </header>
   <div className={styles.disclosure} role="note"><Glyph name="shield"/><p><strong>Minh bạch năng lực:</strong> Hiện chạy bộ phân tích xác định, chưa kết nối mô hình AI tạo sinh.
     Không tự giao lớp, sửa lịch, đọc tin nhắn hoặc gửi dữ liệu ra ngoài. Dữ liệu lấy từ phiên cán bộ đã xác thực.</p></div>
   <div className={styles.metrics}>
    {[
     {name:"Cảnh báo khẩn",count:report.counts.critical,tone:"critical",icon:"alert" as const},
     {name:"Cần xử lý",count:report.counts.high,tone:"high",icon:"calendar" as const},
     {name:"Cần xem lại",count:report.counts.medium,tone:"medium",icon:"users" as const},
     {name:"Tổng tín hiệu",count:report.totalFindings,tone:"total",icon:"ai" as const}
    ].map(tile=><article className={styles.metric} data-tone={tile.tone} key={tile.name}>
      <span><Glyph name={tile.icon}/></span><strong>{tile.count}</strong><small>{tile.name}</small></article>)}
   </div>
   <div className={styles.snapshot}><span>Snapshot: {date(report.observedAt)}</span>
    <span>Khoảng xem: {date(report.window.from)} → {date(report.window.to)}</span>
    <span>{report.coverage.classes} lớp · {report.coverage.teachers} giảng viên · {report.coverage.sessions} buổi</span>
    <span>Phiên bản: {report.engineVersion}</span></div>
   <div className={styles.twoColumns}>
    <div className={styles.mainColumn}>
     <section className={styles.section} aria-label="Hàng chờ phân tích AI">
      <div className={styles.sectionHeader}><div><small>01 · OPERATIONAL INTELLIGENCE</small><h3>Hàng chờ cảnh báo & quyết định</h3>
       <p>Tín hiệu xếp theo mức độ ảnh hưởng. Mỗi nhận định kèm bằng chứng nguồn và giới hạn.</p></div><Glyph name="filter"/></div>
      <div className={styles.filters} role="group" aria-label="Lọc cảnh báo">
       {categories.map(c=><button key={c.key} type="button" aria-pressed={area===c.key} onClick={()=>setArea(c.key)}>{c.label}</button>)}
      </div>
      <div className={styles.findings} aria-live="polite">
       {findings.map(f=><article key={f.id} className={styles.finding} data-priority={f.priority}>
         <div className={styles.findingTop}><span className={styles.priority} data-priority={f.priority}>{labelPriority[f.priority]}</span>
          <small>{categories.find(c=>c.key===f.area)?.label}</small></div>
         <h4>{f.title}</h4><p>{f.details}</p>
         <div className={styles.recommend}><Glyph name="shield"/><span>{f.recommendedAction}</span></div>
         <div className={styles.cardActions}>
          <button type="button" aria-expanded={expanded===f.id} onClick={()=>setExpanded(expanded===f.id?null:f.id)}>
           {expanded===f.id?"Ẩn bằng chứng":"Xem bằng chứng"}</button>
          <button type="button" onClick={()=>navigate(f.target)}>Mở phân hệ <Glyph name="arrow"/></button>
         </div>
         {expanded===f.id?<div className={styles.evidence}><strong>Bằng chứng và giới hạn</strong>
           <ul>{f.evidence.map((c,i)=><li key={i}>{labelSource[c.source]} · Mã {c.recordId} · trường {c.fields} · mốc {date(c.observedAt)}</li>)}</ul>
           {f.limitations.map((warning,i)=><p key={i}>{warning}</p>)}
          </div>:null}
        </article>)}
       {!findings.length?<div className={styles.empty}><Glyph name="shield"/><strong>Chưa có cảnh báo thuộc bộ lọc này</strong>
          <p>Không phát hiện theo bộ quy tắc hiện tại; không có nghĩa mọi rủi ro đã được loại trừ.</p></div>:null}
      </div>
      {report.truncated?<p className={styles.notice}>Đã giới hạn hiển thị {report.findings.length}/{report.totalFindings} tín hiệu. Thu hẹp khoảng xem và phân loại để đánh giá đầy đủ.</p>:null}
     </section>
    </div>
    <aside className={styles.sideColumn}>
     <section className={styles.section}>
       <div className={styles.sectionHeader}><div><small>02 · GROUNDED Q&A</small><h3>Hỏi dữ liệu điều hành</h3>
        <p>Câu trả lời có giới hạn theo các luật phân tích V41.0.</p></div><Glyph name="chat"/></div>
       <div className={styles.samples}>{samples.map(q=><button key={q} type="button" onClick={()=>{setQuestion(q);setSubmitted(q);}}>{q}</button>)}</div>
       <form className={styles.ask} onSubmit={answered}><label htmlFor="manager-ai-p0-question">Câu hỏi của cán bộ</label>
        <textarea id="manager-ai-p0-question" value={question} onChange={e=>setQuestion(e.target.value)} rows={3} maxLength={350}
          placeholder="Ví dụ: Có lớp nào thiếu giảng viên hoặc trùng lịch?"/>
        <button type="submit" disabled={!question.trim()||busy}>Phân tích câu hỏi</button>
       </form>
       {answer?<div className={styles.answer} role="status"><strong>{answer.title}</strong><p>{answer.answer}</p>
        <small>{answer.references.length} tham chiếu nguồn · {answer.disclaimer}</small>
        {answer.references.length?<details className={styles.answerRefs}><summary>Xem bằng chứng trả lời ({answer.references.length})</summary>
          <ul>{answer.references.map((ref,i)=><li key={i}>{labelSource[ref.source]} · mã {ref.recordId} · {ref.fields} · {date(ref.observedAt)}</li>)}</ul>
        </details>:null}</div>:null}
     </section>
     <section className={styles.section}>
      <div className={styles.sectionHeader}><div><small>03 · WHAT-IF</small><h3>Mô phỏng phân công</h3>
       <p>Xem tải lớp thay đổi nếu bổ sung giảng viên. Không ghi vào máy chủ.</p></div><Glyph name="users"/></div>
      <div className={styles.formGrid}>
       <label>Lớp đang hoạt động<select value={selectedClass} onChange={e=>{setScenarioClass(e.target.value);setSimulated(false);}} disabled={busy||!classes.length}>
         {classes.length?classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>):<option value="">Không có lớp</option>}
       </select></label>
       <label>Giảng viên đủ điều kiện tài khoản<select value={selectedTeacher} onChange={e=>{setScenarioTeacher(e.target.value);setSimulated(false);}} disabled={busy||!teacher.length}>
        {teacher.length?teacher.map(p=><option key={p.id} value={p.id}>{p.name} · {classNames(p.className).filter(n=>classes.some(c=>classKey(c.name)===classKey(n))).length} lớp</option>):<option value="">Không có giảng viên</option>}
       </select></label>
       <button type="button" disabled={!selectedClass||!selectedTeacher||busy} onClick={()=>setSimulated(true)}>Mô phỏng — không lưu</button>
      </div>
      {scenario?<div className={styles.simulation} role="status">
        <strong>{scenario.valid?"Phương án xem trước":"Không đủ điều kiện"}</strong>
        <p>{scenario.reason}</p>
        {scenario.valid?<p>Dự kiến tải phân công: <b>{scenario.currentClassLoad} → {scenario.proposedClassLoad} lớp</b>. Có {scenario.scheduledSessions} buổi đã xếp trong khoảng xem.</p>:null}
        {scenario.limitations.map((warning,i)=><p key={i}>{warning}</p>)}
        {scenario.valid?<button type="button" onClick={()=>navigate("people")}>Đến Nhân sự để xét duyệt <Glyph name="arrow"/></button>:null}
       </div>:null}
     </section>
    </aside>
   </div>
   <ManagerAiAllocationPanelV42 board={board} onNavigate={onNavigate} onReviewProposal={onReviewAllocation} getProof={getProof}/>
   <ManagerAiFollowonV41 board={board} report={report}/>
   <footer className={styles.footer}>V41.0–V42 · Các năng lực đã bật vẫn là phân tích có bằng chứng, chưa hỗ trợ tự thực thi, dự báo ML hoặc kết luận vượt phạm vi dữ liệu. Mọi quyết định do cán bộ phê duyệt.</footer>
  </section>;
}
