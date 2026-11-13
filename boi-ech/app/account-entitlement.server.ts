import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import type { AccountService } from "./account-core.server";
const FOREVER_EXPIRY="9999-12-31T23:59:59.000Z";
const ACCESS_PERIODS=["7d","30d","6m","1y","4y","forever"] as const;
/** Time resets from server clock. Month/year lengths are calendar-accurate and clamped. */
function expiryFromPeriod(now:number,period:unknown){
 if(period==="forever")return FOREVER_EXPIRY;
 if(!ACCESS_PERIODS.includes(period as (typeof ACCESS_PERIODS)[number]))
  throw new AccountEntitlementError("ACCOUNT_INPUT",400);
 const date=new Date(now);
 if(!Number.isFinite(date.getTime()))throw new AccountEntitlementError("ACCOUNT_INPUT",400);
 if(period==="7d"||period==="30d")date.setUTCDate(date.getUTCDate()+(period==="7d"?7:30));
 else{
  const months=period==="6m"?6:period==="1y"?12:48;
  const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months);
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(day,last));
 }
 return date.toISOString();
}

export class AccountEntitlementError extends Error {
  constructor(public code: string, public status = 403) { super(code); this.name = "AccountEntitlementError"; }
}
const reject = (code: string, status = 403): never => { throw new AccountEntitlementError(code, status); };
const roles = ["manager", "teacher", "learner"] as const;
type Role = typeof roles[number];
const accountPattern = /^acc_[a-f0-9]{64}$/;
type Owner = { actor: string; role: string };
export type EntitlementRow = {
  account_id: string; state: "active" | "suspended"; activated_at: string;
  expires_at: string; revision: number; changed_by: string;
};
export class AccountEntitlementService {
  constructor(private db: D1Database, private now: () => number = Date.now) {}
  private owner(actor: Owner) {
    if (actor.role !== "owner" || !actor.actor || actor.actor === "system") reject("OWNER_REQUIRED");
  }
  private accountId(value: unknown) {
    if (typeof value !== "string" || !accountPattern.test(value)) reject("ACCOUNT_INPUT",400);
    return value as string;
  }
  private reason(value: unknown) {
    if (typeof value !== "string") throw new AccountEntitlementError("ACCOUNT_REASON_REQUIRED",400);
    if (value.trim().length < 5 || value.length > 300) throw new AccountEntitlementError("ACCOUNT_REASON_REQUIRED",400);
    return value.trim();
  }
  async policy() {
    const data = await this.db.prepare("SELECT role,default_days,revision,updated_at FROM account_duration_policies ORDER BY CASE role WHEN 'manager' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END")
      .all<{role: Role;default_days:number;revision:number;updated_at:string}>();
    if (data.results?.length !== 3) reject("ACCOUNT_ACCESS_POLICY_UNAVAILABLE",503);
    return data.results.map(r => ({role:r.role,defaultDays:r.default_days,revision:r.revision,updatedAt:r.updated_at}));
  }
  async defaultDays(role: string) {
    if (!roles.includes(role as Role)) reject("ACCOUNT_INPUT",400);
    const row=await this.db.prepare("SELECT default_days FROM account_duration_policies WHERE role=?")
      .bind(role).first<{default_days:number}>();
    if (!row) throw new AccountEntitlementError("ACCOUNT_ACCESS_POLICY_UNAVAILABLE",503);
    if (!Number.isInteger(row.default_days) || row.default_days < 1 || row.default_days > 365) throw new AccountEntitlementError("ACCOUNT_ACCESS_POLICY_UNAVAILABLE",503);
    return row.default_days;
  }
  async grantOnApproval(accountId: string, role: string, source: "approval:second"|"profile:completed" = "approval:second") {
    // Return a prepared statement for an existing atomic D1 batch.
    // Never grant at signup or first human review; R2 grants on profile completion.
    this.accountId(accountId);
    const days=await this.defaultDays(role);
    const activatedAt=new Date(this.now()).toISOString();
    const expiresAt=new Date(this.now()+days*86400000).toISOString();
    // V2 one-review activation MUST fail within the D1 batch on a duplicate
    // entitlement. Post-commit meta.changes failure must not leave ACTIVE behind.
    // Preserve the existing deduplicated legacy second-review contract.
    const legacyDedup=source==="approval:second"?" ON CONFLICT(account_id) DO NOTHING":"";
    return this.db.prepare(`INSERT INTO account_entitlements(account_id,state,activated_at,expires_at,changed_by)
      SELECT ?,'active',?,?,? WHERE EXISTS (
        SELECT 1 FROM account_onboarding WHERE account_id=? AND stage='active'
      )${legacyDedup}`)
      .bind(accountId,activatedAt,expiresAt,source,accountId);
  }
  async read(accountId: unknown) {
    const id=this.accountId(accountId);
    const row=await this.db.prepare("SELECT account_id,state,activated_at,expires_at,revision,changed_by FROM account_entitlements WHERE account_id=?")
      .bind(id).first<EntitlementRow>();
    return row ? {accountId:row.account_id,state:row.state,activatedAt:row.activated_at,expiresAt:row.expires_at,
      revision:row.revision,active:row.state==="active" && Date.parse(row.expires_at)>this.now()} : null;
  }
  async assertActive(accountId: string) {
    const row=await this.read(accountId);
    if (!row) throw new AccountEntitlementError("ACCOUNT_ENTITLEMENT_REQUIRED",403);
    if (row.state!=="active") reject("ACCOUNT_SUSPENDED",403);
    if (!row.active) reject("ACCOUNT_EXPIRED",403);
  }
  async list(actor: Owner) {
    this.owner(actor);
    const rows=await this.db.prepare(`SELECT a.account_id,a.revision AS account_revision,d.learner_name,d.person_role,d.status,
      o.stage,d.access_expires_at AS legacy_device_expires_at,d.payment_status,
      e.state AS entitlement_state,e.expires_at,e.activated_at,
      e.revision AS entitlement_revision
      FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
      LEFT JOIN account_onboarding o ON o.account_id=a.account_id
      LEFT JOIN account_entitlements e ON e.account_id=a.account_id
      ORDER BY a.account_id LIMIT 501`)
      .all<{account_id:string;account_revision:number;learner_name:string;person_role:string;status:string;
        stage:string|null;legacy_device_expires_at:string|null;payment_status:string;
        entitlement_state:string|null;expires_at:string|null;
        activated_at:string|null;entitlement_revision:number|null}>();
    if ((rows.results?.length ?? 0)>500) reject("ACCOUNT_RESULT_LIMIT",413);
    return (rows.results??[]).map(r=>({accountId:r.account_id,accountRevision:r.account_revision,name:r.learner_name,
      role:r.person_role,deviceStatus:r.status,onboardingStage:r.stage,
      deviceAccessExpiresAt:r.legacy_device_expires_at,
      deviceAccessExpired: Boolean(r.legacy_device_expires_at) && !(Date.parse(r.legacy_device_expires_at as string)>this.now()),
      paymentStatus:r.payment_status,
      entitlement:r.entitlement_state ? {state:r.entitlement_state,expiresAt:r.expires_at,
        activatedAt:r.activated_at,revision:r.entitlement_revision,
        active:r.entitlement_state==="active" && Date.parse(r.expires_at??"")>this.now()} : null}));
  }
  async setPolicy(actor:Owner,input:Record<string,unknown>) {
    this.owner(actor);
    const {role,defaultDays,expectedRevision}=input;
    if(typeof role!=="string" || !roles.includes(role as Role)
      || !Number.isInteger(defaultDays) || (defaultDays as number)<1 || (defaultDays as number)>365
      || !Number.isSafeInteger(expectedRevision) || (expectedRevision as number)<1) reject("ACCOUNT_INPUT",400);
    const reason=this.reason(input.reason);
    const stmts:D1PreparedStatement[]=[
      this.db.prepare("UPDATE account_duration_policies SET default_days=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE role=? AND revision=?")
        .bind(defaultDays,role,expectedRevision),
      this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
        VALUES(?,'owner.account-default-days',?,CASE WHEN changes()=1 THEN ? ELSE NULL END)`)
        .bind(actor.actor,role,reason)
    ];
    try {await this.db.batch(stmts);}catch(error){
      if(error instanceof Error && /NOT NULL.*purpose|constraint/i.test(error.message)) reject("ACCOUNT_CAS_CONFLICT",409);
      throw error;
    }
    const row=(await this.policy()).find(x=>x.role===role);
    if(!row || row.revision!==(expectedRevision as number)+1 || row.defaultDays!==defaultDays) reject("ACCOUNT_READBACK_FAILED",503);
    return row;
  }
  async change(actor:Owner,input:Record<string,unknown>) {
    this.owner(actor);
    const id=this.accountId(input.accountId);
    const operation=input.operation;
    if(!["set-expiry","set-preset","suspend","resume"].includes(String(operation))
      || !Number.isSafeInteger(input.expectedRevision) || (input.expectedRevision as number)<1) reject("ACCOUNT_INPUT",400);
    const reason=this.reason(input.reason);
    const current=await this.read(id);
    if(!current) throw new AccountEntitlementError("ACCOUNT_ENTITLEMENT_REQUIRED",409);
    if(current.revision!==input.expectedRevision) reject("ACCOUNT_CAS_CONFLICT",409);
    let state=current.state,expiry=current.expiresAt;
    if(operation==="set-expiry"){
      if(typeof input.expiresAt!=="string") throw new AccountEntitlementError("ACCOUNT_INPUT",400);
      if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.expiresAt)) throw new AccountEntitlementError("ACCOUNT_INPUT",400);
      const next=Date.parse(input.expiresAt);
      if(!Number.isFinite(next)||next<=this.now()||next>this.now()+3650*86400000) reject("ACCOUNT_INPUT",400);
      expiry=new Date(next).toISOString();
    }else if(operation==="set-preset"){
      if(!ACCESS_PERIODS.includes(input.period as (typeof ACCESS_PERIODS)[number]))reject("ACCOUNT_INPUT",400);
      expiry=expiryFromPeriod(this.now(),input.period);
    }else if(operation==="suspend")state="suspended";
    else{
      if(Date.parse(expiry)<=this.now()) reject("ACCOUNT_EXPIRED",409);
      state="active";
    }
    const stmts:D1PreparedStatement[]=[
      this.db.prepare(`UPDATE account_entitlements SET state=?,expires_at=?,revision=revision+1,
        changed_by=?,updated_at=CURRENT_TIMESTAMP
        WHERE account_id=? AND revision=? AND EXISTS(
          SELECT 1 FROM account_onboarding o WHERE o.account_id=? AND o.stage IN ('active','suspended')
        )`).bind(state,expiry,actor.actor,id,input.expectedRevision,id),
      this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
        VALUES(?,?,?,CASE WHEN changes()=1 THEN ? ELSE NULL END)`)
        .bind(actor.actor,"owner.entitlement."+String(operation),id,reason)
    ];
    try {await this.db.batch(stmts);}catch(error){
      if(error instanceof Error && /NOT NULL.*purpose|constraint/i.test(error.message)) reject("ACCOUNT_CAS_CONFLICT",409);
      throw error;
    }
    const after=await this.read(id);
    if(!after || after.revision!==(input.expectedRevision as number)+1 || after.state!==state || after.expiresAt!==expiry)
      reject("ACCOUNT_READBACK_FAILED",503);
    return after;
  }
}

