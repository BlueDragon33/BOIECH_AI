# Account-first FREE Preview Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the unnecessary R2 subscription dependency from Account-first Preview while preserving isolated D1, Owner authentication and human release gates.

**Architecture:** The payment-proof routes already fail closed with `PAYMENT_STORAGE_UNAVAILABLE` when BUCKET is absent. The Account-first Preview will intentionally omit R2; preparation and generated-artifact guards must reject an injected R2 binding. Existing Production configuration and payment behavior stay outside this change.

**Tech Stack:** Node 22.13, Wrangler, vinext, TypeScript, Node test runner.

**Spec:** Issue #108 comment 6725185598; Owner requests FREE, preserved data and expedited release on 2026-11-08. This source change removes one prerequisite only; it does not grant remote acceptance or release approval.

## Global Constraints

- Keep the existing `boi-ech-preview` Worker. The Owner's 2026-11-08 instruction additionally permits the backed-up, detached `bauman-control-preview-db` UUID `4094a621-3b81-4533-9694-4a2103e03363`, with a separate `boi_ech_preview_migrations` ledger.
- Never reuse Production D1 or App Preview D1; do not weaken identity, origin, manual dispatch or reviewer gates.
- No subscription activation or Production deployment. Latest Owner instruction authorizes an expedited manual Preview stack deployment; the protected approval remains mandatory.
- Payment-proof upload/read and full payment acceptance remain explicitly unavailable without R2.

## Review Focus

- A stale template must not silently add an R2 dependency.
- A generated config with R2 under any binding name must be rejected.
- A generated config referencing Production D1 must still fail.
- Missing origins/Owner secrets must still fail closed.
- A successful artifact check must not be described as real cloud acceptance.

## Task 1: FREE Preview packaging and guards

**Files:** `boi-ech/wrangler.cloudflare.preview.example.jsonc`, `boi-ech/scripts/prepare-cloudflare-preview.mjs`, `boi-ech/scripts/validate-cloudflare-preview.mjs`, `boi-ech/scripts/validate-cloudflare-build-artifact.mjs`, `boi-ech/tests/cloudflare-preview-free-storage.test.mjs`.

- [x] Write tests that run the real prepare/artifact scripts: no-R2 config succeeds, R2 injection fails under any binding name, Production D1 still fails.
- [x] Observe the tests fail against HEAD #110.
- [x] Remove R2 from the Account-first template; reject R2 in preparation, scaffold validation and artifact verification. Keep all existing D1/origin/secret guards.
- [x] Run focused tests and existing Preview preflight/release tests.

## Task 2: Verification and operational handoff

**Files:** `boi-ech/docs/CLOUDFLARE_PREVIEW.md`, evidence checkpoint.

- [x] Document Account-first scope, absent payment storage and remaining full-payment gate; correct stale deployment ordering and required secrets.
- [x] Run Node22 full test/build, TypeScript, lint and Preview/release gates. Check a real generated FREE Preview artifact locally; do not claim remote deployment.
- [x] Preserve exact source/evidence in an isolated branch with hosted CI skipped; do not dispatch or enable a dormant workflow.

## Separate authorized cleanup

Owner clarified that invalid old accounts means Bơi Ếch users, not Cloudflare databases. Inspect account/device table metadata and aggregate counts only first. Do not infer invalidity from age, missing login or legacy schema; do not delete learning records or a shared D1. Produce concrete candidates before destructive action.

## Task 3: Explicit FREE resource reuse and one Preview stack deployment

- [x] Allow only dedicated Preview or the exact approved retired name/UUID; use an independent migration ledger and reject other app/Production names.
- [x] Disable retired Worker URLs (earlier step), detach its D1 binding, preserve its code, encrypted secret and all original database rows.
- [x] Test actual backup overlaid with all 26 Boi SQL migrations locally: 10 original tables / 6 rows unchanged, integrity and foreign keys valid.
- [x] Add read-only provider preflight: exact account, retired URLs disabled, no retired binding, exact Preview D1 identities, existing App access/vault secret names present.
- [x] Package both Preview Workers in one manual protected workflow, pin App source to 070fc3f156052384fffdd6ef1c5da5420f9a56c3, build/verify both before SQL writes, retain App access/vault secrets, create one random bridge key only for the exact two Preview Workers.
- [x] Full Node22 suites: Boi 631/631, App 865/865; fresh final code review found no Critical/Important issues. Both generated artifacts are checked locally and again before remote writes.
- [ ] Push reviewed source, configure non-secret identity metadata, queue the manual protected workflow. Obtain action-time approval for the new D1/Owner bridge access before releasing its environment gate.
- [ ] Deploy and verify real runtime revisions / D1 / protected App boundary. Full Owner/MFA/CAS/account-duration/3-device business acceptance remains a separate gate before Production.

Ruling: Replace the dedicated-name-only constraint with the Owner's explicit temporary reuse authorization; this avoids deletion and paid upgrades. Risk if wrong: restoring Bauman Preview requires restoring its original binding/URLs, and Boi tables must first be retained separately.

Ruling: Use one manual stack workflow instead of enabling the dormant App repository workflow. The Owner explicitly requests mandatory deployment; exact pinned source and one protected approval make the two-Preview change reviewable. Risk if wrong: a partial provider failure can leave different Preview revisions; the workflow fails and neither business acceptance nor Production release is inferred.
