# Premium Manager Console acceptance plan

> Execute in this session, preserving the existing design. Use a separate final reviewer.

**Goal:** Verify and repair the handed-off console, leaving a reviewable exact-SHA candidate.
**Architecture:** Retain the existing React workspace and signed training client. Limit fixes to reproduced UI or regression defects; do not change backend authorization, schema, dependencies, or deployment configuration.
**Tech stack:** Node 22.16.0, React 19, TypeScript, ESLint, Vinext/Cloudflare local build.
**Spec:** `docs/handoffs/BOIECH_PREMIUM_MANAGER_CONSOLE_20261106.md` and the Owner's WORK A–Z acceptance request.

## Global constraints

- Starting HEAD `27008e68a5bfef9cd22f94605e3d39e58c4b2766`; PR #107 base `8dca369bd3352e0e1c18c39ef3d365fbaeee156c`.
- Blueprint OS 1.3.0 is adopted; sovereignty posture remains MIGRATION_REQUIRED.
- ZERO-SPEND: no hosted Actions, PR creation, merge, Production, permission/schema changes, or new Site/repository.
- Manager grants and admin grants remain distinct. Unsupported approval actions remain BLOCKED.
- Compare fresh remote HEAD before any candidate update; never overwrite concurrent work.

## Review focus

- Inactive/missing room parents must not become available through filtering.
- Adjacent, nested, timezone-offset and overlapping sessions must use real time order.
- 320/375/768px and desktop layouts retain readable text, keyboard/dialog focus and touch controls.
- Failed writes, stale data and optimistic conflicts retain drafts and show an honest state.
- A manager can access only the existing signed commands; review shortcuts cannot approve people.

## Task 1: Establish runtime baseline

- [x] Verify refs, handoff, adoption, workflow triggers and clean checkout.
- [x] Install the committed lockfile under Node 22; do not edit package inputs.
- [x] Run focused manager tests, TypeScript, full lint, build/regressions and release/artifact validators. Retain complete logs.

## Task 2: Repair observed console defects

**Files:** `boi-ech/app/manager-command-center.tsx`, related manager CSS/workspace/detail files only when needed; behavioral regressions in `boi-ech/tests/manager-command-center.test.mjs` or existing manager suites.
**Interface:** Existing `TrainingBoard`, callbacks and signed `save-resource` / `save-session` / `assign-person` remain unchanged.

- [x] Reproduce each material defect with an existing test, failing regression, type/lint check or browser observation before editing.
- [x] Apply the smallest fix and rerun the affected gate.
- [x] Run the complete required gates on final source; record exact results and remaining blockers.

## Task 3: Preview and access acceptance

- [x] Start the existing application's managed local Preview using the provided preview service.
- [x] Inspect desktop and mobile; check navigation, hierarchy, filters, forms, theme/text size and failure states with isolated synthetic QA data only where necessary.
- [x] Distinguish source-backed component QA from authenticated backend acceptance. Do not bypass manager/admin authorization or touch live data.
- [x] Record preview URL and explicitly blocked live checks.

## Task 4: Reviewable candidate

- [ ] Obtain one independent code review, repair material findings with regression evidence, and record limitations.
- [ ] Commit permitted source/evidence changes and refresh remote HEAD before a non-forced feature-branch update that cannot trigger hosted Actions.
- [ ] Report candidate SHA, actual gate results, Preview URL, blockers and one Next Action. Owner visual acceptance and exact-SHA release approval remain pending.

## Checkpoint

Verified code: `de6c9462268d9378a753454b396437f2bed8b98b`. Build/regressions 560/560; focused 37/37; typecheck/lint/release/artifact exit 0. Preview workflow validator remains BLOCKED. Independent review stopped after one confirmed finding because the reviewer hit its usage limit; the finding was repaired, but final review is not complete. Full evidence: `docs/evidence/premium-manager-20261106/ACCEPTANCE.md`.