/**
 * Verified manager-only renewal for learners/teachers. Managers cannot renew
 * another manager, themselves, suspended/banned profiles, or Owner access.
 * Deliberately independent of account self-service and browser role flags.
 */
export async function managerRenewableAccounts(db:D1Database,accounts:AccountService,token:string){
 const actor=await accounts.authorize(token);
 if(actor.role!=="manager")reject("ACCOUNT_PERMISSION_REQUIRED",403);
 await accounts.capability(actor,"manager.manage.assigned");
 const result=await db.prepare(`SELECT a.account_id AS accountId,d.learner_name AS name,
  d.person_role AS role,e.expires_at AS expiresAt,e.revision,
  e.state AS entitlementState,o.stage AS onboardingStage,
  p.completed_json AS completedJson,p.total_active_seconds AS totalActiveSeconds,
  p.last_activity_at AS lastLearningAt
  FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
  JOIN account_onboarding o ON o.account_id=a.account_id
  JOIN account_entitlements e ON e.account_id=a.account_id
  LEFT JOIN device_profiles p ON p.device_id=d.device_id
  WHERE d.person_role IN ('learner','teacher') AND d.status='approved'
    AND o.stage='active' AND e.state='active'
  ORDER BY d.person_role,a.account_id LIMIT 501`).all<{
   accountId:string;name:string|null;role:string;expiresAt:string;revision:number;
   entitlementState:string;onboardingStage:string;completedJson:string|null;
   totalActiveSeconds:number|null;lastLearningAt:string|null
  }>();
 if(!Array.isArray(result.results)||result.results.length>500)reject("ACCOUNT_RESULT_LIMIT",413);
 const rows=result.results.map(record=>{
  let completedLessons:number|null=null;
  if(record.completedJson!==null){
   try{
    const items:unknown=JSON.parse(record.completedJson);
    if(Array.isArray(items))completedLessons=new Set(items.filter(item=>
     typeof item==="string"&&/^bai-0[1-8]$/.test(item)
    ).map(item=>Number(String(item).slice(-2)))).size;
   }catch{/* Invalid D1 progress is unknown, never fabricated as zero. */}
  }
  const {completedJson,...safe}=record;
  return {...safe,completedLessons,totalLessons:8};
 });
 return {verified:true,contract:"boi-manager-renew.v1",accounts:rows};
}
export async function managerRenewAccount(db:D1Database,accounts:AccountService,token:string,input:Record<string,unknown>,now=Date.now()){
 const actor=await accounts.authorize(token);
 if(actor.role!=="manager")reject("ACCOUNT_PERMISSION_REQUIRED",403);
 await accounts.capability(actor,"manager.manage.assigned");
 const target=input.accountId,revision=Number(input.expectedRevision);
 const days=Number(input.days);
 const isPreset=typeof input.period==="string";
 const reason=typeof input.reason==="string"?input.reason.trim():"";
 if(typeof target!=="string"||!accountPattern.test(target)||target===actor.accountId
  ||!Number.isSafeInteger(revision)||revision<1
  ||(isPreset?!ACCESS_PERIODS.includes(input.period as (typeof ACCESS_PERIODS)[number]):!Number.isSafeInteger(days)||days<1||days>365)
  ||reason.length<10||reason.length>300)
  throw new AccountEntitlementError("ACCOUNT_INPUT",400);
 const record=await db.prepare(`SELECT e.expires_at,e.state,e.revision,d.person_role AS role
  FROM account_entitlements e JOIN accounts a ON a.account_id=e.account_id
  JOIN device_access d ON d.device_id=a.storage_device_id
  JOIN account_onboarding o ON o.account_id=a.account_id
  WHERE e.account_id=? AND d.status='approved' AND o.stage='active'
    AND d.person_role IN ('learner','teacher')`)
  .bind(target).first<{expires_at:string;state:string;revision:number;role:string}>();
 if(!record||record.state!=="active"||record.revision!==revision)
  throw new AccountEntitlementError("ACCOUNT_CAS_CONFLICT",409);
 const next=isPreset?expiryFromPeriod(now,input.period):
  new Date(Math.max(now,Date.parse(record.expires_at))+days*86400000).toISOString();
 if(next!==FOREVER_EXPIRY&&Date.parse(next)>now+3650*86400000)reject("ACCOUNT_INPUT",400);
 const batch=[
  db.prepare(`UPDATE account_entitlements SET expires_at=?,revision=revision+1,
    changed_by=?,updated_at=CURRENT_TIMESTAMP
    WHERE account_id=? AND revision=? AND state='active'
     AND EXISTS(SELECT 1 FROM accounts a
      JOIN device_access d ON d.device_id=a.storage_device_id
      JOIN account_onboarding o ON o.account_id=a.account_id
      WHERE a.account_id=? AND o.stage='active'
       AND d.status='approved' AND d.person_role IN ('learner','teacher'))
     AND EXISTS(SELECT 1 FROM accounts m JOIN device_access d
       ON d.device_id=m.storage_device_id
       JOIN account_sessions s ON s.account_id=m.account_id
       JOIN account_devices b ON b.account_id=s.account_id AND b.device_id=s.device_id
       JOIN account_credentials c ON c.account_id=m.account_id AND c.generation=s.generation
       JOIN account_onboarding o ON o.account_id=m.account_id
       JOIN account_entitlements e ON e.account_id=m.account_id
       JOIN account_manager_permissions p ON p.account_id=m.account_id
       WHERE m.account_id=? AND s.token_hash=? AND s.device_id=?
         AND s.revoked=0 AND b.revoked=0 AND b.approved=1
         AND s.expires_at>? AND s.idle_expires_at>?
         AND d.person_role='manager' AND d.status='approved'
         AND d.management_enabled=1 AND o.stage='active'
         AND e.state='active' AND datetime(e.expires_at)>CURRENT_TIMESTAMP
         AND p.scope='manager.manage.assigned' AND p.enabled=1
         AND (p.expires_at IS NULL OR datetime(p.expires_at)>CURRENT_TIMESTAMP))`)
    .bind(next,actor.accountId,target,revision,target,
      actor.accountId,actor.sessionHash,actor.deviceId,now,now),
  db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
    SELECT ?,'manager.entitlement.renew',?,
    CASE WHEN changes()=1 THEN ? ELSE NULL END`)
    .bind(actor.accountId,target,`${isPreset?"set-period="+String(input.period):"days="+days};${reason}`)
 ];
 try{await db.batch(batch);}
 catch(error){
  if(error instanceof Error&&/NOT NULL|constraint|CHECK/i.test(error.message))
   reject("ACCOUNT_CAS_CONFLICT",409);
  throw error;
 }
 const after=await new AccountEntitlementService(db,()=>now).read(target);
 if(!after||after.revision!==revision+1||after.expiresAt!==next)
  reject("ACCOUNT_READBACK_FAILED",503);
 return {ok:true,verified:true,contract:"boi-manager-renew.v1",entitlement:after,accountId:target};
}


/** Manager's reversible remove-from-service. Never hard-delete protected identity,
 * payments, certificates, D1 audit or shared learning evidence. */
export async function managerRemoveAccount(db:D1Database,accounts:AccountService,token:string,input:Record<string,unknown>){
 const actor=await accounts.authorize(token);
 if(actor.role!=="manager")reject("ACCOUNT_PERMISSION_REQUIRED",403);
 await accounts.capability(actor,"manager.manage.assigned");
 const id=typeof input.accountId==="string"?input.accountId:"";
 const revision=Number(input.expectedRevision);
 const reason=typeof input.reason==="string"?input.reason:"";
 if(typeof id!=="string"||!accountPattern.test(id)||id===actor.accountId||
  !Number.isSafeInteger(revision)||(revision as number)<1||
  typeof reason!=="string"||reason.trim().length<10||reason.length>300||
  input.confirmation!==id)reject("ACCOUNT_INPUT",400);
 // Explicit Owner-preserved trio can never be removed by a manager.
 if(["acc_1f73c030843c73a","acc_6b4dbc19e478ef4","acc_68cfa13cfe2f66d"]
    .some(prefix=>id.startsWith(prefix)))reject("ACCOUNT_PROTECTED",403);
 const target=await db.prepare(`SELECT a.storage_device_id AS deviceId,e.revision,
  d.person_role AS role,d.status,o.stage AS stage
  FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
  JOIN account_entitlements e ON e.account_id=a.account_id
  JOIN account_onboarding o ON o.account_id=a.account_id
  WHERE a.account_id=?`).bind(id).first<{
  deviceId:string;revision:number;role:string;status:string;stage:string
 }>();
 if(!target)throw new AccountEntitlementError("ACCOUNT_CAS_CONFLICT",409);
 if(!["learner","teacher"].includes(target.role)||target.status!=="approved"||
  target.stage!=="active"||target.revision!==revision)
  throw new AccountEntitlementError("ACCOUNT_CAS_CONFLICT",409);
 const batch:D1PreparedStatement[]=[
  db.prepare(`UPDATE account_entitlements SET state='suspended',revision=revision+1,
    changed_by=?,updated_at=CURRENT_TIMESTAMP
    WHERE account_id=? AND revision=? AND state='active'
    AND EXISTS(SELECT 1 FROM accounts m JOIN device_access d ON d.device_id=m.storage_device_id
      JOIN account_sessions ss ON ss.account_id=m.account_id
      JOIN account_devices b ON b.account_id=ss.account_id AND b.device_id=ss.device_id
      JOIN account_credentials c ON c.account_id=m.account_id AND c.generation=ss.generation
      JOIN account_onboarding o ON o.account_id=m.account_id
      JOIN account_entitlements e ON e.account_id=m.account_id
      JOIN account_manager_permissions p ON p.account_id=m.account_id
      WHERE m.account_id=? AND ss.token_hash=? AND ss.device_id=?
        AND ss.revoked=0 AND b.revoked=0 AND b.approved=1
        AND ss.expires_at>? AND ss.idle_expires_at>?
        AND d.person_role='manager' AND d.status='approved'
        AND d.management_enabled=1 AND o.stage='active'
        AND e.state='active' AND datetime(e.expires_at)>CURRENT_TIMESTAMP
        AND p.scope='manager.manage.assigned' AND p.enabled=1
        AND (p.expires_at IS NULL OR datetime(p.expires_at)>CURRENT_TIMESTAMP))`)
     .bind(actor.accountId,id,revision,
      actor.accountId,actor.sessionHash,actor.deviceId,Date.now(),Date.now()),
  db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
    VALUES(?,'manager.account.archived',?,CASE WHEN changes()=1 THEN ? ELSE NULL END)`)
    .bind(actor.accountId,id,reason.trim()),
  db.prepare(`UPDATE account_onboarding SET stage='suspended',revision=revision+1,
    updated_at=CURRENT_TIMESTAMP WHERE account_id=? AND stage='active'`).bind(id),
  db.prepare(`UPDATE device_access SET status='blocked',blocked_at=CURRENT_TIMESTAMP,
    updated_at=CURRENT_TIMESTAMP WHERE device_id=? AND person_role IN ('learner','teacher')
    AND status='approved'`).bind(target.deviceId),
  db.prepare("UPDATE account_sessions SET revoked=1 WHERE account_id=?").bind(id),
  db.prepare("UPDATE account_devices SET revoked=1 WHERE account_id=?").bind(id)
 ];
 try{await db.batch(batch);}catch(error){
  if(error instanceof Error&&/NOT NULL|constraint|CHECK/i.test(error.message))
   reject("ACCOUNT_CAS_CONFLICT",409);
  throw error;
 }
 const state=await db.prepare(`SELECT e.state,d.status,o.stage
  FROM account_entitlements e JOIN accounts a ON a.account_id=e.account_id
  JOIN device_access d ON d.device_id=a.storage_device_id
  JOIN account_onboarding o ON o.account_id=e.account_id
  WHERE e.account_id=?`).bind(id).first<{state:string;status:string;stage:string}>();
 if(state?.state!=="suspended"||state?.status!=="blocked"||state?.stage!=="suspended")
  reject("ACCOUNT_READBACK_FAILED",503);
 return {ok:true,verified:true,contract:"boi-manager-archive.v1",
  accountId:id,archived:true,deleted:false,readback:true};
}
