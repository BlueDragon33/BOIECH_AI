import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";

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
    return this.db.prepare(`INSERT INTO account_entitlements(account_id,state,activated_at,expires_at,changed_by)
      SELECT ?,'active',?,?,? WHERE EXISTS (
        SELECT 1 FROM account_onboarding WHERE account_id=? AND stage='active'
      ) ON CONFLICT(account_id) DO NOTHING`)
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
    const rows=await this.db.prepare(`SELECT a.account_id,d.learner_name,d.person_role,d.status,
      o.stage,d.access_expires_at AS legacy_device_expires_at,d.payment_status,
      e.state AS entitlement_state,e.expires_at,e.activated_at,
      e.revision AS entitlement_revision
      FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
      LEFT JOIN account_onboarding o ON o.account_id=a.account_id
      LEFT JOIN account_entitlements e ON e.account_id=a.account_id
      ORDER BY a.account_id LIMIT 501`)
      .all<{account_id:string;learner_name:string;person_role:string;status:string;
        stage:string|null;legacy_device_expires_at:string|null;payment_status:string;
        entitlement_state:string|null;expires_at:string|null;
        activated_at:string|null;entitlement_revision:number|null}>();
    if ((rows.results?.length ?? 0)>500) reject("ACCOUNT_RESULT_LIMIT",413);
    return (rows.results??[]).map(r=>({accountId:r.account_id,name:r.learner_name,
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
    if(!["set-expiry","suspend","resume"].includes(String(operation))
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
