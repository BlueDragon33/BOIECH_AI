# Account-first FREE Preview Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the unnecessary R2 subscription dependency from Account-first Preview while preserving isolated D1, Owner authentication and human release gates.

**Architecture:** The payment-proof routes already fail closed with `PAYMENT_STORAGE_UNAVAILABLE` when BUCKET is absent. The Account-first Preview will intentionally omit R2; preparation and generated-artifact guards must reject an injected R2 binding. Existing Production configuration and payment behavior stay outside this change.

**Tech Stack:** Node 22.13, Wrangler, vinext, TypeScript, Node test runner.

**Spec:** Issue #108 comment 6725185598; Owner requests FREE, preserved data and expedited release on 2026-11-08. This source change removes one prerequisite only; it does not grant remote acceptance or release approval.

## Global Constraints

- Keep the existing `boi-ech-preview` Worker and dedicated `boi-ech-preview-db` requirement.
- Never reuse Production D1 or App Preview D1; do not weaken identity, origin, manual dispatch or reviewer gates.
- No subscription activation, remote mutation, merge or Production deployment in this patch.
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
