/**
 * V48 learner evidence hygiene. Pure deterministic client model over a
 * SIGNED learner bootstrap only. No new profiling, persistence or inference.
 * Mastery is a heuristic, never measured swimming proficiency certification.
 */
type Competency={
 lessonNumber:string;mastery:number;attempts:number;score:number|null;unlocked:boolean;
};
type PlanItem={id:string;minutes:number;lessonNumber:string;section:string;title:string;reason:string};
export type LearnerEvidenceInputV48={
 generatedAt:string;priorityLesson:string;competencies:Competency[];
 todayPlan:PlanItem[];
};
export type LearnerDecisionV48={
 sourceStatus:"fresh"|"stale"|"invalid";
 evidenceStatus:"missing"|"provisional"|"observed";
 priorityMastery:number|null;
 observedLessons:number;unlockedLessons:number;
 usablePlan:PlanItem[];
 planStatus:"ready"|"exploratory"|"paused";
 checkpoint:string;limitations:string[];
};
const sections=new Set(["hoc-tap","thuc-hanh","phan-tich","on-tap","kiem-tra"]);
const validScore=(x:unknown):x is number=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=100;
const lesson=(x:string)=>/^0[1-8]$/.test(x);
const validTime=(value:unknown):value is string=>typeof value==="string"&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&
 Number.isFinite(Date.parse(value))&&
 // Validate the calendar day as written, not the UTC day after applying its offset.
 new Date(value.slice(0,10)+"T00:00:00Z").toISOString().slice(0,10)===value.slice(0,10);

export function assessLearnerEvidenceV48(input:LearnerEvidenceInputV48,nowMs:number):LearnerDecisionV48{
 const invalid= !Number.isFinite(nowMs)||!validTime(input.generatedAt);
 const age=invalid?NaN:nowMs-Date.parse(input.generatedAt);
 const sourceStatus:LearnerDecisionV48["sourceStatus"]=invalid||age < -5*60_000?
  "invalid":age>24*60*60_000?"stale":"fresh";
 const unlocked=Array.isArray(input.competencies)?
  input.competencies.filter(c=>c&&c.unlocked&&lesson(c.lessonNumber)):[];
 const priority=unlocked.find(c=>c.lessonNumber===input.priorityLesson);
 const observed=unlocked.filter(c=>Number.isSafeInteger(c.attempts)&&c.attempts>0&&
  validScore(c.score)&&validScore(c.mastery));
 const priorityHasEvidence=Boolean(priority&&observed.includes(priority));
 const evidenceStatus:LearnerDecisionV48["evidenceStatus"]=!observed.length?
  "missing":observed.length<2||!priorityHasEvidence?"provisional":"observed";
 const priorityMastery=priorityHasEvidence?priority!.mastery:null;
 const trusted=new Set(unlocked.map(c=>c.lessonNumber));
 const safe=Array.isArray(input.todayPlan)?input.todayPlan.filter(p=>
  p&&typeof p.id==="string"&&p.id.length>0&&p.id.length<=128&&
  typeof p.title==="string"&&p.title.length<=160&&typeof p.reason==="string"&&
  p.reason.length<=500&&trusted.has(p.lessonNumber)&&sections.has(p.section)&&
  Number.isSafeInteger(p.minutes)&&p.minutes>=1&&p.minutes<=30):[];
 const unique=new Set<string>();let minutes=0;
 const usablePlan:PlanItem[]=[];
 if(sourceStatus==="fresh")for(const p of safe){
  if(usablePlan.length>=3||unique.has(p.id)||minutes+p.minutes>60)continue;
  unique.add(p.id);minutes+=p.minutes;usablePlan.push(p);
 }
 const planStatus:LearnerDecisionV48["planStatus"]=sourceStatus!=="fresh"||!usablePlan.length?
  "paused":evidenceStatus==="observed"?"ready":"exploratory";
 const checkpoint=sourceStatus!=="fresh"?
  "Dữ liệu học tập chưa mới hoặc mốc không hợp lệ; hãy tải lại trước khi theo kế hoạch.":
  !priority?"Bài ưu tiên chưa thuộc phần đã mở; cần chọn lại theo lộ trình có quyền.":
  !priorityHasEvidence?
  "Chưa đủ lượt kiểm tra bài ưu tiên để kết luận thành thạo; học phần đã mở và tự kiểm tra để bổ sung bằng chứng.":
  priority!.attempts<3?
  "Đã có ít nhất một tín hiệu, chưa đủ các lượt đối chiếu; luyện đúng phần và làm lại kiểm tra sau khi học.":
  "Kiểm chứng tiến bộ bằng lượt kiểm tra mới và quan sát trực tiếp của Giảng viên, không suy điểm năng lực bơi thực tế.";
 return {sourceStatus,evidenceStatus,priorityMastery,
  observedLessons:observed.length,unlockedLessons:unlocked.length,
  usablePlan,planStatus,checkpoint,limitations:[
   "Mastery/điểm là suy luận từ hoạt động học, không phải xác nhận kỹ năng bơi tại bể.",
   "Không sử dụng video gốc, dữ liệu sức khỏe hay học viên khác để lập kế hoạch.",
   "Chỉ mở bài học đã được cấp quyền; không tự chấm, mở khóa hay ghi tiến độ."
  ]};
}
