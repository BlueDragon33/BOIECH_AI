/**
 * V48 deterministic teacher queue: evidence-aware, fair per learner, and honest
 * about limits. It never scores health, invents AI confidence or sends actions.
 */
export type TriageSuggestionV48={
 id:string;mode:"feedback"|"assignment"|"review";
 priority:"critical"|"high"|"normal";lessonNumber:string;
 title:string;reason:string;evidence:string[];
};
export type TriageLearnerV48={
 name:string;personCode:string;className:string;
 interventionSuggestions:TriageSuggestionV48[];
 lastAnalysis?:{confidence:number;captureQuality:"good"|"review"}|null;
 learningAnalytics?:{latest?:{observedChange:string}|null}|null;
};
export type TriageItemV48<T extends TriageLearnerV48>={
 learner:T;suggestion:T["interventionSuggestions"][number];
 urgency:0|1|2|3|4;evidenceCaution:boolean;
 explanation:string;
};
export type TeacherQueueV48<T extends TriageLearnerV48>={
 items:TriageItemV48<T>[];
 totalEligible:number;hidden:number;rejected:number;
 possiblyIncomplete:boolean;distinctLearners:number;limitations:string[];
};
const priority=(key:TriageSuggestionV48["priority"])=>
 key==="critical"?3:key==="high"?2:1;
const hasPoorVideo=(x:TriageLearnerV48)=>Boolean(x.lastAnalysis&&
 (!Number.isFinite(x.lastAnalysis.confidence)||x.lastAnalysis.confidence<70||
 x.lastAnalysis.captureQuality!=="good"));
export function buildTeacherEvidenceQueueV48<T extends TriageLearnerV48>(
 learners:readonly T[],opts:{limit?:number;sourcePossiblyTruncated?:boolean}={}
):TeacherQueueV48<T>{
 const limit=Number.isInteger(opts.limit)?Math.max(1,Math.min(50,opts.limit!)):18;
 let rejected=0;const groups=new Map<string,TriageItemV48<T>[]>();
 const ordered=learners.slice(0,500);
 for(const learner of ordered){
  if(!/^[^\s]{1,128}$/.test(learner.personCode)||!Array.isArray(learner.interventionSuggestions)){
   rejected++;continue;
  }
  const found=groups.get(learner.personCode)??[];
  const seen=new Set(found.map(i=>i.suggestion.mode+":"+i.suggestion.lessonNumber));
  for(const item of learner.interventionSuggestions.slice(0,30)){
   if(!item||!["feedback","assignment","review"].includes(item.mode)||
      !["critical","high","normal"].includes(item.priority)||
      !/^0[1-8]$/.test(item.lessonNumber)||typeof item.id!=="string"){
    rejected++;continue;
   }
   const key=item.mode+":"+item.lessonNumber;
   if(seen.has(key))continue;
   seen.add(key);
   const weak=hasPoorVideo(learner);
   const outcome=learner.learningAnalytics?.latest?.observedChange??"";
   const followUp=outcome==="negative"||outcome==="mixed";
   const urgentReview=weak&&item.mode==="review";
   const urgency=(urgentReview?4:followUp&&item.priority==="critical"?4:
    priority(item.priority)) as 1|2|3|4;
   found.push({learner,suggestion:item,urgency,
    evidenceCaution:weak&&item.mode!=="review",
    explanation:urgentReview?"Xác minh chất lượng video trước khi kết luận lỗi kỹ thuật.":
     followUp?"Sau can thiệp có tín hiệu chưa cải thiện; cần kiểm chứng nguyên nhân trực tiếp.":
     weak?"Video gần nhất chưa đủ tin cậy, không suy lỗi kỹ thuật từ video này.":
     "Cần Giảng viên đối chiếu nguồn trước khi gửi hành động."});
  }
  found.sort((a,b)=>b.urgency-a.urgency||a.suggestion.id.localeCompare(b.suggestion.id));
  groups.set(learner.personCode,found);
 }
 const all=[...groups.entries()].filter(([,list])=>list.length).sort(([a],[b])=>a.localeCompare(b));
 const totalEligible=all.reduce((sum,[,items])=>sum+items.length,0);
 const items:TriageItemV48<T>[]=[];
 // A first critical task from a learner must not permanently starve other learners.
 // Round-robin groups within risk tiers; never alter or auto-submit suggestions.
 while(items.length<limit){
  const ready=all.filter(([,list])=>list.length);
  if(!ready.length)break;
  const best=Math.max(...ready.map(([,list])=>list[0].urgency));
  const candidates=ready.filter(([,list])=>list[0].urgency===best);
  for(const [,list] of candidates){
   if(items.length>=limit)break;
   items.push(list.shift()!);
  }
 }
 const hidden=totalEligible-items.length;
 return {items,totalEligible,hidden,rejected,
  possiblyIncomplete:Boolean(opts.sourcePossiblyTruncated)||learners.length>500||hidden>0||rejected>0,
  distinctLearners:all.length,
  limitations:[
   "Độ ưu tiên là thứ tự xem xét, không phải điểm rủi ro sức khỏe hay đánh giá năng lực thực tế.",
   "Phân bổ công bằng theo học viên khi các mức ưu tiên ngang nhau; không gửi bài hay phản hồi tự động.",
   "Bằng chứng AI video cần được Giảng viên xác minh trực tiếp trước khi can thiệp."
  ]};
}
