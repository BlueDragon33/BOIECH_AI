# Bơi Ếch — manager operations recovery checkpoint

Date: 2026-11-06. This is a documentation-only checkpoint on the original account candidate. It does NOT contain the interrupted implementation and is NOT a release candidate.

## Requested work

1. Manager review of learner and teacher registrations.
2. Accessible, server-verified course-completion certificates.
3. Reversible addition/removal of class personnel, preserving records and other assignments.
4. Separation of App-Manager control from learner/teacher processing.

## Source state before interruption

The implementation was made in new local branches. It had NOT been pushed when the execution environment became unavailable. Do not assume these new local objects are available from GitHub.

| Repository | Tested local source HEAD | Tested tree | Original remote base |
| --- | --- | --- | --- |
| BOIECH_AI | b701a5b13df588c073011b8c0d36ed09197f872e | 75a9c8018ff1ca199a2c910df3641429156839a9 | 8c2b4710cb4c2802affe7d433ab0450d030a944a |
| Application-Management | c4fe1b8b734ab030d2e4c5745883ff6314e940ec | a6156551fc1c0be12771cb92b96bf7c450bdecd1 | da5d3049bc39f85410d6762c19be894991720e69 |

BOI local branch: fix/manager-operations-completion-20261106.
App-Manager local branch: fix/boi-manager-only-control-20261106.

The BOI branch reused the existing account/review service and carried the reviewed mobile console from PR #107 (8dca369bd3352e0e1c18c39ef3d365fbaeee156c), then connected approval navigation, class personnel controls, certificate delivery and central read restrictions. It did not replace either original candidate ref.

## Evidence scope

Completed before the fresh technical review:

- BOI full local npm test/build: 622/622; TypeScript exit 0; full lint 0 errors / 5 pre-existing warnings.
- App-Manager full local npm test/type/build: 821/821; changed-file lint exit 0.
- Full App-Manager lint remained FAIL: 23 pre-existing errors / 81 warnings. All 12 error files were verified byte-identical to the deployed hotfix base.
- These are local source checks, not live/rendered product acceptance or release approval.

The bounded fresh technical review found five Important integration/security issues and one modal validation issue. A consolidated regression/fix pass was started. That pass did NOT finish and has NOT been verified. Keep the review gate BLOCKED; do not call the findings fixed merely because the pre-review suites were green.

## Interrupted local work

Before editing again, recover the two checkouts and inspect their working trees and the existing ledger. Do not reset or overwrite recovered work.

Plan: docs/superpowers/plans/2026-11-06-manager-operations-completion.md.
Ledger: .superpowers/sdd/2026-11-06-manager-operations-completion/progress.md.

Partial uncommitted work included additional regression tests, a certificate actor-fingerprint/request-generation helper, strictly subtractive personnel assignment handling, and error forwarding to the personnel sheet. These partial changes are UNVERIFIED. Their presence and exact bytes must be checked in the recovered workspace.

Resume the same review-fix pass, including real paired-contract validation, then run the tests warranted by the changed source, record exact source/tree pins, prepare draft review branches/PRs and private detailed evidence. Never silently discard the confirmed review findings or rerun unchanged passing checks as a substitute for finishing them.

## Execution gate and preserved state

The required execution environment became unavailable. No new Cloudflare credential was requested or created. Re-establish the authorized execution environment before further source recovery, changes or tests. If it is still unavailable, stop at that gate; do not build alternate infrastructure or dispatch deployment/migration workflows as QA.

Production, existing data and the already verified coordination grant were not changed. No account-first deployment, migration/restore, flag activation, merge, self-approval or ratification occurred.

Original account-first candidates remain 8c2b4710cb4c2802affe7d433ab0450d030a944a and 49a3f85fc42e564460732110974fd951ad8d117e. Flag OFF; REVIEW BLOCKED; CI PENDING; global D1 10/10 BLOCKED. Real backup/restore and browser/target-runtime acceptance remain unverified. ZERO-SPEND; GitHub Actions are authorized, but no deploy/migration workflow is authorized to substitute for QA.

Detailed review evidence belongs in the private project record; this checkpoint contains source/recovery status only.
