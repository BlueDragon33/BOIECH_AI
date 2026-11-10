# BOIECH_AI × Application-Management — Consolidated Execution Plan (Owner Scope Freeze)
Date: 2026-11-10
Status: **PLANNED / SOURCE_ONLY, not implemented or accepted**
Constitution verified on Hub main: Blueprint OS **1.3.0 ACTIVE**. Re-verify at execution.
Bơi Ếch Draft PR #114 readback: `73f8890592d2a506b0553eb3a7f5d446ab0a82b9` (draft, unmerged).
App-Management Draft PR #386 latest readback: `7b33f1116fd3e1ccffe5501f5680c464e37a2431` (draft, unmerged); do NOT reuse earlier 80c400/ bd9120 pairing.
Isolated UI branch: `feat/account-auth-ux-split-20261110` @ `6cb177032b1eefca1e0a5d2552f90a041b022941`; static source check 12/12 only; Node22/browser NOT_RUN.
This branch originated at that UI snapshot with scope contract `docs/ACCOUNT-FIRST-R3-ONE-REVIEW-FLOW.md`.

## 0. Invariants
* Free-only; reuse existing Cloudflare Workers and D1; no Vercel; no new DB/R2, paid email/OTP, external new service or secret mutation without separate approval.
* Keep GitHub Draft PRs isolated from new work. Never merge, publish or change Production without independent gate and explicit Owner release authority.
* Keep 5 manager / 10 teacher / 200 learner capacities, shared manager-tier quota as actually configured and max 3 devices. No role escalation by toggling UI.
* Do not re-run previously PASS tests on **unchanged** exact SHA; after source changes run impacted suite and new source/SQL/client tests.
* Evidence classifications: PLANNED, CODED, STATIC_INSPECTED, TEST_VERIFIED, INDEPENDENT_REVIEWED, LIVE_PREVIEW_VERIFIED, OWNER_ACCEPTED, DEPLOYED are separate; no fake PASS.
* Preserve Owner MFA freshness (30 minutes) / CAS / readback / audit / least-privilege. Secure account sessions and separate business vs device trust.
* Never silently delete Production records, certificates, learning results, audit trails or unrelated data.

## 1. Mandatory product specification — identity and onboarding (P0)
| Screen/state | Required behavior | Business access |
|---|---|---|
| Login | compact layered high-contrast card: username, password, forgot-password text link, registration link; no five-button tab strip | session only |
| Registration | separate screen, username, password, confirm password; select either email OR phone with icon, learner or teacher; manager via Owner-issued one-use App-Management invitation | PENDING |
| Submitted | success receipt and request status, no email/SMS OTP at signup | waiting only |
| Approved by exactly ONE reviewer | authorized manager for learner/teacher; authorized Owner in App-Management for invited manager | restricted profile only |
| Mandatory profile | missing required fields marked `*`, retained validation and inline error; progress visible; after valid submit, atomic activation | no general content before atomic commit |
| Active | profile_complete and role grants + entitlement active, trusted device; 30-day default term begins at successful activation, editable by Owner on App-Management UI | scoped role access |
| New device | after correct password, ask for the same registered email/phone as *consistency check only*. Possession proof via signed trusted-device approval (P-256) or safe one-use recovery. Matching self-declared contact string alone does NOT prove ownership | blocked until proof |
| Account personal profile | view/change contact safely; manage and revoke max 3 linked devices; logout, password recovery, state/expiry | assigned role only |

One human approval, NOT two. After profile completion no second reviewer click. Do not automatically open app immediately after signup.
Current BOI source still sends `submitProfile` from `profile_required` to `profile_review`; APP manager UI still has second-approval action — both MUST be changed coherently.

## 2. Work package R1 — Source preflight + auth UX + contact (5 actions)
1. Read current PR HEAD and branch SHA, lock pairing, check Blueprint current policy, preserve earlier PASS evidence.
2. Inspect login/register/recovery UI, select keyboard-accessible contact-type control; remove “Đăng ký một lần”, “Chuyển hồ sơ cũ”, multi-tab forgot-password and login screen device removal; use separate role-specific views, responsive 320/375/430/768/1280 and focus/contrast tests.
3. Implement email OR phone normalized contact input and **server-side** registration validation, uniqueness policy, no OTP and no email-provider integration. Store unverified provenance in existing D1 using additive migration ONLY if required and only after journal check.
4. Place device management and account recovery in Personal Profile; preserve emergency lost-device recovery without exposing it as login tab, and keep manager one-use invitation redirect/fragment secure.
5. Add focused accessibility/UI/unit tests, state/refresh tests and fix regressions.

