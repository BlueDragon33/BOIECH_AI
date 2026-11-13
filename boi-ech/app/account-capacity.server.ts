import type { D1Database } from '@cloudflare/workers-types';
import { AccountError } from './account-core.server';

type Owner = { actor: string; role: string };
const roles = new Set(['manager', 'teacher', 'learner']);
function requireOwner(owner: Owner) {
 if (owner.role !== 'owner' || !owner.actor || owner.actor === 'system') throw new AccountError('OWNER_REQUIRED', 403);
}
export async function readAccountCapacity(db: D1Database, owner: Owner) {
 requireOwner(owner);
 const response = await db.prepare(`SELECT p.person_role AS role,p.account_limit AS accountLimit,p.revision,
   COALESCE(c.rejected_attempts,0) AS rejectedAttempts,c.last_rejected_at AS lastRejectedAt,
   (SELECT COUNT(*) FROM accounts a
     JOIN device_access d ON d.device_id=a.storage_device_id
     WHERE a.login IS NOT NULL AND d.person_role=p.person_role) AS used
  FROM account_admission_limits p LEFT JOIN account_capacity_alerts c ON c.person_role=p.person_role
  ORDER BY CASE p.person_role
   WHEN 'manager' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END`).all<{
    role: string; accountLimit: number; revision: number; used: number;rejectedAttempts:number;lastRejectedAt:string|null
  }>();
 const limits = response.results ?? [];
 if (limits.length !== 3 || limits.some(x => !roles.has(x.role))) throw new AccountError('ACCOUNT_POLICY_UNAVAILABLE', 503);
 return { limits: limits.map(x => ({ ...x, remaining: Math.max(0, x.accountLimit-x.used), overLimit: x.used>x.accountLimit })) };
}
export async function changeAccountCapacity(db: D1Database, owner: Owner, input: Record<string,unknown>) {
 requireOwner(owner);
 const role = input.role;
 const cap = input.accountLimit;
 const revision = input.expectedRevision;
 if(typeof role !== 'string' || !roles.has(role) || !Number.isInteger(cap) || (cap as number)<1 || (cap as number)>5000 || !Number.isInteger(revision) || (revision as number)<1) {
  throw new AccountError('ACCOUNT_INPUT', 400);
 }
 const result = await db.batch([
  db.prepare(`UPDATE account_admission_limits SET account_limit=?,revision=revision+1,
    updated_at=CURRENT_TIMESTAMP WHERE person_role=? AND revision=?`).bind(cap,role,revision),
  db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
    SELECT ?,'owner.account-capacity',?,CASE WHEN changes()=1 THEN ? ELSE NULL END`)
   .bind(owner.actor,role,`new_limit=${cap}`),
 ]);
 if(Number(result[0]?.meta?.changes)!==1) throw new AccountError('ACCOUNT_CAS_CONFLICT',409);
 return readAccountCapacity(db,owner);
}
