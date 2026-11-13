export const FOREVER_EXPIRY="9999-12-31T23:59:59.000Z";
export const ACCESS_PERIODS=["7d","30d","6m","1y","4y","forever"] as const;
export type AccessPeriod=typeof ACCESS_PERIODS[number];
/** Set a fresh absolute lease from server time, never add onto a previous lease. */
export function expiryFromPeriod(now:number,period:unknown):string{
 if(period==="forever")return FOREVER_EXPIRY;
 if(!ACCESS_PERIODS.includes(period as AccessPeriod))throw new Error("INVALID_ACCESS_PERIOD");
 const date=new Date(now);
 if(!Number.isFinite(date.getTime()))throw new Error("INVALID_SERVER_TIME");
 if(period==="7d"||period==="30d")date.setUTCDate(date.getUTCDate()+(period==="7d"?7:30));
 else{
  const monthShift=period==="6m"?6:period==="1y"?12:48;
  const oldDay=date.getUTCDate();
  date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+monthShift);
  const endOfMonth=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(oldDay,endOfMonth));
 }
 return date.toISOString();
}
