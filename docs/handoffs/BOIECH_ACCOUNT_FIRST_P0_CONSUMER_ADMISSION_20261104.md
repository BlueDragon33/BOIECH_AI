# Account-first P0 — consumer source admission follow-up

Latest QA follow-up: [independent findings, corrected source and publication blockers](BOIECH_ACCOUNT_FIRST_QA_RELEASE_ATTEMPT_20261104.md). The earlier source pins/results below are historical; they are not acceptance of the corrected source.
Blueprint OS 1.3.0. **SOURCE ONLY; REVIEW BLOCKED; CI PENDING; global D1 10/10 BLOCKED.** `BOI_ECH_ACCOUNT_FIRST` default OFF. No Actions, PR event, merge/rebase, approval, ratification, deploy or Production access.

## Exact source pair

- BOIECH application implementation: `fbf70057a232e3c1f6115311afc0385e80e6dbb6`, branch `candidate/account-first-p0-20261104`. The containing follow-up commit changes handoff/evidence documents only; every `boi-ech/` application byte remains identical. Existing 567/567 Node, type/build/lint and synthetic migration-rehearsal evidence stays tied to that implementation, without a needless rerun.
- Central implementation: [`b50878d2878bf51444d033064ce9d9cb4e56a3e0`](https://github.com/BlueDragon33/Application-Management/commit/b50878d2878bf51444d033064ce9d9cb4e56a3e0), branch `candidate/boi-account-permissions-p0-20261104`, tree `c29a9468681bccfc218f7210da43c4ea7c5cc953`. Expected-SHA update from `3cf2f7d703d762f38dcfdcbbf9ac90acf3c39bf0`, followed by exact HEAD/tree/evidence readback. Source-branch workflow count was 0.

## Changes and real local verification

The 14 Central failures were stale source-pattern assertions against the current manager-only boundary, Local/Online/Hybrid rules, independent GET readback, draft state and promise cleanup. Expectations were corrected without reinstating old broad authority or unverified cached writes. These are not reported as 14 reproduced runtime bug fixes.

The actual missing inline Authenticator code was selectively recovered from main `f347bd0ccd5e7f7e4e4bca4a31168e1219c18370`, retaining stricter freshness/configuration checks. Only explicit step-up requests permit one retry of the original command. Incorrect/expired codes, pending enrollment, cross-origin requests, cancellation and navigation are covered. Privileged account and manager mutations are covered by actual production-gate tests. Existing account-page HTML fallback remains functional.

Owned lint failures were repaired with state-based render bookkeeping and cancellable initialization/cleanup. Independent source engineering review reproduced two Important regressions (font persistence before hydration and late MFA callback after unmount); both were fixed with red/green behavioral tests, then independently rechecked 3/3. No remaining actionable Critical/Important finding was identified in the inspected changes. This does not constitute Reviewer A/B authority acceptance.

| Check | Observed result |
|---|---|
| Complete Central `npm test` | Exit 0; typecheck, verified build, 832/832 Node |
| Final full Node after additional production gate test | Exit 0; 833/833; 0 skipped/cancelled |
| Full lint | Exit 0; 0 errors / 38 warnings |
| Two-repository source integration | Exit 0; all 21 SQL migrations; real issuer, signature verification, owning route/service, consumer contract and SQL |
| Owner dialog interactions | Actual React under JSDOM: valid code resumes same revision command once; wrong code/cancel do not apply it |

The source integration proves signed Owner acceptance and Publisher denial, CAS conflict rejection, independent read-command-read, separate broad-read permission, per-target access audit/redaction and immediate revoke. It also approves a learner once, logs in through another device key and observes one shared quota slot. Platform bindings, runtime identity responses and HTTP transport are synthetic; persistence is local SQLite. No live D1 or real-browser PASS is claimed.

[Immutable Central evidence and limitations](https://github.com/BlueDragon33/Application-Management/blob/b50878d2878bf51444d033064ce9d9cb4e56a3e0/docs/evidence/account-first-consumer-repair-20261104/verification.json) · [Changed files and SHA-256 digests](https://github.com/BlueDragon33/Application-Management/blob/b50878d2878bf51444d033064ce9d9cb4e56a3e0/docs/evidence/account-first-consumer-repair-20261104/changed-files.json) · [Detailed reviewer handoff](https://github.com/BlueDragon33/Application-Management/blob/b50878d2878bf51444d033064ce9d9cb4e56a3e0/docs/handoffs/BOIECH_ACCOUNT_PERMISSIONS_P0_REVIEWER_20261104.md).

## Remaining mandatory gates

Real Chrome/Safari/iPhone and delayed account-switch/browser-storage scenarios remain NOT_RUN; installed browser binaries are absent. Target compatibility date 2026-08-26 and CPU-budget admission remain unverified (installed workerd supports 2026-05-22). A real authorized legacy snapshot, live owning D1 independent readback/rollback and independent human acceptance are still required. The current task forbids deployment/Production and cannot substitute local fixtures for those admissions.

**One next action:** independent reviewers evaluate this exact source pair and evidence in an authorized isolated environment for the remaining acceptance gates. **Fallback:** preserve both source candidates and leave the account flag OFF; do not use Production or hosted Actions to bypass the gate.
