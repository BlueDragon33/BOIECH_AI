# V42–V47 RECONCILIATION LEDGER — Bơi Ếch AI

**Date:** 2026-11-19. **Baseline:** Production read-only reaccepted Bơi Ếch Worker revision `bba6f04adec15eccf9993b0c164cd8e278b18f07`; current source main `461ab42d71f7f157880bd4aa83676b249ca7b3d0`. Both are real, different references, because PR #201 only changed verification scripts. Cloudflare-only, ZERO-SPEND.

## Delivery DAG and release slices
1. **V42-A / Manager allocation — THIS BRANCH.** Main-based, deterministic manager-side read-only teacher/learner shortlist, existing signed human assignment review, cap/expired teacher filtering and V46 fresh snapshot checks before opening form. No schema, new endpoint, LLM, paid service, or account mode change. Does not apply allocation automatically. Run exact-SHA Node/TS/lint/build, constitution, paired read-only QA; then protected Preview and role UX before release. Do NOT call a stale snapshot PASS.
2. **V42-B / Teacher video coaching.** Extract media-free, permission-scoped source summaries from old Draft #188. Confirm accurate severity and no fabricated score; student identity and right-to-view must stay server signed; teacher exercises require explicit confirmation. Independent main-based PR.
3. **V43 / Durable teacher video inbox + knowledge retrieval.** Old Draft #191 has migrations and new API routes. Must separate schema migration rehearsals, idempotency, consent, retention, role isolation, failed/replayed events and actual Cloudflare Preview D1 before touching Production. Do not merge from old stacked base.
4. **V44 / Consent & human-approval proposal lifecycle.** Preserve old #193 live consent CAS and #196 disabled admission deny. A manager proposal is NEVER an API apply without signed role, current consent, latest snapshot, atomic capacity and receipt checks. Independent fault-injected E2E needed.
5. **V45 / Video quality.** Use comparable same-lesson/view/engine, preserve unknown/null rather than numeric zero, reviewed test clips for F1/abstention/boundary errors. No unsupported precision claim.
6. **V46 / Snapshot & ZERO-SPEND.** Reject stale/partial/future/invalid source before any proposed action; provider adapter off unless explicit separate paid-mode consent. In this V42 slice only the pure read-only snapshot function is imported.
7. **V47 / Evidence integrity.** Read-only V47 negative-evidence fixes were already cherry-picked safely into V41 production #199; old Draft #200 stays open but cannot be called unreleased functionality entirely. Reconcile duplicate code and avoid republishing stale versions.

## Gate truth
- Main V41 published and independently read-back on Cloudflare. Latest main CI and production verification previously PASS.
- Legacy stacked Draft PRs #185/#186/#188/#191/#193/#196/#197/#198/#200 are **NOT** a releasable dependency chain after main advanced. New PRs must start from current main.
- Reviewer A/B remain independent NOT_RUN unless actually executed; Owner waiver is recorded but not a reviewer PASS.
- Signed role Preview, remote D1 fault/concurrency, end-user/mobile UX, exact SHA and Owner-controlled protected Cloudflare production are required for protected/high-impact workflows. No automatic publish of drafts.
- No unverified data, no cost, no new site/slug, no Vercel.

## Completion semantics
Code implemented != exact-SHA CI PASS != protected Preview passed != Production deployed != signed-role acceptance. The ledger must carry all independently and identify the *actual* SHA and evidence URL.

**Active next action:** finish V42-A source QA. If PASS, protected Preview only after Owner release check, then proceed to V42-B. Do not auto-apply any assignment.
