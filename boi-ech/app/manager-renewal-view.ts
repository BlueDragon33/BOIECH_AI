import {isUnlimitedAccountExpiry} from "./account-term";

export type RenewalRole="learner"|"teacher";
export type RenewalStatus="all"|"soon"|"permanent"|"expired";
export type TermState="permanent"|"active"|"soon"|"expired"|"unknown";

export type RenewalRow={
 accountId:string;name:string;role:RenewalRole;expiresAt:string;revision:number;
 progress?:{completed:number;total:number}|null
};
const DAY=86_400_000;
export function accountTermState(expiresAt:string,now:number):TermState{
 if(isUnlimitedAccountExpiry(expiresAt))return "permanent";
 const expiry=Date.parse(expiresAt);
 if(!Number.isFinite(expiry)||!Number.isFinite(now))return "unknown";
 if(expiry<=now)return "expired";
 return expiry-now<=30*DAY?"soon":"active";
}
export function remainingAccountDays(expiresAt:string,now:number):number|null{
 const state=accountTermState(expiresAt,now);
 if(state==="permanent"||state==="unknown")return null;
 return Math.max(0,Math.ceil((Date.parse(expiresAt)-now)/DAY));
}
export function accountTimeLabel(expiresAt:string,now:number):string{
 const state=accountTermState(expiresAt,now);
 if(state==="permanent")return "Không giới hạn";
 if(state==="expired")return "Đã hết hạn";
 if(state==="unknown")return "Chưa xác định thời hạn";
 const left=remainingAccountDays(expiresAt,now)??0;
 return left<=1?"Còn dưới 1 ngày":`Còn ${left} ngày`;
}
export function expiryDateLabel(expiresAt:string):string{
 const expiry=Date.parse(expiresAt);
 if(!Number.isFinite(expiry))return "Chưa xác định";
 return new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(expiry));
}
export function renewalStatusText(state:TermState):string{
 switch(state){
  case "permanent":return "Vĩnh viễn";
  case "soon":return "Sắp hết hạn";
  case "expired":return "Hết hạn";
  case "active":return "Còn thời hạn";
  default:return "Chưa xác minh hạn";
 }
}
export function renewalMatchesStatus(row:RenewalRow,filter:RenewalStatus,now:number):boolean{
 if(filter==="all")return true;
 const kind=accountTermState(row.expiresAt,now);
 return filter==="permanent"?kind==="permanent":filter===kind;
}
export function renewalCounts(rows:RenewalRow[],now:number){
 return {
  verified:rows.length,
  soon:rows.filter(row=>accountTermState(row.expiresAt,now)==="soon").length,
  teacher:rows.filter(row=>row.role==="teacher").length,
  learner:rows.filter(row=>row.role==="learner").length
 };
}
export function verifiedProgress(progress:RenewalRow["progress"]):{completed:number;total:number;percent:number}|null{
 if(!progress)return null;
 const {completed,total}=progress;
 if(!Number.isInteger(completed)||!Number.isInteger(total)||total<=0||completed<0||completed>total)return null;
 return {completed,total,percent:Math.round(completed/total*100)};
}
