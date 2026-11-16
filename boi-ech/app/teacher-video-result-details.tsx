"use client";

export type TeacherVideoIssue = {
 title:string;severity:"warning"|"critical";timeSec:number|null;
 observed:string;expected:string;recommendation:string;confidence:number|null;
};
export type TeacherPublishedGuidance={
 source:"published-course-content";versionId:string;versionNumber:number;reviewedBy:string;publishedAt:string;
 lessonNumber:string;sourceItemId:string;title:string;correction:string;practice:string;
};
export type TeacherVideoAnalysis = {
 score:number|null;confidence:number|null;captureQuality:"good"|"review";
 poseCoverage:number|null;averageVisibility:number|null;
 sampledFrames:number|null;detectedFrames:number|null;durationSec:number|null;
 cameraView:"rear"|"side";
 categories:{legs:number|null;arms:number|null;coordination:number|null;bodyLine:number|null};
 errorCount:number;topErrors:string[];errors:TeacherVideoIssue[];analyzedAt:string|null;
 publishedGuidance?:TeacherPublishedGuidance[];
};
export type TeacherVideoReview = {
 action:"feedback"|"assignment"|"review";reviewStatus:""|"reviewed"|"follow-up";
 analysisAt:string;note:string;teacherName:string;
};
export type TechnicalLevel="needs-practice"|"developing"|"fair"|"strong";
export function technicalLevel(score:number):{id:TechnicalLevel;label:string;priority:string}{
 if(score<50)return {id:"needs-practice",label:"Cần luyện tập lại",priority:"Ưu tiên sửa các lỗi kỹ thuật được phát hiện và quay lại để so sánh."};
 if(score<70)return {id:"developing",label:"Đang hoàn thiện",priority:"Luyện thêm các pha động tác có điểm thấp, kết hợp nhận xét của Giảng viên."};
 if(score<85)return {id:"fair",label:"Tương đối tốt",priority:"Tiếp tục tối ưu các động tác chưa đồng đều và xác minh bằng lượt quay tiếp theo."};
 return {id:"strong",label:"Tốt theo thang AI",priority:"Duy trì kỹ thuật và nhờ Giảng viên xác nhận trực tiếp khi cần."};
}
export function reliableVideoEvidence(item:TeacherVideoAnalysis){
 return item.captureQuality==="good"&&item.confidence!==null&&item.confidence>=70;
}
export function validMetric(n:unknown,max=100):number|null{
 return typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=max?n:null;
}
export function teacherReviewForAnalysis(review:TeacherVideoReview|null|undefined,item:TeacherVideoAnalysis){
 if(!review||review.action!=="review"||!item.analyzedAt||!review.analysisAt||review.analysisAt!==item.analyzedAt)return null;
 return review;
}
export function formatDecimal(value:number){return (Math.round(value*10)/10).toLocaleString("vi-VN",{maximumFractionDigits:1});}
export function scoreToTen(score:number){return formatDecimal(score/10);}
export function qualityStatement(item:TeacherVideoAnalysis):{id:"sufficient"|"limited";title:string;detail:string}{
 const sufficient=reliableVideoEvidence(item);
 return sufficient?{
  id:"sufficient",title:"Đủ điều kiện đối chiếu",
  detail:"Chất lượng ghi hình và độ tin cậy đạt ngưỡng hệ thống. Điều này không có nghĩa động tác đã đúng hoặc đã được Giảng viên xác nhận."
 }:{
  id:"limited",title:"Cần đối chiếu thêm",
  detail:"Video chưa đáp ứng đồng thời chất lượng khung hình và độ tin cậy tối thiểu 70%. Không dùng kết quả AI này làm kết luận kỹ thuật cuối cùng."
 };
}
const categories=[{key:"legs",name:"Động tác chân",help:"Thu, mở, đạp khép chân"},
 {key:"arms",name:"Động tác tay",help:"Kéo, thu, duỗi tay"},
 {key:"coordination",name:"Phối hợp",help:"Nhịp tay – chân – lướt"},
 {key:"bodyLine",name:"Tư thế thân",help:"Giữ trục thân ổn định"}] as const;
