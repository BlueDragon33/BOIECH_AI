# ACTIVE WORK HANDOFF — BOIECH_AI | ISSUE #108 | ACCOUNT-FIRST V2

Date: **2026-11-07**. This is a source-only technical handoff for ChatGPT **Work mode** with a browser and a real, authorized QA environment. NOT a source admission, QA PASS, merge, ratification or Production deployment.

## 1. Exact anchors and non-negotiable scope

- Repo: `BlueDragon33/BOIECH_AI`; **active source branch**: `feat/account-first-v2-108-admission-20261107` (read live SHA before working).
- Branch base: `candidate/account-first-p0-20261104` at `8c2b4710cb4c2802affe7d433ab0450d030a944a`; `main` last read `b511255063a7637167f6d7ac5f8fd86f013f74b9`. Do not assume these remain current.
- [GitHub Issue #108](https://github.com/BlueDragon33/BOIECH_AI/issues/108) is authoritative requirements discussion; must preserve **5 manager / 10 teacher / 200 learner**, **3 devices/account**, two-stage approval, explicit sync consent, data isolation, account expiry, password secrecy.
- PR [#107](https://github.com/BlueDragon33/BOIECH_AI/pull/107) is still a draft manager mobile console based on main, not yet merged. Reconcile carefully; no blind rebase that erases either candidate.
- Use the **existing Cloudflare Workers + D1** application, unchanged Production URL/slug and DB ownership. No Vercel, new site, new paid resource, GitHub-hosted Actions, production SQL, feature enablement or unauthorized merge.
- Feature flags: `BOI_ECH_ACCOUNT_FIRST` **OFF** in release baseline and `BOI_ECH_ACCOUNT_V2` new opt-in gated by Account-first; keep BOTH OFF in Production until all gates PASS. Verify current environment before any claim.

## 2. Source implementation present — NOT accepted yet

These are **code facts**, not verified behaviors:
- `drizzle/0019_account_capacity.sql`: atomic registered account caps 5/10/200, role-change guard, max 3 unrevoked keys/account; explicit error messages.
- `drizzle/0020_account_onboarding_v2.sql`: add `account_onboarding` with `requested → profile_required → profile_review → active`, revision/CAS, rejected profile loop, `legacy_hold`; device `approved` flag. Existing accounts not auto-reapproved.
- `drizzle/0021_account_verified_sync.sql`: device-scoped consent grants, narrow progress/preferences records, event IDs + server revisions, D1 guard rejecting unapproved/revoked device events.
- `drizzle/0022_account_manager_allowance_v2.sql`: conditional default manager approved capacity 50/5 → 200/10, preserving non-default Owner customization.
- `app/account-core.server.ts`: opt-in stage-1-only registration; server gate for stage-2 and approved device; second decision tied to Owner/manager approval batch; three-device cap errors; trusted device approval with password step-up; scoped lost-device list/revoke/recovery approval with one-time code; hashes never returned.
- `app/account-v2-workflow.server.ts`: first review Owner for manager, manager for learner/teacher, post-first-review profile submission and correction loop, secondary review stays under final `account-core.server.ts` grant transaction.
- `app/account-v2-sync.server.ts`: opt-in per-device, per-scope consent/password proof, narrow data whitelist, revision CAS, retry idempotency, ACK, conflict returns 409. `api/accounts/sync` binds immutable account ID to the current HTTP session to stop cross-account offline writes.
- `app/verified-sync-client.ts`: per-account IndexedDB pending event queue, only delete on verified matching ACK, preserve 409 conflicts; no device-to-device sync or media uploads. `app/verified-sync-settings.tsx`: scoped consent/manual flush UI.
- `app/account-gate.tsx`: two-step registration/profile UI, correction note, third-party device confirmation, one-time lost-device recovery; `app/manager-v2-review-panel.tsx` and `manager-approval-panel.tsx` switch manager approval UI when V2 is active.
- `api/manager/device-approvals`: old single-step signed device approval blocked when V2 is active; `api/admin/devices` already blocked under Account-first; teacher legacy approval is blocked under Account-first.
- `app/account-capacity.server.ts` + Owner `api/control/accounts`: 5/10/200 read/CAS update/audit and Manager first-review Control API.

## 3. Evidence honestly available

- **6/6 PASS** in local Node 22 + SQLite admission/device policy tests (earlier task, `tests/account-v2-capacity*.test.mjs`).
- **3/3 PASS** in a separate LOCAL schema-equivalent SQLite harness on 2026-11-07, covering stage-machine, revoked/pending sync event guard and conditional 200/10 default. That harness is NOT an exact live D1 runtime test, and its copy is not an authority for deployed schema.
- `tests/account-v2-onboarding-sync.test.mjs` was **added to repo but NOT RUN** in this Chat session. Do not claim its outcomes.
- **Full `npm test`, TypeScript typecheck, changed/full ESLint, build, target compatibility date/workerd, browser mobile (Chrome/Safari/iPhone), real Preview D1, migration of actual authorized legacy snapshot, independent reviewer and Production acceptance are NOT RUN/NOT ACCEPTED.**
- Prior Account-first P0 known gates remain `REVIEW BLOCKED / CI PENDING / real D1 BLOCKED`; source checks from older SHA cannot be promoted to current HEAD.
- This branch has source commits marked `[skip ci]`; no hosted workflow was dispatched, no PR event, merge, D1 mutation, Production release or paid service.

## 4. Work — execute A→Z until authorized blockers, no repeated user micro-questions

**Stage A — Source integrity and local QA.**
1. Open a real full checkout from current branch HEAD. Compare against P0, main and PR #107. Verify the complete lockfile & exact revision; discover missing Drizzle migrations (P0 0018 may be out-of-band versus journal) before any SQL execution.
2. Run `npm ci` (prefer already cached dependencies with no cost), `node --test tests/account-v2-*.test.mjs`, all linked legacy tests, `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`, release/Preview validators and security tests **only in an authorized local isolated runtime**. Fix all real failures; attach exact logs with source SHA. Existing PASS from older branch does not count. Avoid expensive repeat runs on unchanged source.
3. Audit SQL application sequence 0017/0018/0019/0020/0021/0022; ensure one authoritative migration path, replay/idempotency/rollback; schema backfill must NEVER delete legacy progress, account approvals, training assignments, payments or issued certificates. Inspect real authorized **read-only** snapshot first; use isolated clone and row+hash diff. `legacy_hold` must be reconciled only via explicit signed Owner decisions, not automatic activation.

**Stage B — Security and functional closure.**
4. Execute server-side two approvals for manager and learner/teacher, scope ownership, manager no self-escalation, requested/profile_required/profile_review/changes_requested/active/expired/suspended gates; reject wrong actor and stale revision. Verify all old signed/device/teacher routes cannot bypass the V2 cookie + device grant + stage gate. Fix any bypass centrally.
5. Validate device key ownership (one-use signed challenge), 3/3 → fourth denial, pending device no data, trusted device approval, password/recovery one-use rotation, lost-all-devices scenario and immediate revoke of session/sync; don't claim remote wipe of previously downloaded data offline. Avoid account enumeration and prevent leaked name/phone/video before device approval.
6. Validate Owner App-Management UX + authenticated step-up MFA (two reviews, capacity 5/10/200, 3-device policy, expiry, personnel grant). Implement Central UI/contract **in existing Application-Management repo** only through approved app-scoped API; no direct DB or shared secret in client. Do not put Owner controls in student UI.
7. Sync bridge is CRITICAL: V2 event store **is not yet wired to existing canonical course progress/grades**. Map current `device_profiles`, course completion, signed teacher assessments, legacy IndexedDB queues and certificate links to canonical account IDs safely. Never make sync events a second contradictory source of truth. Preserve queued offline events across browser refresh, account switch and network drop; test confirmed scope → server ACK → stable revision on devices A/B/C, retries, duplicate event, conflict showing remote/local versions, user-authorized resolution; video/PII default-off. Enable sync control UI for real usage only after bridge and privacy review.
8. Verify pending devices cannot enumerate or read profile/other devices, and old Bơi Ếch UI stays usable when V2 is OFF. Ensure recovery and privacy copy are clear on mobile and screenreader.

**Stage C — Cost, Preview and independent acceptance.**
9. Target **Cloudflare Workers FREE** CPU and D1 capacity. Existing `scrypt` N=32768/r=8/p=3 may exceed Workers Free CPU; benchmark actual runtime. No downgrade to fast hashes or automatic paid tier. If a secure cost-free alternative cannot be verified, remain BLOCKED.
10. Restore/obtain **authorized** isolated Cloudflare Preview HTTPS + D1, never Production D1; verify a real signed manager, learner, teacher and owner approval, 3-device race, 215-account admission under load, consent, sync, rollback, cold-start and physical browser mobile behavior. Do not fabricate CI or external reviewer PASS.
11. Ask independent authorized human reviewer for exact SHA plus evidence, have owner approve release after required gates. Until then preserve both feature flags OFF, no merge and no production write.

**Stage D — Release, if and only if all gates PASS.**
12. Integrate with manager UI PR #107 without losing responsive layout, run final source + Preview QA; prepare **draft PR** as appropriate only after avoiding unapproved GitHub-hosted Actions; human review and merge under branch policy, protected Cloudflare Production release of exact approved SHA with rollback; verify site unchanged, quota policy readback and server audit. Publish only when production authority explicitly covers exact artifact and environment. If any dependency unavailable, STOP at that gate and return one Next Action + safe fallback (flag OFF, existing Production unchanged).
13. After Issue #108 has trustworthy end-to-end acceptance, start a **separate** training/certificate PR: enrollment→class→lesson→teacher evaluation→manager course completion→PDF/QR→verify/revoke/reissue, preserve legacy certificate IDs and avoid implying state-accredited credentials.

## 5. Definition of Done / Reject conditions

- 2 review events and proper role scope proven on actual endpoint and D1; no old route bypass.
- 5 manager / 10 teacher / 200 learner independent admission; 3 devices/account; concurrent last-slot tests.
- User can remove device on trusted browser or via one-time recovery, no data leak on pending device.
- 3-device sync opt-in, ACK, no event duplication or offline loss, explicit conflict handling and PII/video default-off; real course progress consistent.
- Time-limited account entitlement/revoke and password hash security remain enforced.
- Legacy snapshot and rollback, isolated real Preview, CPU/Free, independent reviewer, mobile UX and human production gate ALL PASS.
- `Account-first V2` is **not** declared 90–95% complete by estimate or source volume. Only use itemized evidence and explicit blockers. No fabricated acceptance, no paywall or new site.
