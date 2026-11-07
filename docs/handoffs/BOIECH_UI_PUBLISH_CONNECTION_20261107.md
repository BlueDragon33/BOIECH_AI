# Bơi ếch UI publication checkpoint — 2026-11-07

**Updated 2026-11-07:** the Owner approved both credential drafts and reinforced **free-only**. Both keys are now active with the approved scopes and 30-day expiry. The App-Management candidate `b2e36758d8dab5c953e71b3aa1f36490b55d770f` is active on its existing isolated HTTPS Preview, independently verified after a post-upload CLI metadata-read failure. Bơi ếch manager acceptance and Production release remain **BLOCKED**.

Current proof and remaining blockers: [free-tier Preview checkpoint](../evidence/premium-manager-20261107-free-preview/README.md). It supersedes the credential/deployment status in the historical checkpoint below. No Production, schema, role, billing, or hosted Actions changes occurred.

**Current Next Action:** prepare the approved free isolated Bơi Preview resources and real authorized identities, then finish signed desktop/mobile acceptance before presenting the exact-SHA Production release.

## Historical checkpoint before the latest approval

## Candidate identity

- Verified Bơi ếch code/evidence baseline: `385893b86d2586712f974153ca84e999c4e515ce` on `feat/manager-premium-command-center-20261106`.
- Executable application/test subtree remains `4b28907e8c901e6dc72c232dabcff1ad8b35fb3f`. This handoff changes documentation only.
- App-Management UI candidate: `b2e36758d8dab5c953e71b3aa1f36490b55d770f`, branch `feat/boiech-preview-ui-lifecycle-20261106` in the existing `BlueDragon33/Application-Management` repository. Its executable subtree is `c8e702ad4fd1faf06e8caf853dc6ce8b4cac7b3d`.
- Full evidence: [App-Management publication checkpoint](https://github.com/BlueDragon33/Application-Management/blob/b2e36758d8dab5c953e71b3aa1f36490b55d770f/docs/evidence/boiech-preview-ui-20261107/README.md).

Owner clarified **30 days for both Cloudflare token and manager access**, with subsequent adjustment in Application Management UI, and explicitly requested continuing the update and publishing because the latest UI was not visible. Publication intent is recorded; there is no claim that a source commit updated the website.

## Completed within authority

- Added authenticated, Owner-only Cloudflare Preview connection/lifetime/revocation UI to App-Management. Existing manager date/grant controls are reused; manager is not admin. The new page is source-only until deployment.
- Fixed both Important independent-review findings (uncertain writes and encrypted-vault recovery) with failing/passing regressions. Additional independent reviews of lint/storage and Preview workflow repairs found no material findings.
- Final guarded **Node 22.16.0** verification: Bơi ếch **564/564** complete tests; App-Management **848/848** including TypeScript/build. Bơi typecheck, lint, Preview source validator, release audit and local artifact checks all exit 0 (3 existing lint warnings). App-Management lint exits 0 with 25 existing warnings; source Preview validator and local artifact checks exit 0. See the linked evidence, raw compressed logs and hash manifest.
- Created the already approved `boiech-preview-work-20261106` token for **only `boi-ech-preview`**, **Individual Workers Editor**, expiration **2026-12-07 23:59:59 Moscow**. Its one-time value is protected in task runtime storage and is not in source, reports or screenshots.
- Real Cloudflare API verification: token **200 / active**, Preview Worker settings **200**, Production `boi-ech` settings **403**. This clears the earlier missing Preview API-authentication item while retaining Production isolation.

## Actual remaining blockers

1. Bơi Preview is still the separate Hello World bootstrap at `https://boi-ech-preview.boiech-ai.workers.dev`; candidate application source and isolated bindings have not been deployed there. No real signed manager acceptance is claimed.
2. Isolated Bơi D1 creation hit the **10/10 database quota**. No existing DB was deleted, borrowed or changed. R2 activation requires a usage-billed subscription and terms acceptance; it remains inactive under ZERO-SPEND. Credentials do not remove these blockers.
3. The approved Preview-only key cannot publish the other Workers. Two new **uncreated** 30-day token drafts are prepared for direct confirmation: a publication Editor for exactly `application-management`, `application-management-preview`, `boi-ech`, `boi-ech-preview`; and a separate **Account API Tokens Write** credential for in-app lifetime/revocation management. The latter is account-level authority at Cloudflare; App-Management restricts its use to the exact Bơi Preview token. Both expire on 2026-12-07 at 23:59:59 Moscow.
4. Actual generated Cloudflare artifacts, signed desktop/mobile manager/role flows, and the final release gate must still be checked after authorized deployment configuration. Local fixture tests, source validators and a Hello World URL are not that acceptance.

No hosted Actions, PR creation, paid activation, schema/authorization-policy changes, manager grant/date writes, Production publication or merge occurred. Existing application slugs and repositories are preserved. The same application-source trees were verified after the Node 22 cache fallback was detected and corrected; earlier unguarded runtime labels are not used as final evidence.

## Historical Next Action — now completed

Confirm the two new 30-day publication/lifecycle credentials prepared on Cloudflare's final review pages, so the authorized deployment connection can proceed. This is new write access beyond the existing Preview-only key, not a repeat request for its approval; it does not waive ZERO-SPEND, remaining D1/R2 blockers or release gates.
