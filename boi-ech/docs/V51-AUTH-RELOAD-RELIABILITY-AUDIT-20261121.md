# BOIECH_AI V51 — Authentication/reload reliability audit
**Date:** 2026-11-21  
**Source:** `BlueDragon33/BOIECH_AI`, main baseline `4ba887b3f04363740855acc6be27932229904ff0` (V50)  
**Branch:** `fix/v51-auth-reload-reliability-20261121` / Draft PR #214  
**Authority:** Owner requested a complete error review, especially reload verification. **Explicit instruction: DO NOT PUBLISH YET.**  
**Scope:** Cloudflare-only; ZERO-SPEND; no Preview deployment, no D1 writes, no session/key deletion, no migration, no merge.

## Summary of source-confirmed issues

| ID | Priority | Source fact / failure mechanism | V51 correction | Current evidence |
|---|---|---|---|---|
| AUTH-01 | P0 | Interaction marks user activity but does not call `keepalive` except from focus/pageshow/online/status-refresh. Server session idle lease is 30 minutes, so a user can actively study in one tab and nevertheless lose their session on F5 | Foreground pointer/keyboard/touch/scroll and actual video `timeupdate` trigger **throttled** server-authorized keepalive (at most once per 4 minutes), without background polling or extending seven-day hard cap | Source + server lease tests; signed browser test pending |
| AUTH-02 | P0 | `readAccountPayload` interprets a non-JSON HTTP 401 from an upstream edge as confirmed logout; `reload()` could reset account UI and hard-navigate | Treat non-JSON 401 as **unverified gateway response**, retain session, use actionable retry; only explicit canonical `SESSION_INVALID` / `SESSION_REQUIRED` allows a 401 logout branch. Actual expired sessions still return anonymous server state and clear cookie | Source + HTTP Response tests |
| AUTH-03 | P1 | The main AccountGate event subscription depends on `waitingForApproval`; state changes resubscribe event listeners while reads are in flight, resetting the `mounted` gate | Stable effect dependency; sync current approval value via separate ref/effect; retain one in-flight refresh and stale-generation guard | Source regression; runtime interleavings not yet proven |
| AUTH-04 | P1 | Every same-account `reload()` invokes `preparePortableAccount`, repeatedly opening/writing P-256 credential and scoped IndexedDB even though the document already initialized them | Skip re-prepare only for the **exact same completed document scope**, never on another account or legacy claim; pure policy regression | Source + pure unit test |
| AUTH-05 | P1 | Credential/vault/portable state IndexedDB helpers leave connections open; other tabs may block schema upgrades, causing 10-second account storage timeouts | Close handles with `finally`; enable `onversionchange` release; preserve all records and keys | Source regression; cross-tab browser test pending |
| AUTH-06 | P1 | Manager UI previously mounted on `ready && active` without requiring entered session plus real signed board-readback | Do not mount manager UI until `enteredAccountId` equals canonical account ID and first board is loaded | Source test; signed manager UX pending |

## Verified boundaries preserved
- **Authorization:** `AccountService.authorize()` still checks session hash, revocation, approved device, onboarding stage and active entitlement for protected modules.
- **Session:** canonical server idle lease 30 minutes; active keepalive bounded by original seven-day hard cap. Never renew an invalid/revoked/expired session by client preference.
- **P-256:** never clear private key or local namespace on Cloudflare HTML/timeout; no skipped approval or forged role.
- **Roles:** learner content and teacher overview load from server; manager board access remains authenticated and scoped; V50 editorial POST still requires teacher session, origin policy, P-256 and human review.
- **Release:** BOIECH_AI Production-first policy means Preview is optional, **not** that QA/rollback/security gates disappear.

## Risks not addressed without separate design and proof
| ID | Priority | Risk | Gate / follow-up |
|---|---|---|---|
| OPEN-01 | P1 | `getCourseDatabase()` performs DDL/PRAGMA/schema repair on cold Worker execution. Could contribute to D1 contention or startup latency; no measured data tying it to the Owner's F5 incident | Instrument existing Worker read-only latency/SQL diagnostics; propose removal of runtime DDL only after migration/recovery proof. **Do not change D1 here** |
| OPEN-02 | P1 | Learner/teacher first-load bootstrap is sequential device+signed challenge+course/overview+lazy asset import; 20-second application deadline can fail on a slow device/network | Signed Chromium/mobile HAR and P-256 status timing, with redacted evidence. Do not claim all slow-device failures fixed |
| OPEN-03 | P1 | V50 editorial route was merged after CI but had not been confirmed on a signed teacher Production session at audit start. Whether authenticated editor flow is fixed cannot be established from public smoke alone | Login as teacher, open `/bien-tap-noi-dung`, return to class, verify 401 other roles and approved laptop proof |
| OPEN-04 | P2 | Service worker may serve cached home shell during offline navigation; authorization remains blocked by network, but feedback might appear like a login issue | Browser offline/reconnect/F5 check with separate guest and signed user. Do not clear caches indiscriminately |
| OPEN-05 | P2 | Single-document / cross-tab account switch still intentionally hard-reloads for identity isolation | Verify progress and draft preservation across switch; no silent cross-account reuse |

## Mandatory real-device acceptance (not implied by green CI)

For each of Học viên, Giảng viên and Cán bộ:  
1. Login approved account from a previously approved laptop. F5 after 10 seconds, 5 minutes and >30 minutes **while continuously interacting**. Verify no false logout; the verified workspace opens automatically; no additional login/recovery or duplicate device registration.  
2. Leave tab hidden for >30 minutes without activity. Confirm canonical expiry requires login — this is expected security behavior.  
3. Open two tabs. Trigger focus/pageshow/back/forward/online rapidly, and verify stable account, no readback storm, no IndexedDB blocked warning, no duplicate GO.  
4. Throttle network / simulate gateway HTML 401 and 503 and JSON 200/401. Confirm gateway errors preserve session/keys, real revoked/expired cookie does not.  
5. Temporarily block IndexedDB upgrade in another tab; confirm friendly error and recovery without clearing local data.  
6. Learner lesson, teacher class/editor, manager board: cross-role/cross-class requests denied, no teacher panels in learner and vice versa.  
7. 320/375/768/desktop: navigation, accessibility and visible retry; video playing keeps session lease only while tab foreground and no blind polling.  
8. Record redacted request statuses, response content-type, build SHA, role, device status and p50/p95 (not cookies, P-256 keys, passwords or other users' data).

### STOP criteria
Any failed main CI/Constitution, data loss, unauthorized read/write, D1 migration mismatch, inability to restore previous Worker, unexplained 401/503 with signed user, or repeat F5/role defect → **BLOCK MERGE AND PRODUCTION**.

### Evidence policy
CI can certify source lint, typecheck, build, isolated fixtures and contracts. It cannot certify signed production browser UX; the latter remains **UNVERIFIED** until performed with valid Owner-approved session. Do not fake QA, approval, live readback or deployment success.
