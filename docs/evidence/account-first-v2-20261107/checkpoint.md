# BOIECH AI — Issue #108, source checkpoint (2026-11-07)

Status: **PARTIAL IMPLEMENTATION / NOT ACCEPTED / FLAG OFF / NO PRODUCTION CHANGE**.

## Scope completed in this branch

Base: `candidate/account-first-p0-20261104` at `8c2b4710cb4c2802affe7d433ab0450d030a944a`. This branch is intentionally NOT rebased onto `main` or PR #107.

1. Additive `drizzle/0019_account_capacity.sql` policy 5 manager / 10 teacher / 200 learner. Atomic trigger blocks account registration overflow per role and prevents reassignment circumventing the cap. All existing canonical accounts (including historical/legacy) occupy the quota. Null-login historical backfills remain permitted to avoid destructive data loss when old count exceeds the cap. NO legacy person/course/certificate data is changed.
2. D1 account-device triggers enforce 3 non-revoked device keys per canonical account, including reactivation; repeat login with existing key remains possible at 3/3.
3. `account-core.server.ts` maps capacity and device D1 constraint errors to explicit 409 account codes; localized messages in `account-runtime.server.ts`.
4. `account-capacity.server.ts`: owning-app account limit read/count and signed Owner-only mutation with expectedRevision CAS, audit and independent readback. `api/control/accounts` exposes `capacity`/`set-capacity` only through the existing Control service boundary. NO App-Management GUI update is claimed.

## Verification actually run

- Local Node 22 + SQLite, isolated synthetic fixtures:
  - `account-v2-capacity.test.mjs`: 5/5 PASS (last-slot overflow, existing key retry vs 4th key, revoked reactivation, role-change guard, under-limit config, legacy >200 backfill).
  - `account-v2-capacity-service.test.mjs`: 1/1 PASS (Owner read, role authorization failure, CAS stale write refusal, audit, readback).
  - Combined: 6/6 PASS, 0 failed.
- Tests were executed on source-equivalent local fixtures. Complete repository checkout, `npm test`, actual D1 multi-writer, complete TypeScript/build/lint, physical browser QA and independent review **NOT RUN**. GitHub-hosted Actions **NOT DISPATCHED**.
- No merge, PR, Production, Cloudflare credentials, D1 write, live account grant or paid resource used in this task.
- Migrations must be applied and tested in an approved isolated environment; source code presence is not a deployed policy.

## Remaining P0 release blockers

- Account-first P0 has its own unresolved review/real-browser/target-runtime/legacy-snapshot gates. Feature flag `BOI_ECH_ACCOUNT_FIRST` must stay OFF.
- **Two-stage approval** is NOT implemented; existing new-account registration still collects a full profile at first registration and current review remains one-stage. Must implement first review -> profile entry -> second review for manager and learner/teacher in BOTH Bơi and Central UI. No skip from request to ACTIVE.
- 3-device denial has clear errors but **4th-device restricted recovery**, confirmation of device link, step-up, real mobile UI and legacy accounts with >3 existing keys remain pending. Do not auto revoke in migration.
- Verified sync consent, per-account server revision/idempotent ACK, conflict resolution, no data loss on account-switch, offline video privacy and revocation must be implemented/tested. Current isolated IndexedDB stores are NOT a confirmed-sync solution.
- Old manager-tier shared admission policy 50 learners / 5 teachers still needs controlled migration to support **200/10**. DO NOT silently mutate existing legacy limits or assert 200/10 active admissions.
- Owner capacity settings GUI in `Application-Management` and independently verified MFA are not connected; backend path alone is not approval.
- Cloudflare Workers Free CPU/KDF benchmark, D1 read/write and storage quota, 2 simultaneous last-slot operations and real authorized snapshot, Preview HTTPS/rollback + independent security acceptance must PASS.
- Course lifecycle and certificate should be a **separate follow-up PR after Issue #108 passes**, with account-linked enrollment and manager-approved issuing; legacy verification codes must remain valid.
- Existing Cloudflare Worker URL/slug, schema rights, production data and FREE-only spend policy remain unchanged.

**Next action:** implement and locally test dual-approval state machine + fourth-device recovery before adding consented sync. Reconcile Central owner management UI, then isolated Cloudflare Preview QA. Do not begin course/certificate PR or Production publish until Issue #108 acceptance gates pass.
