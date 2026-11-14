export type AccountTerm="7d"|"30d"|"6m"|"1y"|"4y"|"forever";
export const FOREVER_EXPIRES_AT="9999-12-31T23:59:59.000Z";
/** Only the canonical D1 permanent entitlement is unlimited; ordinary long expiries remain finite. */
export function isUnlimitedAccountExpiry(value:string|null|undefined):boolean{
 return value===FOREVER_EXPIRES_AT;
}
export function replaceExpiryFromNow(term:AccountTerm,now:number):string{
 if(!Number.isFinite(now))throw new Error("TIME_INVALID");
 if(term==="forever")return FOREVER_EXPIRES_AT;
 const date=new Date(now);
 if(term==="7d"||term==="30d"){
  date.setTime(now+(term==="7d"?7:30)*86400000);
 }else if(term==="6m"||term==="1y"||term==="4y"){
  const months=term==="6m"?6:term==="1y"?12:48;
  const originalDay=date.getUTCDate();
  date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months);
  const y=date.getUTCFullYear(),m=date.getUTCMonth();
  const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay,last));
 }else throw new Error("TERM_INVALID");
 return date.toISOString();
}
export const accountTerms=[
 {value:"7d",label:"7 ngày"},{value:"30d",label:"30 ngày"},
 {value:"6m",label:"6 tháng"},{value:"1y",label:"1 năm"},
 {value:"4y",label:"4 năm"},{value:"forever",label:"Vĩnh viễn"}
] as const;
