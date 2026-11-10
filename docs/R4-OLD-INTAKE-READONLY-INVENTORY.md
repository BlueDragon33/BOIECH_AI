# R4 — Old intake inventory and ZERO-DELETION dry-run contract

Status: SOURCE-ONLY inventory specification; remote Cloudflare D1 data **NOT_READ**.
Constitution: Blueprint OS 1.3.0; no license to delete, wipe or archive Production records.
Intended impact: **none** until a separate Owner-approved destructive inventory has verified identity, scope, backup and restore.

## Current source entities (not actual row counts)

- `accounts`, `device_access`, `account_onboarding`, `account_contacts`, `account_devices`, `account_sessions`, `account_credentials`
- `account_manager_invitations`, `account_manager_permissions`, `manager_device_assignments`, `account_entitlements`, `account_duration_policies`, `account_admission_limits`
- `account_audit` (immutable by design), `course_certificates`, `course_activity_events`, `device_profiles` and course completion/learning tables.

Do not treat dashboard's “0 pending” or Cloudflare Bindings 0 as database evidence.

## Stage A: read-only environment validation (NOT_RUN)

Require an approved manager **READ_ONLY** on an existing Cloudflare Preview (never Production by accident). Verify exact Cloudflare account, existing D1 UUID & binding, env identity, role, migration ledger 0017–0026, revision of each Worker and FREE limits. Confirm Preview D1 UUID != Production D1 UUID. If any mismatch: BLOCKED. Do not create D1/R2, modify token/bridge secret or rotate credentials.

## Stage B: read-only inventory queries (NOT_RUN; run only on authenticated, scoped Preview)

SQLite D1 read-only query set to prepare (no PRAGMA write or DELETE):
```sql
SELECT name, type FROM sqlite_master WHERE type IN ('table','trigger','index') ORDER BY type,name;
SELECT id,name,applied_at FROM d1_migrations ORDER BY id;
SELECT stage,COUNT(*) AS n FROM account_onboarding GROUP BY stage ORDER BY stage;
SELECT person_role,status,COUNT(*) AS n FROM device_access GROUP BY person_role,status;
SELECT state,COUNT(*) AS n FROM account_entitlements GROUP BY state;
SELECT kind,verified,COUNT(*) AS n FROM account_contacts GROUP BY kind,verified;
SELECT COUNT(*) AS total FROM account_manager_invitations;
SELECT COUNT(*) AS total FROM manager_device_assignments;
SELECT COUNT(*) AS total FROM course_certificates;
SELECT COUNT(*) AS total FROM course_activity_events;
SELECT COUNT(*) AS total FROM account_audit;
```
Confirm `d1_migrations` actual column names first and adapt; do not assume a sample query matches the provider ledger schema. Aggregate only; do not export passwords, phones, emails, keys or personal learning records to Issue comments.

## Stage C: candidate reconciliation/dry-run, still NO DELETE

1. Enumerate an explicit **new registration wave boundary**, based on signed Owner cutover timestamp and account creation provenance. Timestamp is not yet selected.
2. Classify old intake separately: unreviewed pending, old V1 accounts, V2 legacy_hold, paid/approved accounts, suspended, active, learning-bearing, certificates, immutable audit. Never purge entire D1 or all `accounts`/ `device_access`.
3. Count FK reachability before considering cleanup. Keep history, certificates, course activity, audit, security challenges, and legal retention.
4. Prefer excluding legacy pending from current intake inbox with an **audited reversible source filter** over physical deletion.
5. Prepare transactional dry-run in an isolated **local fixture**/snapshot only after verified backup & restore. Compare aggregate and referential-integrity fingerprints. Real deletions require separate Owner approval naming exact records/classes, destination, retention window and rollback.
6. Every staff/Owner UI must distinguish `Load failed` from verified empty inbox.

## Gate

READ_ONLY inventory on real Preview: **NOT_RUN**; old record count: **UNKNOWN**; destructive deletion: **NOT AUTHORIZED**, `NO_WRITE`. This document does not authorize disabling access or removing records.

Related: BOI Issue #108, APP Issue #379. Paired BOI Draft PR #115 & APP Draft #387 stay untouched and unpublished.
