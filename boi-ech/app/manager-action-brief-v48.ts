/**
 * V48 "what should I inspect next?" for an already signed manager snapshot.
 * Aggregates ONLY source-cited findings the report exposed; never pretends
 * to solve the global assignment or schedule optimization problem.
 */
import type {ManagerAiReport,ManagerAiPriority,ManagerAiDestination,ManagerAiEvidence} from "./manager-ai-evidence-v41";

export type ManagerActionBriefV48={
 target:ManagerAiDestination;title:string;priority:ManagerAiPriority;
 reportedItems:number;findingIds:string[];referenceIds:string[];
 proposedReview:string;requiresHumanReview:true;
};
export type ManagerDecisionBriefV48={
 status:"invalid"|"stale"|"partial"|"scoped";
 groups:ManagerActionBriefV48[];shown:number;reportedTotal:number;
 warnings:string[];requiresHumanReview:true;
};
const sourceKinds=new Set(["resources","people","sessions","teacherClassTerms"]);
const weight:Record<ManagerAiPriority,number>={critical:4,high:3,medium:2,info:1};
const label:Record<ManagerAiDestination,string>={
 people:"Kiểm tra nhân sự",class:"Kiểm tra sĩ số và lớp",
 schedule:"Kiểm tra buổi học trùng",room:"Kiểm tra phòng/bể"
};
const valid=(t:string)=>{
 if(typeof t!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(t))return false;
 const ms=Date.parse(t);
 // Reject impossible calendar days which Date.parse may silently normalize.
 return Number.isFinite(ms)&&
  new Date(t.slice(0,10)+"T00:00:00Z").toISOString().slice(0,10)===t.slice(0,10);
};
export function buildManagerDecisionBriefV48(report:ManagerAiReport,nowMs:number,max=4):ManagerDecisionBriefV48{
 const observed=report.observedAt,sourceValid=valid(observed)&&Number.isFinite(nowMs);
 const age=sourceValid?nowMs-Date.parse(observed):NaN;
 const isInvalid=!sourceValid||age< -5*60_000;
 const stale=!isInvalid&&age>5*60_000;
 const partial=report.truncated||report.sourceMayBeTruncated||report.conflictExamplesLimited||
  report.totalFindings>report.findings.length;
 const status:ManagerDecisionBriefV48["status"]=isInvalid?"invalid":stale?"stale":partial?"partial":"scoped";
 const groups=new Map<ManagerAiDestination,ManagerActionBriefV48>();
 for(const finding of report.findings.slice(0,100)){
  if(!finding||!label[finding.target]||!weight[finding.priority])continue;
  const references=(finding.evidence??[]).filter((x):x is ManagerAiEvidence=>
   Boolean(x&&sourceKinds.has(x.source)&&typeof x.recordId==="string"&&x.recordId.length>0));
  const before=groups.get(finding.target);
  const higher=!before||weight[finding.priority]>weight[before.priority];
  const ids=[...(before?.referenceIds??[]),...references.map(x=>x.source+":"+x.recordId)];
  const normalized=[...new Set(ids)].slice(0,6);
  groups.set(finding.target,{
   target:finding.target,title:label[finding.target],priority:higher?finding.priority:before!.priority,
   reportedItems:(before?.reportedItems??0)+1,
   findingIds:[...(before?.findingIds??[]),finding.id].slice(0,6),
   referenceIds:normalized,
   proposedReview:higher?finding.recommendedAction:before!.proposedReview,
   requiresHumanReview:true
  });
 }
 const items=[...groups.values()].sort((a,b)=>weight[b.priority]-weight[a.priority]||
  b.reportedItems-a.reportedItems||a.target.localeCompare(b.target));
 const limit=Number.isInteger(max)?Math.max(1,Math.min(4,max)):4;
 const warnings:string[]=[];
 if(isInvalid)warnings.push("Mốc snapshot không xác thực hoặc ở tương lai; không dùng để quyết định.");
 else if(stale)warnings.push("Snapshot quá 5 phút; tải lại bảng trước khi duyệt các thay đổi.");
 if(partial)warnings.push("Nguồn/báo cáo bị giới hạn; việc không thấy cảnh báo không chứng minh không có rủi ro.");
 if(items.some(x=>x.referenceIds.length===0))warnings.push("Một số gợi ý chưa có bản ghi dẫn nguồn; phải tra nguồn trước khi xử lý.");
 if(!items.length)warnings.push("Không thấy tín hiệu trong phần báo cáo đã tải; không chứng minh an toàn tuyệt đối.");
 return {status,groups:items.slice(0,limit),shown:report.findings.length,
  reportedTotal:report.totalFindings,warnings,requiresHumanReview:true};
}
