import type { D1Database } from "@cloudflare/workers-types";
import { AccountError, AccountService } from "./account-core.server";

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
type TrialRole = "learner" | "teacher" | "manager";
type TrialRow = {role:TrialRole;started_at_ms:number;expires_at_ms:number;now_ms:number};
const fail = (code:string,status=403):never => {throw new AccountError(code,status);};

/**
 * A one-time eight-hour lease is NOT a login session and never grants account
 * capability. Only immutable issuance metadata is stored in canonical D1.
 * Every trial workspace action stays browser-memory-only; there is no trial
 * upload, AI, training, approval, assignment, or certificate API.
 */
export class AccountTrialService {
  constructor(private db:D1Database, private accounts:AccountService) {}
  private async pending(token:string) {
    const actor=await this.accounts.session(token); // checks current session and device revocation
    if(!actor.deviceApproved)fail("DEVICE_APPROVAL_REQUIRED");
    const row=await this.db.prepare(`SELECT d.person_role AS role,d.status,o.stage
      FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
      JOIN account_onboarding o ON o.account_id=a.account_id WHERE a.account_id=?`)
      .bind(actor.accountId).first<{role:TrialRole;status:string;stage:string}>();
    if(!row || !["manager","teacher","learner"].includes(row.role)
       ||row.status!=="pending" || !["requested","profile_required","changes_requested"].includes(row.stage))
      throw new AccountError("TRIAL_NOT_ELIGIBLE",403);
    return {actor,role:row.role};
  }
  private async readLease(accountId:string,role:TrialRole) {
    const row=await this.db.prepare(`SELECT role,started_at_ms,expires_at_ms,
      CAST(unixepoch('now') AS INTEGER)*1000 AS now_ms
      FROM account_ui_trials WHERE account_id=?`).bind(accountId).first<TrialRow>();
    if(!row){
      const clock=await this.db.prepare("SELECT CAST(unixepoch('now') AS INTEGER)*1000 AS now_ms")
        .first<{now_ms:number}>();
      if(!clock)throw new AccountError("TRIAL_CLOCK_UNAVAILABLE",503);
      return {state:"available" as const,role,serverNowMs:Number(clock.now_ms),startedAtMs:null,expiresAtMs:null};
    }
    if(row.role!==role)fail("TRIAL_ROLE_CONFLICT",409);
    const now=Number(row.now_ms),expires=Number(row.expires_at_ms);
    return {state:now<expires?"active" as const:"expired" as const,role,
      serverNowMs:now,startedAtMs:Number(row.started_at_ms),expiresAtMs:expires};
  }
  async status(token:string) {
    const {actor,role}=await this.pending(token);
    return this.readLease(actor.accountId,role);
  }
  async start(token:string) {
    const {actor,role}=await this.pending(token);
    // INSERT OR IGNORE makes simultaneous requests and re-logins share the
    // FIRST lease; the unique account PK forbids any refresh of its expiry.
    // Revalidate the principal in SQL to close revoke/role/stage races.
    const results=await this.db.batch([this.db.prepare(`INSERT OR IGNORE INTO account_ui_trials
      (account_id,role,issued_device_id,started_at_ms,expires_at_ms)
      SELECT a.account_id,d.person_role,s.device_id,
        CAST(unixepoch('now') AS INTEGER)*1000,
        CAST(unixepoch('now') AS INTEGER)*1000 + ${EIGHT_HOURS_MS}
      FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
      JOIN account_onboarding o ON o.account_id=a.account_id
      JOIN account_sessions s ON s.account_id=a.account_id
      JOIN account_devices b ON b.account_id=s.account_id AND b.device_id=s.device_id
      JOIN account_credentials c ON c.account_id=a.account_id AND c.generation=s.generation
      WHERE a.account_id=? AND s.token_hash=? AND s.device_id=?
        AND s.revoked=0 AND b.revoked=0 AND b.approved=1
        AND s.expires_at>(julianday('now')-2440587.5)*86400000
        AND s.idle_expires_at>(julianday('now')-2440587.5)*86400000
        AND d.status='pending' AND o.stage IN ('requested','profile_required','changes_requested')
        AND d.person_role IN ('learner','teacher','manager')`)
      .bind(actor.accountId,actor.sessionHash,actor.deviceId),
      this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
        SELECT ?,'account.trial.issued',?,'one-time UI sandbox 8h, no grants'
        WHERE changes()=1`).bind(actor.accountId,actor.accountId),
    ]);
    const lease=await this.readLease(actor.accountId,role);
    if(lease.state==="available")fail("ACCOUNT_CAS_CONFLICT",409);
    // Do not report success for an expired/replayed lease.
    if(lease.state==="expired")fail("TRIAL_EXPIRED",409);
    if(results[0].meta.changes!==0 && results[0].meta.changes!==1)fail("ACCOUNT_READBACK_FAILED",503);
    return lease;
  }
}
