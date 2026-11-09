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
   (SELECT COUNT(*) FROM accounts a
     JOIN device_access d ON d.device_id=a.storage_device_id
     JOIN account_onboarding o ON o.account_id=a.account_id
     WHERE d.person_role=p.person_role AND o.stage IN ('active','suspended')) AS used
  FROM account_admission_limits p ORDER BY CASE p.person_role
   WHEN 'manager' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END`).all<{
    role: string; accountLimit: number; revision: number; used: number
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
    SELECT ?,'owner.account-capacity',?,? WHERE changes()=1`)
   .bind(owner.actor,role,`new_limit=${cap}`),
 ]);
 if(Number(result[0]?.meta?.changes)!==1) throw new AccountError('ACCOUNT_CAS_CONFLICT',409);
 return readAccountCapacity(db,owner);
}
