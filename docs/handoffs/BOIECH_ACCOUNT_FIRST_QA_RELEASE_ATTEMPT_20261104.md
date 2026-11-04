# Account-first P0 — independent engineering QA and publication attempt

Latest offline rehearsal follow-up: [snapshot CLI preservation correction and new evidence](BOIECH_ACCOUNT_FIRST_SNAPSHOT_CLI_REPAIR_20261104.md). Application/DDL/config bytes remain unchanged; release acceptance is still blocked.

Blueprint OS 1.3.0. **REVIEW BLOCKED; CI PENDING; global D1 10/10 BLOCKED; default account flag OFF.** The latest Owner request asks to complete publication. Publication intent does not attest unfinished QA or confer independent reviewer approval.

Initial exact pair: BOIECH `276c296929d2a6d8ce8e417b3bb6f0ab2f355137`, Central `b50878d2878bf51444d033064ce9d9cb4e56a3e0`. Both heads were re-read unchanged from GitHub before corrections. Their prior source-only local results were not treated as release acceptance.

## Findings, corrections and actual checks

Independent read-only engineering review reproduced two Important blockers using the actual owning HTTP handlers, service/auth/runtime and all 21 SQL migrations on isolated SQLite with synthetic cookies/origin/platform bindings:

1. An approved teacher could use the legacy roster route to approve a pending account when the shared quota already held 50 learners. The result was 51 approved accounts, no new manager assignment, unlimited expiry and no account approval audit. Account mode now rejects both teacher approval/removal before mutation. Same-class roster reads remain available, returning `canManage=false`; the real roster panel renders manager instructions instead of approval/removal/restore controls. OFF mode retains the legacy contract.
2. Pre-proof challenges returned full device/profile data, including phone/payment notes. Both account and legacy HTTP endpoints now receive only challenge/expiry in account mode; blocked-target errors also omit the profile. The original challenge signature/proof path remains intact. The change does not replace the authenticated, audited broad-read endpoint.

Production-stack regression tests failed before the corrections and pass after them. They retain quota 50, assert no forbidden state changes, verify both endpoints/status variants, and positively check the OFF contract. Actual React roster rendering is tested under SSR for both modes. These are synthetic/local tests, not live D1 or browser admission.

The required Preview validator also failed: the manual workflow lacked `DEPLOY_PREVIEW` and generated artifact verification. Both guards were restored; the artifact check runs before deployment. A positive gate test and guard-removal negatives pass. No hosted workflow was run.

| Fresh local check | Observed result |
|---|---|
| Complete BOIECH `npm test` | Exit 0; verified build and 574/574 Node; zero skipped/cancelled |
| Typecheck without incremental cache | Exit 0 |
| Full lint | Exit 0; 0 errors / 5 warnings |
| Changed-file lint | Exit 0; 0 errors / 1 pre-existing warning |
| Release validator | Exit 0 |
| Cloudflare Preview validator | Exit 0 |

A source-pattern idempotency test was updated only for the roster helper's new explicit `canManage` argument; its original no-op guard-before-write/audit assertions remain. The two security findings are implementer-verified corrections. The automated reviewer's follow-up was blocked by its tool with a cybersecurity-content flag; it did not re-accept the corrected source. No human Reviewer A/B approval is claimed.

## Why publication did not proceed

The managed browser-QA daemon failed its health deadline and returned no usable preview URL. Subsequent status was stopped. No alternate browser/server path or infrastructure bypass was used. Actual Chrome/Safari/iPhone, account-switch/storage/payment scenarios remain unverified.

Current session checks found no Cloudflare API token/account ID or Preview/Production D1 guard configuration. This says nothing about GitHub Secrets, which were not inspected. The repository's canonical production route is managed Cloudflare with protected manual release checks. Hosted Actions remain prohibited by the Owner's ZERO-SPEND constraint. The old ChatGPT Sites and their slugs were identified read-only; neither their database nor publication route was substituted for canonical Cloudflare production.

The target workerd 2026-08-26/CPU budget, real authorized legacy snapshot, isolated D1 readback/rollback and independent acceptance remain outstanding. Publishing this account migration or enabling its flag would bypass those gates. No deploy, merge, approval, ratification or production-data change occurred.

[Exact logs and limitations](../evidence/account-first-independent-qa-20261104/verification.json) · [Changed-file digests](../evidence/account-first-independent-qa-20261104/changed-files.json). The containing commit is the corrected source/evidence anchor; earlier pair acceptance cannot be carried onto it automatically.

**One next action:** restore the authorized Cloudflare QA/reviewer path for acceptance of the corrected source, including browser access, isolated D1 and target-runtime evidence, before production publication. **Fallback:** retain candidate branches and flag OFF; preserve the existing deployment and data.
