# Issue #108 / App #379 — canonical account entitlement source checkpoint
Date: 2026-11-08. **SOURCE-ONLY, NOT TEST-ACCEPTED, NOT DEPLOYED.**

## Added in this branch
- D1 additive migration `0023_account_entitlement.sql`: account-level entitlement separate from device payment/access expiry; role defaults 30 days, independent revisions.
- `account-entitlement.server.ts`: policy/list/read, second-approval grant, suspend/resume/set-expiry, Owner-only changes, expected revision/CAS, bounded reasons, immutable audit and authoritative readback.
- `account-core.server.ts`: bind entitlement grant into existing *second-review D1 batch* for manager/learner/teacher; protected module gate checks account entitlement; manager effective permissions reflect entitlement. V2 OFF path is unchanged.
- `api/control/accounts/route.ts`: Owner-only account policy and per-account duration commands under existing short-lived signed control ticket. 3-device cap and 5/10/200 quota remain separate.
- `tests/account-v2-entitlement.test.mjs`: Node 22 local SQLite tests added for 30 days after approval, role policy, CAS/audit, suspend/resume, reapproval idempotency and expiry denial.

## Source-only checks
15/15 cross-repo string/invariant checks PASS on GitHub source (the companion App branch implements Owner UI, bridge readback and MFA). **This is not test execution.** Node tests, TypeScript, lint, build, workerd, runtime CPU/KDF, migrated D1, physical 3-device sync and browser QA have **NOT RUN** on this commit.

## Known blockers
- Existing `drizzle/meta/_journal.json` currently stops at `0015_child_health_content` although additional migration SQL files `0015–0023` exist; the authoritative runtime migration sequence must be reconciled before ANY D1 mutation. Do not blindly edit the journal or run production migrations.
- Cross-device canonical course-progress sync bridge still missing. Role/scope and legacy signed routes require full security review.
- Real Cloudflare Workers FREE KDF CPU, Preview + D1 isolation, legacy snapshot rehearsal, Owner UI/MFA runtime and independent human review are unverified.
- Cloudflare tokens currently recorded as expiring 2026-12-07; no credential expiry changes in this branch, do not confuse them with account entitlement.
- Feature flags `BOI_ECH_ACCOUNT_FIRST=OFF` and `BOI_ECH_ACCOUNT_V2=OFF` remain required for Production.

**Next action:** full checkout Node22 and source QA (including existing Account First V2 tests and migrations) and fix any failures. After green source QA, isolated FREE Preview D1 and signed Owner/browser device acceptance, then independent review before merge or Production.

## UPDATE 2026-11-08 — Draft PR #109 and test fixture repairs

- Open draft PR #109 targets existing V2 branch `feat/account-first-v2-108-admission-20261107` (not main).
- Fixed source test harness loading `account-entitlement.server.ts` in `tests/account-first.test.mjs`, `tests/account-v2-onboarding-sync.test.mjs`, and `scripts/account-migration.mjs`.
- Added `0023_account_entitlement.sql` to the V2 synthetic SQLite fixture, with 90-day **legacy device** default deliberately distinct from new 30-day **account entitlement**. Approval tests assert the distinction.
- Owner entitlement list now discloses legacy device expiry and payment status separately, without modifying device/payment data.
- Local **synthetic SQL-only smoke** (reconstructed DDL/INSERT in Node v22 node:sqlite): pre-approval grant 0, second-approval grant 1, repeated grant 0 — PASS. This is **not** an exact-repository npm test nor migration acceptance.
- Repository uses `migrations_dir: "drizzle"` for Wrangler D1; Wrangler applies SQL migration files, while Drizzle `meta/_journal.json` ends at a mismatching 0015. These are distinct mechanisms. Preserve current journal and examine migration ledger/readback in isolated D1 before rollout; do not falsely claim it is reconciled.
- Actual Node22 `npm ci`, lint, typecheck, npm test, build, D1 Preview workerd, browser/3-device and reviewer remain NOT_RUN. Production and Cloudflare secrets unchanged.
- Source HEAD changes after original checkpoint: use live head from PR #109, not pinned old checkpoint SHA.
