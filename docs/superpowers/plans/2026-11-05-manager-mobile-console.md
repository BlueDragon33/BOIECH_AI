# Manager Mobile Console Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline; perform one fresh whole-branch review after verification.

**Goal:** Make the existing Boi manager console usable on phones, with truthful class, room and person status bars and actionable detail views.

**Architecture:** Keep all data and mutation boundaries unchanged. Extract status presentation/model and detail-sheet components; the dashboard owns navigation and existing form drafts. Local appearance settings never alter server access.

**Tech Stack:** Existing React 19, TypeScript, CSS modules, native dialog, Node test runner and SQLite fixtures; no new packages.

**Spec:** docs/superpowers/specs/2026-11-05-manager-mobile-console-design.md

## Global Constraints

- Start from verified BOIECH main b511255063a7637167f6d7ac5f8fd86f013f74b9 in an isolated feature worktree.
- No new dependency, database, deployment, migration, flag change, API expansion or broader directory fields.
- Preserve account-first candidates and flag OFF; do not touch App-Manager hotfix or re-grant manager access.
- No real personal data in fixtures or public evidence; ZERO-SPEND.
- Prepare a reviewable candidate; no self-approval, merge or Production publish.

## Review Focus

- Partial and overlapping room bookings: measure the selected interval, not booking count divided by seat capacity.
- Full/overfull classes: visible actual counts and overflow must survive graphic clamping.
- Blocked, expired or archived-class people: never label them available from an empty booking list.
- Failed edits or refreshed boards: preserve drafts and expected versions; show a missing target safely.
- Narrow screens, keyboard focus and dark/high-text display: reachable navigation, forms and visible status labels.

### Task 1: Mobile console, truthful statuses and preserved commands

**Files:**
- Create: boi-ech/app/manager-status.tsx; boi-ech/app/manager-details.tsx.
- Modify: boi-ech/app/manager-workspace.tsx; boi-ech/app/manager-workspace.module.css.
- Test: boi-ech/tests/manager-mobile-console.test.mjs and existing training workspace/runtime tests.

**Interfaces:**
- Consume the unchanged TrainingBoard, TrainingPerson, TrainingResource and TrainingSession types and existing onCommand payloads.
- Produce class/person status components, merged room interval metrics, accessible detail sheets and display preferences without API changes.

- [x] Write and run failing tests for room union/clipping/cancellation, class overflow, person state precedence, accessible status bars, detail relationships and navigation/command preservation.
- [x] Implement the status components, detail sheets, mobile shell and local appearance settings; keep existing forms and signed client behavior.
- [x] Run focused tests, typecheck, lint and npm test/build; fix regressions and record exact outcomes.
- [x] Inspect the rendered phone and desktop views if an authorized browser can reach the local preview; report any unverified coverage.
- [x] Commit the candidate, perform a fresh whole-branch review and prepare a draft PR with sanitized evidence.

Outcome: source and local verification complete. Browser rendering was attempted and policy-blocked, not passed. Draft PR preparation is the final delivery step; no release approval or publish is implied.
