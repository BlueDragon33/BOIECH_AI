# OWNER V9 — PREMIUM MANAGER UX, EARLY PROFILE, SAFE 8-HOUR TRIAL CONTRACT
2026-11-11 | Source-only, no Production. Blueprint OS currently 1.3.0 ACTIVE.

## Design baseline (non-negotiable)
Preserve original Premium navy/violet/cyan Manager Console, 6 LIVE source-backed KPIs and desktop rail/mobile dock. Do not rebuild as simple cards. The 4 Owner-provided screen captures show: (1) account and security panel leaking into all management tabs, (2) device revoke shown before learner approval, (3) unattractive pending-registration state and misleading renew-session button, (4) building diagram which needs multi-level icon navigation.

Owner's local `file:///C:/Users/dinhn/Downloads/boi-ech-manager-ui-concept.html` is **NOT available to the remote execution environment**. Must be uploaded as an actual HTML file before any asset/code comparison. Never claim it was examined.

## Locked V9 interface contract
1. Remove **user-entered personal code for ALL roles**. Internal generated `person_code` remains only a stable technical key to preserve existing D1, audit and class mappings; no user field, no human-readable personal-code badge. Keep existing data intact.
2. Add first-class **Kiểm duyệt tài khoản** section to Manager desktop navigation/mobile dock, separate from Overview, People, Building, Rooms, Schedule and Settings. Within it use explicit **Học viên** and **Giảng viên** tabs and stage filters, with scoped D1 pagination/authoritative readback; do not duplicate approval panel in global account topbar, Overview, other tabs or APP Owner.
3. Device management up to 3 trusted P-256 devices is available only in authenticated **Trang cá nhân / Cài đặt và bảo mật** after ACTIVE. It is NOT displayed in pending registration. Distinguish trusted vs pending and revoke sessions only for valid account principal.
4. Waiting UI should be professional, show status/steps, and allow completing personal information **before approval**. A canonical, persisted, validated preapproval draft is held in separate `account_profile_drafts` D1 table, retained through any trial. Only the user from a trusted session can save/edit it while onboarding requested; manager queue shows permitted name/class, Owner-only control can read full profile/contact. After exactly one human review moves requested→profile_required, user can activate using the saved draft, **no retyping**, and entitlement default 30 days begins at ACTIVE.
5. Owner APP may audit/read complete BOI profiles under Owner-only control; only BOI manager may approve learner/teacher. New Owner control request `{action:"list-all",after,limit}` is strictly read-only, paginated and Owner-authenticated. BOI manager may NEVER approve manager or change APP Owner policy.
6. Facility Explorer is source-backed **Tòa → Phòng/Hồ → Lớp → Ca → Cá nhân** icons with room/class selected state and scoped details; class-room association derives from noncancelled sessions IN the chosen time window. Never invent physical floor coordinates, fake attendance or people.

## Eight-hour trial — required future work, deliberately NOT enabled yet
User wants to REPLACE "Gia hạn phiên" with "Trải nghiệm thử giao diện 8 giờ" on pending/registered account and allow all roles to try the UI; manager trial may **view only**, never approve/change actual rights. Teacher/learner trial can interact with the same feature set, but only in a strictly segregated sandbox. These requirements are **not equivalent** to changing the live session's eight-hour inactivity window or granting V2 ACTIVE.

**Safe implementation gate before enabling CTA:**
- Server-authenticated, immutable per-account trial start and `expires_at = started_at + 8 hours`; no extension by login refresh or new device; session/sandbox must reject when expired. Manager preview independent of Owner invitation cannot become a real manager account.
- Use isolated no-real-write trial transport; never call real D1 training mutation, approval, certificates, uploaded-video AI jobs, assignment or Owner Bridge from a trial context. Build a dedicated sandbox adapter/namespace for learner/teacher functionality; manager always read-only. If a feature cannot be sandboxed it must say **not available in preview**, not secretly execute real operations or fake AI results.
- Trial-produced uploads/results/actions must be ephemeral and purged on expiry. If using durable trial object storage later, explicit 8h TTL cleanup and leak-negative tests are required. **NEVER delete canonical account credentials, early registered profile/contact, actual D1 enrolment or previously approved content** when trial ends.
- Visible countdown, warning before expiry, server-verified state after refresh, clear provenance label `DỮ LIỆU THỬ — KHÔNG LƯU VÀO HỒ SƠ THẬT`; after expiry return to pending/approved normal flow.
- D1 account metadata for one-time trial issuance can be retained safely for abuse resistance and audit, distinct from trial activity. A trial role cannot pass account.capability(), manipulate App-Management, exploit contact echo, obtain manager approve scopes or use more than 3 trusted devices.
- Test 200/401/403/409, concurrent starts, second login, clock tampering, browser refresh, expiry, pending→approved transition, 8h TTL, sandbox-only network and purge, 320/375/430/768/1280. No real account deletion.
- DO NOT render an enabled "8h trial" button or claim eight-hour completion until safe sandbox is implemented/tested and Owner visually accepts it. Source controls remain flagged OFF for actual service; no feature flags enabled by this work.

## Current implementation state (pending exact-SHA CI)
- Implemented on isolated branch from V8: dedicated approval tab and learner/teacher switch, remove global duplicate, personal devices only ACTIVE and in personal Settings, auto internal code, early profile draft + D1 migration 0029/API routes, Owner-only all-role readback, premium pending status, source-backed class/person hierarchy and actual six KPIs.
- 8h sandbox service and timed cleanup: **NOT IMPLEMENTED / BLOCKED**; legacy "Gia hạn phiên" button removed but NOT replaced with an unsafe trial control.
- Do not change APP source, do not merge, no Production/Cloudflare/secret/remote D1/new DB/old record deletion, no paid services. The old R8 source and original Owner-approved layout remain intact.
- Actual tests Node22, TypeScript, lint/build, local D1 0029, Windows and browser still required at exact new SHA, plus independent reviewers. Static source checks alone are not E2E acceptance.
