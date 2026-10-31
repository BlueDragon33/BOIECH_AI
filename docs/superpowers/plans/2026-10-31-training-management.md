# Training management implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, followed by one independent whole-branch review.

**Goal:** Three registration roles and a working manager allocation system backed by the existing canonical registry.
**Architecture:** Existing signed identity plus an explicit Owner-granted manager permission; D1 resources/sessions and atomic commands; direct React manager workspace. Small Central companion for permission administration.
**Tech Stack:** Existing React/TypeScript, D1/SQLite, node:test; no new dependencies.
**Spec:** docs/superpowers/specs/2026-10-31-training-management.md

## Global constraints

Constitution1.3.0; no implicit production authority; no new origin/site; no self-granted manager rights; use actual registered people/canonical class fields; keep existing payment/expiry/content privileges; UTC storage and local labeled display; non-color labels; no fake availability or incomplete totals.

## Review focus

- Role/code changes after a permission grant must revoke it; auto-approval cannot grant manager access.
- Concurrent reservations, stale edits, capacity reductions and unavailable buildings cannot invalidate accepted bookings silently.
- Adjacent intervals, timezone conversion, cancelled sessions and expired people produce correct availability.
- Duplicate command retries, lost replies and failures preserve drafts and cannot duplicate allocations.
- Empty/mobile/offline/error states remain actionable; no phone/secret/media overfetch.

### Task1: Owning registration, permission and allocation service

Files: device-auth.server.ts, device registration page, db/schema.ts, migration0017, new training-management model/server/route, control overview grant boundary; runtime tests.
Interfaces: `manager` person role, `managementEnabled` public permission, `POST /api/training-management` with signed proof/action/commandId and list or versioned mutations; response contains actual allocation snapshot. Existing class_name remains authoritative.
- [x] Write failing signed manager/permission and SQLite scheduling tests; observe failures.
- [x] Implement schema, authorization, receipts, conflict/capacity invariants and canonical assignments; targeted tests green.
- [x] Run full npm test and strict typecheck; commit.

### Task2: Manager workspace and Central admin permission control

Files: new manager-workspace.tsx/CSS; page routing and three-choice registration; Central Boi adapter/client/control view; interaction tests.
Interfaces: workspace consumes `deviceId`, `getProof(signal)` and the owning snapshot; Central forwards explicit Owner-only manager permission command to Boi.
- [x] Write failing actual component or consuming-client tests for registration/routing, draft retention, errors and counters.
- [x] Implement six views, search/state filters, actual counts/availability, create/edit/assign/schedule/cancel flows and bounded signed requests.
- [x] Run both repository suites, lint, typecheck, release audit and whitespace checks; commit.
- [ ] Independent whole-branch review; one RED→GREEN material-fix pass; exact-tree PRs and exact-head CI.
- [ ] Deliver concrete PRs, migration/permission impact and honest acceptance evidence for the separate release decision.

## Verification checkpoint

Boi full npm test PASS: verified build and 519 tests. Strict tsc --noEmit PASS; lint zero errors with three unchanged baseline warnings; release-readiness audit PASS and whitespace check clean. Twelve new runtime/component/client tests use real migrated SQLite, actual signed P-256 identity, actual authorization/SQL/trigger/receipt code, real SSR markup and a test-only hook harness for editing transitions. RED→GREEN observed for manager registration/permission, current-session assignment and capacity state, permission revocation on every identity writer, aborted late reads, cancellation after staff expiry/class archival, error appearance, invalid dates and non-object requests. Source-shape assertions pinning the old two-role label were updated to let runtime behavior cover the new three-role component.

Central companion base45d502d, local headbfbe992: full npm test PASS including typecheck/build/806 tests; changed files lint clean (Boi control-center baseline also clean); Owner grant/revoke and independent readback runtime tests PASS. New management operations preserve the existing trusted Owner bridge model and production step-up boundary. No live policy/device/payment/permission change has been performed. One generated-directory ENOTEMPTY build failure was resolved by removing ignored generated dist and rerunning; no source workaround.

Rendered browser mobile/desktop acceptance, final computed/composited contrast, physical iOS and real human Owner grant are UNVERIFIED. No new live site/origin has been created. Migration0017 and both app releases remain a concrete proposal behind the separate explicit production gate; deploy Boi before Central. Independent review and exact-head CI pending.

## Independent review and material fix pass

One read-only review covered both repositories. Four Important findings were reproduced RED and fixed GREEN, with no deferred minor findings:

1. Every transition into counted learner membership now checks class and accepted-room capacity, including null-safe class/status/role/registration/expiry changes. Auto-approval that encounters a full configured class preserves the registration in pending state and records `class_capacity_reached`; it does not return a false outage or overfill an accepted booking. Explicit approval/renew/unblock capacity failures return409. Security blocks remain possible.
2. An acknowledged command retires its receipt ID. Uncertain retry still reuses its ID; a later deliberate identical assignment uses a fresh ID and performs the intended change.
3. Board reads aggregate bookings and memberships with maps/sets rather than scanning resources per learner/session. A real local SQLite fixture with950 people,1000 resources and1000 sessions returned in36ms/3852 class-key comparisons; this is not a live D1 benchmark.
4. Readers and triggers consistently tokenize teacher classes, including comma/semicolon/newline separators without collapsing internal spaces. Class renaming cannot orphan assignments.

Final local evidence after this pass: full Boi npm test/build523/523PASS, strict tsc PASS, lint0errors3unchangedwarnings; Central unchanged and full806/806PASS. Targeted feature set16/16PASS. Each original finding had an observed failing runtime reproduction before the fix. No re-review seat, dependency addition, live grant or release action.

Review rulings: actual rendered desktop/mobile and final computed/composited contrast remain UNVERIFIED (possible layout/accessibility issues must be checked before release); physical iOS remains untested (device-specific behavior may differ); human Owner/MFA and live bridge configuration remain untested (only controlled signed runtime boundaries verified); production migration/release and actual D1 performance remain unperformed (must use protected release gates and owning readback). Fresh SQLite migration and the local large-board test do not replace those acceptance steps.
