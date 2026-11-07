import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { AccountError, AccountService } from "./account-core.server";

type Authority = { kind: "owner"; actor: string } | { kind: "manager"; token: string };
type Stage = "requested" | "profile_required" | "profile_review" | "changes_requested" | "active" | "suspended" | "legacy_hold";
function bad(code: string, status = 403): never { throw new AccountError(code, status); }
function field(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) bad("PROFILE_INVALID", 400);
  return value.trim().normalize("NFC");
}
type State = { account_id: string; stage: Stage; revision: number; role: string; status: string; first_review_by: string | null };
export class AccountV2Workflow {
  constructor(private db: D1Database, private accounts: AccountService) {}
  private async state(accountId: string): Promise<State> {
    const r = await this.db.prepare(`SELECT o.account_id,o.stage,o.revision,d.person_role AS role,
      d.status,o.first_review_by FROM account_onboarding o JOIN accounts a ON a.account_id=o.account_id
      JOIN device_access d ON d.device_id=a.storage_device_id WHERE o.account_id=?`)
      .bind(accountId).first<State>();
    if (!r) bad("ACCOUNT_ONBOARDING_MISSING", 409);
    return r;
  }
  async ownStatus(token: string) {
    const actor = await this.accounts.session(token);
    const s = await this.state(actor.accountId);
    return { accountId: actor.accountId, role: s.role, stage: s.stage, revision: s.revision,
      requiresProfile: s.stage === "profile_required" || s.stage === "changes_requested" };
  }
  private async reviewer(authority: Authority, role: string, targetId: string) {
    if (authority.kind === "owner") {
      if (!authority.actor || authority.actor === "system" || role !== "manager") bad("OWNER_REQUIRED");
      return { id: authority.actor, guard: "1=1", values: [] as (string | number)[] };
    }
    if (role !== "learner" && role !== "teacher") bad("TARGET_ROLE_FORBIDDEN");
    const actor = await this.accounts.authorize(authority.token);
    if (actor.accountId === targetId || actor.role !== "manager") bad("TARGET_ROLE_FORBIDDEN");
    await this.accounts.capability(actor, "manager.approve.registration");
    // Authorization repeated inside the final UPDATE; revocation races fail closed.
    const guard = `EXISTS(SELECT 1 FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
      JOIN account_manager_permissions p ON p.account_id=a.account_id
      WHERE a.account_id=? AND d.person_role='manager' AND d.status='approved' AND d.management_enabled=1
      AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP)
      AND p.scope='manager.approve.registration' AND p.enabled=1
      AND (p.expires_at IS NULL OR p.expires_at>(unixepoch()*1000)))`;
    return { id: actor.accountId, guard, values: [actor.accountId] };
  }
  async firstReview(authority: Authority, targetId: string, revision: unknown) {
    const target = await this.state(targetId);
    if (target.stage !== "requested" || target.status !== "pending" || !Number.isInteger(revision)
      || revision !== target.revision) bad("ACCOUNT_CAS_CONFLICT", 409);
    const reviewer = await this.reviewer(authority, target.role, targetId);
    const statements: D1PreparedStatement[] = [
      this.db.prepare(`UPDATE account_onboarding SET stage='profile_required',revision=revision+1,
        first_review_by=?,first_review_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
        WHERE account_id=? AND revision=? AND stage='requested' AND ${reviewer.guard}`)
        .bind(reviewer.id, targetId, revision, ...reviewer.values),
      this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
        SELECT ?,'account.review.first',?,'onboarding only; no access grant' WHERE changes()=1`)
        .bind(reviewer.id, targetId),
    ];
    const result = await this.db.batch(statements);
    if (Number(result[0].meta.changes)!==1) bad("ACCOUNT_CAS_CONFLICT", 409);
    return this.state(targetId);
  }
  async submitProfile(token: string, input: Record<string, unknown>) {
    const actor = await this.accounts.session(token);
    const s = await this.state(actor.accountId);
    if (!["profile_required","changes_requested"].includes(s.stage) || !Number.isInteger(input.expectedRevision)
      || input.expectedRevision !== s.revision) bad("ACCOUNT_CAS_CONFLICT", 409);
    const family=field(input.familyName,60), given=field(input.givenName,60);
    const code=field(input.personCode,32).toUpperCase(), className=field(input.className,80);
    const raw=field(input.phone,32).replace(/[ ()-]/g,"");
    const phone=raw.startsWith("+84")?"0"+raw.slice(3):raw;
    if(!/^[A-Z0-9._-]+$/.test(code)|| !/^\+?[0-9]{7,16}$/.test(phone)) bad("PROFILE_INVALID",400);
    const result=await this.db.batch([
      this.db.prepare(`UPDATE device_access SET learner_name=?,learner_family_name=?,learner_given_name=?,
        person_code=?,class_name=?,phone=?,registration_submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
        WHERE device_id=? AND status='pending' AND EXISTS (
          SELECT 1 FROM account_onboarding WHERE account_id=? AND stage IN ('profile_required','changes_requested') AND revision=?)`)
        .bind(family+" "+given,family,given,code,className,phone,actor.storageDeviceId,actor.accountId,s.revision),
      this.db.prepare(`UPDATE account_onboarding SET stage='profile_review',revision=revision+1,
        profile_submitted_at=CURRENT_TIMESTAMP,last_review_note=NULL,updated_at=CURRENT_TIMESTAMP
        WHERE account_id=? AND revision=? AND stage IN ('profile_required','changes_requested') AND changes()=1`)
        .bind(actor.accountId,s.revision),
      this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
        SELECT ?,'account.profile.submitted',?,'submitted for second independent review' WHERE changes()=1`)
        .bind(actor.accountId,actor.accountId),
    ]).catch(error=>{
      if(error instanceof Error && /UNIQUE|constraint/i.test(error.message)) bad("PROFILE_CONFLICT",409);
      throw error;
    });
    if(Number(result[0].meta.changes)!==1 || Number(result[1].meta.changes)!==1) bad("ACCOUNT_CAS_CONFLICT",409);
    return this.state(actor.accountId);
  }
  async requestChanges(authority: Authority, targetId: string, revision: unknown, reason: unknown) {
    const target=await this.state(targetId);
    if(target.stage!=="profile_review"||!Number.isInteger(revision)||revision!==target.revision) bad("ACCOUNT_CAS_CONFLICT",409);
    const reviewer=await this.reviewer(authority,target.role,targetId);
    if(authority.kind==="manager" && target.first_review_by!==reviewer.id) bad("ACCOUNT_SCOPE_FORBIDDEN",403);
    const note=field(reason,200);
    const res=await this.db.batch([
      this.db.prepare(`UPDATE account_onboarding SET stage='changes_requested',revision=revision+1,
        last_review_note=?,updated_at=CURRENT_TIMESTAMP WHERE account_id=? AND stage='profile_review'
        AND revision=? AND ${reviewer.guard}`).bind(note,targetId,revision,...reviewer.values),
      this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
        SELECT ?,'account.review.changes',?,? WHERE changes()=1`).bind(reviewer.id,targetId,note),
    ]);
    if(Number(res[0].meta.changes)!==1) bad("ACCOUNT_CAS_CONFLICT",409);
    return this.state(targetId);
  }
}
