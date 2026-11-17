/**
 * V42: prioritize already-permissioned, media-free video summaries for a teacher.
 * Evidence is provisional; only a human instructor may accept and send a task.
 */
import type {TeacherVideoAnalysis,TeacherVideoReview} from "./teacher-video-result-details";

type LearnerVideoInput={
 lastAnalysis:TeacherVideoAnalysis|null;latestTeacherAction:TeacherVideoReview|null;
 latestVideoReview?:TeacherVideoReview|null;
 adaptive?:{priorityLesson?:string}|null;lastLesson?:string|null;
};
export type VideoCoachingDecision={
 rank:number;label:string;reason:string;nextStep:string;
 exerciseTitle:string;exerciseNote:string;lessonNumber:string;
 evidenceStatus:"sufficient"|"capture-review"|"missing";
 canDraftExercise:boolean;humanReviewed:boolean;
};
const valid=(value:unknown):value is number=>
 typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=100;
const categories=[
 ["legs","Động tác chân"],["arms","Động tác tay"],
 ["coordination","Phối hợp tay – chân – thở"],["bodyLine","Tư thế thân người"]
] as const;
const safeText=(text:unknown,max=160)=>typeof text==="string"?
 text.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max):"";
export function prioritizeTeacherVideo(learner:LearnerVideoInput):VideoCoachingDecision {
 const analysis=learner.lastAnalysis;
 const lessonNumber=/^0[1-8]$/.test(learner.adaptive?.priorityLesson??"")?
  learner.adaptive!.priorityLesson!: /^0[1-8]$/.test(learner.lastLesson??"")?learner.lastLesson!:"01";
 const review=learner.latestVideoReview??learner.latestTeacherAction;
 const reviewed=Boolean(analysis?.analyzedAt&&review?.action==="review"&&
  review.analysisAt===analysis.analyzedAt);
 if(!analysis)return {rank:-1,label:"Chưa có phân tích",reason:"Chưa có bản tóm tắt video.",
  nextStep:"Chờ học viên phân tích và đồng bộ kết quả.",
  exerciseTitle:"",exerciseNote:"",lessonNumber,evidenceStatus:"missing",canDraftExercise:false,humanReviewed:false};
 if(analysis.captureQuality!=="good"||!valid(analysis.confidence)||analysis.confidence<70){
  return {rank:3,label:"Ưu tiên xác minh video",reason:"Chất lượng ghi hình hoặc độ tin cậy nhận diện chưa đạt ngưỡng đối chiếu.",
   nextStep:"Hướng dẫn quay lại dưới góc rõ, đủ sáng, đủ cơ thể; không kết luận sai kỹ thuật từ video yếu.",
   exerciseTitle:"",exerciseNote:"",lessonNumber,evidenceStatus:"capture-review",canDraftExercise:false,humanReviewed:reviewed};
 }
 const weak=categories.map(([key,name])=>({key,name,score:analysis.categories?.[key]}))
  .filter(c=>valid(c.score))
  .map(c=>({...c,score:c.score as number}))
  .sort((a,b)=>a.score-b.score)[0];
 const error=(analysis.errors??[]).find(e=>e.severity==="critical")??analysis.errors?.[0];
 const issue=error?.title||analysis.topErrors?.[0]||"";
 const recommendations=(analysis.errors??[]).map(e=>safeText(e.recommendation,180)).filter(Boolean);
 const citedGuidance=(analysis.publishedGuidance??[]).slice(0,2);
 const priority=Boolean((error?.severity==="critical")||(valid(analysis.score)&&analysis.score<70)||
   (weak&&weak.score<60));
 const coaching=Boolean(issue||(weak&&weak.score<80)||(valid(analysis.score)&&analysis.score<80));
 const focus=weak&&weak.score<80?weak.name:issue?"Lỗi kỹ thuật được AI ghi nhận":"Tổng hợp kỹ thuật";
 const note=[
  "Căn cứ: bản phân tích AI "+(analysis.analyzedAt??"không rõ thời điểm")+".",
  weak?"Nhóm cần đối chiếu: "+weak.name+" ("+weak.score+"/100).":"",
  issue?"Dấu hiệu cần kiểm tra trực tiếp: "+safeText(issue,120)+".":"",
  recommendations.length?"Gợi ý từ bản phân tích: "+recommendations.slice(0,2).join("; ")+".":"",
  ...citedGuidance.map(item=>"Giáo trình đã xuất bản và duyệt, bản "+item.versionNumber+
    ", mục "+safeText(item.sourceItemId,55)+": "+safeText(item.correction,180)+". "+
    (item.practice?"Luyện tham chiếu: "+safeText(item.practice,120)+".":"")),
  "Giảng viên kiểm tra lại kỹ thuật trong buổi thực hành, điều chỉnh mục tiêu, số lần tập và an toàn trước khi gửi.",
 ].filter(Boolean).join("\n").slice(0,1150);
 return {rank:reviewed?0:priority?2:coaching?1:0,
  label:reviewed?"Đã review lượt này":priority?"Cần sửa kỹ thuật sớm":coaching?"Cần hướng dẫn động tác":"Theo dõi định kỳ",
  reason:issue?safeText(issue):weak?"Nhóm "+weak.name+" có điểm thấp nhất trong dữ liệu đã ghi nhận.":"Chưa có lỗi ưu tiên đáng tin cậy.",
  nextStep:coaching?"Xem bằng chứng từng lỗi, đối chiếu tại bể rồi xác nhận bài tập.":"Tiếp tục theo dõi và đánh giá trực tiếp.",
  exerciseTitle:"Luyện tập: "+focus,exerciseNote:note,lessonNumber,
  evidenceStatus:"sufficient",canDraftExercise:coaching&&!reviewed,humanReviewed:reviewed};
}