const pct=(v:number|null)=>v===null?"Chưa có dữ liệu":v+" / 100";
const instant=(value:string|null)=>{if(!value)return "Chưa ghi nhận";const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d):"Chưa ghi nhận";};
export default function TeacherVideoResultDetails({analysis,review}:{
 analysis:TeacherVideoAnalysis;review:TeacherVideoReview|null|undefined;
}){
 const level=analysis.score===null?null:technicalLevel(analysis.score),quality=qualityStatement(analysis);
 const human=teacherReviewForAnalysis(review,analysis);
 const sorted=categories.map(row=>({...row,score:validMetric(analysis.categories?.[row.key])}))
  .filter((row):row is (typeof row & {score:number})=>row.score!==null)
  .sort((a,b)=>a.score-b.score);
 const weak=sorted[0]??null;
 return <section className="teacher-video-result" aria-label={"Báo cáo kỹ thuật AI lúc "+instant(analysis.analyzedAt)}>
  <header className="teacher-video-result-head">
   <div><span>KẾT QUẢ PHÂN TÍCH · THAM KHẢO</span><h3>Đánh giá chi tiết kỹ thuật bơi ếch</h3>
    <p>{instant(analysis.analyzedAt)} · {analysis.cameraView==="side"?"Góc ngang":"Góc sau"}</p></div>
   <span className="teacher-video-quality" data-quality={quality.id}>{quality.title}</span>
  </header>
  <div className="teacher-video-kpis">
   <article><span>Điểm kỹ thuật AI</span><strong>{analysis.score===null?"Chưa có dữ liệu":<>{scoreToTen(analysis.score)}<small>/10</small></>}</strong><small>{analysis.score===null?"Kết quả cũ chưa lưu điểm tổng":analysis.score+"/100 điểm · không phải điểm Giảng viên"}</small></article>
   <article><span>Độ tin cậy nhận diện</span><strong>{analysis.confidence===null?"Chưa có dữ liệu":<>{analysis.confidence}<small>%</small></>}</strong><small>Độ chắc chắn của phân tích, không phải % đúng kỹ thuật</small></article>
   <article data-level={level?.id??"unknown"}><span>Nhận định theo thang AI</span><strong>{level?.label??"Chưa đủ số liệu"}</strong><small>{quality.id==="limited"?"Chưa đủ bằng chứng để kết luận":level?"Dựa trên điểm số do AI tạo ra":"Điểm tổng không có trong sự kiện này"}</small></article>
  </div>
  <div className="teacher-video-limits" data-quality={quality.id}>
    <strong>{quality.title}</strong><p>{quality.detail}</p>
  </div>
  <section className="teacher-video-breakdown" aria-label="Bốn nhóm kỹ thuật được AI chấm điểm">
   <h4>4 nhóm kỹ thuật</h4>
   <p>Điểm của từng nhóm được đọc từ bản phân tích gốc; không tự phân bổ điểm tổng để lấp dữ liệu thiếu.</p>
   <div className="teacher-video-category-grid">
    {categories.map(cat=>{const v=validMetric(analysis.categories?.[cat.key]);return <div key={cat.key} className="teacher-video-category" data-weak={weak?.key===cat.key&&v!==null?"true":"false"}>
      <div><strong>{cat.name}</strong><span>{pct(v)}</span></div>
      <small>{cat.help}</small>
      {v===null?<p>Chưa được ghi nhận trong kết quả này</p>:<progress aria-label={"Điểm "+cat.name} value={v} max={100}/>}
     </div>;})}
   </div>
   {weak?<p className="teacher-video-priority"><strong>Ưu tiên luyện tập:</strong> {weak.name} ({weak.score}/100) là nhóm có điểm thấp nhất trong những nhóm đã được ghi nhận.</p>
    :<p className="teacher-video-priority">Chưa đủ dữ liệu điểm nhóm để xác định động tác cần ưu tiên.</p>}
  </section>
  {analysis.score!==null&&analysis.score>=85&&analysis.errorCount>0?<p className="teacher-video-score-discrepancy" role="note">
   <strong>Điểm cao vẫn có lỗi:</strong> AI ghi nhận {analysis.errorCount} lỗi kỹ thuật dù điểm tổng là {analysis.score}/100.
   Điểm tổng, điểm theo nhóm và các lỗi quy tắc không phải một phép cộng trừ trực tiếp.
   Cần kiểm tra lỗi cụ thể trước khi kết luận.
  </p>:null}
  <section className="teacher-video-errors" aria-label="Lỗi kỹ thuật và hướng cải thiện">
   <h4>{analysis.errorCount>0?`Lỗi kỹ thuật phát hiện: ${analysis.errorCount}`:"Không ghi nhận lỗi theo bộ quy tắc hiện tại"}</h4>
   {analysis.errors.length?<ol>{analysis.errors.map((error,i)=><li key={i} data-severity={error.severity}>
     <header><strong>{error.title}</strong><span>{error.severity==="critical"?"Ưu tiên cao":"Cần điều chỉnh"}{error.timeSec!==null?` · khoảng ${formatDecimal(error.timeSec)} giây`:""}</span></header>
     {error.observed?<p><b>AI quan sát:</b> {error.observed}</p>:null}
     {error.expected?<p><b>Động tác tham chiếu:</b> {error.expected}</p>:null}
     {error.recommendation?<p className="teacher-video-correction"><b>Nên luyện:</b> {error.recommendation}</p>:<p>Chưa có hướng dẫn điều chỉnh cụ thể trong bản ghi này.</p>}
     </li>)}</ol>:<p>{analysis.errorCount>0?"Bản phân tích cũ chỉ có tên lỗi; chưa có bằng chứng chi tiết để hiển thị.":"Không phát hiện lỗi theo các quy tắc đang áp dụng không đồng nghĩa đã đạt chuẩn bơi thực tế."}</p>}
   {analysis.errorCount>analysis.errors.length?<small>Chỉ hiển thị tối đa {analysis.errors.length} lỗi có thông tin chi tiết trong bản tóm tắt hiện tại.</small>:null}
  </section>
  <section className="teacher-video-evidence" aria-label="Đối chiếu giáo trình đã xuất bản">
   <h4>Đối chiếu giáo trình có kiểm duyệt</h4>
   {analysis.publishedGuidance?.length?
    <ol>{analysis.publishedGuidance.map(item=><li key={item.versionId+":"+item.sourceItemId}>
      <strong>{item.title}</strong>
      <p><b>Trong giáo trình:</b> {item.correction}</p>
      {item.practice?<p><b>Bài tập tham chiếu:</b> {item.practice}</p>:null}
      <small>Nguồn: Bản giáo trình #{item.versionNumber} · mục {item.sourceItemId} ·
       Giảng viên/biên tập duyệt: {item.reviewedBy} · Xuất bản: {instant(item.publishedAt)}</small>
     </li>)}</ol>:
    <p>Chưa tìm thấy nội dung khớp trong bản giáo trình đã xuất bản và có người duyệt. Không tự tạo chỉ dẫn thay thế.</p>}
  </section>
  <section className="teacher-video-evidence" aria-label="Thông số chất lượng video được lưu">
   <h4>Căn cứ chất lượng ghi hình</h4>
   <dl>
    <div><dt>Tư thế nhận diện được</dt><dd>{pct(validMetric(analysis.poseCoverage))}</dd></div>
    <div><dt>Độ hiển thị trung bình</dt><dd>{pct(validMetric(analysis.averageVisibility))}</dd></div>
    <div><dt>Khung hình nhận diện</dt><dd>{validMetric(analysis.detectedFrames,240)===null?"Chưa có dữ liệu":analysis.detectedFrames} / {validMetric(analysis.sampledFrames,240)===null?"—":analysis.sampledFrames}</dd></div>
    <div><dt>Thời lượng phân tích</dt><dd>{validMetric(analysis.durationSec,30)===null?"Chưa có dữ liệu":formatDecimal(analysis.durationSec! )+" giây"}</dd></div>
   </dl>
  </section>
  <section className="teacher-video-human" aria-label="Đánh giá độc lập của Giảng viên">
   <h4>Xác nhận chuyên môn của Giảng viên</h4>
   {human?<><strong>{human.reviewStatus==="follow-up"?"Đã đánh dấu cần theo dõi thêm":"Đã ghi nhận review"}</strong>
    <p>{human.note||"Không có nội dung nhận xét bổ sung."}</p><small>{human.teacherName} · liên kết đúng lượt phân tích này</small></>
    :<><strong>Chưa tìm thấy review liên kết với lượt phân tích này</strong>
     <p>Giảng viên cần xem lại bằng chứng và đánh giá riêng. Thông tin ở đây không khẳng định chưa từng có review trong toàn bộ lịch sử.</p></>}
  </section>
  <footer className="teacher-video-disclaimer">
   <strong>Kết luận sử dụng:</strong> {quality.id==="sufficient"&&level?level.priority:"Ưu tiên quay lại với đủ tư thế, ánh sáng và góc quay rõ trước khi quyết định kỹ thuật."}
   {" "}Kết quả này không chứng minh học viên bơi an toàn trong nước. Video/ảnh gốc không được chuyển về bảng Giảng viên.
  </footer>
 </section>;
}