## 3. Work package R2 — One approval + atomic activation (7 actions)
6. Add additive (not editing 0017–0025) migration/state policy allowing `requested -> profile_required -> active`, with correct legacy fail-closed path.
7. Implement single manager approval for learner/teacher and single Owner approval for invited manager with authenticated role scope and CAS; reviewer action only records approval/provenance and grants profile-only access.
8. Implement profile completion with required fields, phone/email contact handling, atomic D1 batch (conditional approved reviewer, quota/permissions, status, assigned manager, onboarding stage, entitlement, audit) and rollback on any failure.
9. Set account duration default 30 days starting at verified atomic activation, not first approval; preserve App-Management-only edits and readback.
10. Refactor old second-review endpoints and SQL 0025 guards carefully to avoid bypassing V1/V2 and historical permissions. Add adversarial SQL tests for requested/profile_required/changes_requested, reviewer mismatch, expired manager and incomplete profile.
11. Validate 5/10/200 capacity, shared 200/10 manager allowance, max 3 devices, first/repeat login, lost-device proofs, role denial and HTTP 200/401/403/409.
12. Preserve session/recovery account data separation, concurrent final-seat and partial-commit fail-close.

## 4. Work package R3 — Application-Management and manager console (6 actions)
13. Rebase/migrate APP work against LIVE Draft PR #386 head (do not overwrite); remove second Owner approval UI/action and ensure Owner manager approval exactly once with MFA/CAS/readback.
14. Correct two management domains: Owner account policy, manager invitations/approval, duration/permission audit on App-Management; learner/teacher intake, class assignment and scoped staff workflows on Bơi Ếch manager screen.
15. Remove duplicated shadow account administration screens in App-Management; retain one source of truth and versioned read-only reporting; never claim zero accounts on failed fetch.
16. Restore manager's authorized personnel add/remove and scope-limited learner/teacher registration approval; separately constrain application admin from learner/teacher business permissions.
17. Verify mobile manager console PR #107 (still draft/unmerged at readback) including scroll, interaction, contrast and assignment; preserve established teacher/class/room contracts.
18. Cross-product route/state/error/permission tests for Manager/Owner/non-manager, login invite, blocked/revoked accounts, policy 30 days.

## 5. Work package R4 — Legacy intake and product bugs (5 actions)
19. Read-only inventory of old rows: D1 tables, FK relations, status, created_at, learning records, certificates, audit, any local/remote storage; count actual old registrations and identify safe new-wave boundary. Dashboard “0” is not DB evidence.
20. Produce exact dry-run deletion/archive allowlist, backup and restore proof; seek Owner's separate explicit approval of **named destructive scope** before any real delete. No automatic Production wipe. New intake should show only correct new wave.
21. Check learner AI-video upload and navigation hang; reproduce, bound upload/analysis, abort/cleanup on return home; ensure no stale background work or data loss.
22. Implement/verifiably issue course-completion certificates only when actual criteria pass, signed/audited approval and download/readback; no premature certificates.
23. Repair remaining manager personnel and UX regressions only if confirmed by live evidence, maintaining scope discipline.

## 6. Work package R5 — Verification & release (7 actions)
24. Run impacted Node22 tests + new negative tests, lint, tsc, build and all local Drizzle/Wrangler migrations through current approved journal; record exact SHA and logs.
25. Obtain actually independent professional Reviewer A/B executable negative evidence with path:line verdict; comments requesting reviews do not count as PASS.
26. Verify GitHub Protected Environment boi-ech-preview and existing Cloudflare Preview/Production D1 UUID identities, binding inventory, ledger, revision, access guards and FREE headroom **read-only**. Never infer D1 from overview Bindings 0.
27. If any paired Preview workflow installs/rotates a bridge secret, STOP for distinct credential-mutation authority; no implicit permission from general Preview approval.
28. When all gates PASS, deploy existing two Cloudflare Preview Workers at pinned exact paired SHAs, no Vercel, no Production; never auto-provision services.
29. Live synthetic Owner acceptance: email/phone signup, manager invitation, one approval and profile completion, ACTIVE/30-day UI, 3-device recovery, MFA, CAS, 200/401/403/409 and mobile/desktop + AI video navigation/certificates.
30. Save Owner feedback, smallest source fixes and regression evidence. L3 only after acceptance. Production release requires separate explicit Owner authority and rollback/recovery readback.

## Execution and stopping boundaries
Five bounded work packages R1–R5 = 30 tracked actions, 4 practical grouped execution turns where safe (R1; R2; R3+R4 read-only; R5). Do not ask for approval for every harmless file change.
Human decision required only for: destructive data scope, changing protected secrets, Production/publish and genuine Owner UX approval.
Begin with R1 only after this consolidated plan is acknowledged through Active Next Action. Preserve previous issue checkpoints and avoid Hub UANA work.
