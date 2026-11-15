"use client";

// Display only already-authorized teacher overview / assignment aggregates.
// This presentation must never synthesize training results or AI outcomes.
type Learner={progress:number;needsSupport:boolean;inactiveDays:number|null;totalActiveMinutes:number};
type Assignment={scheduleState:"open"|"upcoming"|"acknowledged"|"completed"|"needs-help"|"overdue"};
type Props={tab:"learners"|"tasks"|"reports";learners:Learner[];assignments:Assignment[]};
export function TeacherPremiumMetrics({tab,learners,assignments}:Props){
 const completed=learners.filter(x=>x.progress>=100).length;
 const needs=learners.filter(x=>x.needsSupport).length;
 const active=learners.filter(x=>x.inactiveDays!==null&&x.inactiveDays<=7).length;
 const minutes=learners.reduce((s,x)=>s+Math.max(0,x.totalActiveMinutes),0);
 const avg=learners.length?Math.round(learners.reduce((s,x)=>s+x.progress,0)/learners.length):0;
 const open=assignments.filter(x=>["open","upcoming","acknowledged"].includes(x.scheduleState)).length;
 const overdue=assignments.filter(x=>x.scheduleState==="overdue").length;
 const done=assignments.filter(x=>x.scheduleState==="completed").length;
 const help=assignments.filter(x=>x.scheduleState==="needs-help").length;
 const metrics=tab==="learners"?[
  ["Tổng học viên",String(learners.length),"Trong phạm vi lớp đang chọn"],
  ["Hoạt động 7 ngày",String(active),"Theo dữ liệu học gần nhất"],
  ["Cần hỗ trợ",String(needs),"Theo tín hiệu giám sát"],
  ["Hoàn thành",String(completed),"Đã đạt 100% tiến độ"]
 ]:tab==="tasks"?[
  ["Đang thực hiện",String(open),"Nhiệm vụ đã gửi"],
  ["Quá hạn",String(overdue),"Cần theo dõi"],
  ["Hoàn thành",String(done),"Đã ghi nhận"],
  ["Cần hỗ trợ",String(help),"Học viên yêu cầu giúp đỡ"]
 ]:[
  ["Tiến độ trung bình",avg+"%","Dựa trên hồ sơ hiện có"],
  ["Hoàn thành",String(completed),"Đạt 100% tiến độ"],
  ["Thời gian học",Math.round(minutes/60)+" giờ",minutes+" phút đã ghi nhận"],
  ["Cần hỗ trợ",String(needs),"Không nội suy kết quả AI"]
 ];
 return <div className="premium-tab-metrics" aria-label="Số liệu thực tế từ máy chủ">
  {metrics.map(([label,value,note],i)=><article key={label} data-tone={i===2?"green":i===3?"red":"blue"}>
   <div className="premium-metric-icon" aria-hidden="true">{i===0?"↗":i===1?"◉":i===2?"✓":"!"}</div>
   <div><strong>{value}</strong><span>{label}</span><small>{note}</small></div>
  </article>)}
 </div>;
}
export function TeacherPremiumProgress({learners}:{learners:Learner[]}){
 const buckets=[["Chưa bắt đầu",0,0],["Đang học 1–49%",1,49],["Gần hoàn thành 50–99%",50,99],["Hoàn thành 100%",100,100]] as const;
 return <section className="teacher-white-card premium-progress-distribution" aria-label="Biểu đồ phân bố tiến độ">
  <header><div><strong>Phân bố tiến độ học tập</strong><small>Thống kê từ dữ liệu hiện tại · Không phải dự đoán AI</small></div></header>
  <div className="premium-progress-bars">{buckets.map(([name,lo,hi])=>{const count=learners.filter(l=>l.progress>=lo&&l.progress<=hi).length;
   return <div className="premium-progress-band" key={name}><span>{name}</span><div className="premium-bar-track"><i style={{width:(learners.length?Math.round(count/learners.length*100):0)+"%"}}/></div><strong>{count}</strong></div>;})}</div>
 </section>;
}
