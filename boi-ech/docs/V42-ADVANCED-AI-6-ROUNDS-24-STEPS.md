# BOIECH_AI V42 → Advanced AI completion roadmap (Blueprint OS 1.3.0)

Created 2026-11-16; only source-authorized changes are eligible until explicit human acceptance and protected Preview. Canonical branch: `feat/manager-teacher-coaching-allocation-v42-20261116`; stacked Draft PR chain **#185 → #186 → #188**; **Production frozen**.

## Accounting and release discipline

This roadmap estimates **6 delivery rounds / 24 acceptance steps**, not 24 chat turns, commits, or calendar days. Work is complete only with verifiable output and its gate; unknown provider/permissions/approval can extend this estimate. Earlier 1,117 passing tests for V42 are baseline, not newly completed work for these 24 steps.

Legend: **[x]** verified audit/evidence; **[~]** source implemented, exact-HEAD QA pending; **[ ]** not yet completed; **[B]** blocked on independent inputs or approval.

### Round 1 — Data integrity, source truth, exact Preview validation (4 steps)
1. [x] Verify live main, V41 → V42 Draft PR dependencies, exact previous SHA/CI, reviewer status and Preview workflow protections. Read-only review confirms no independent reviewer approval or V42 Preview deployment.
2. [~] Prevent false-complete teacher video-review records at source LIMITs, expose visible warning, add regression; verify at exact new SHA with lint/typecheck/build/full tests/Constitution/paired read-only QA.
3. [ ] D1 rehearsal with two authorized managers updating the last class seat (atomic capacity guard), rollback, entitlement expiry and teacher/assistant collisions; provide reproducible evidence.
4. [B] Deploy exact dependency-reviewed V42 candidate to *isolated Cloudflare Preview Workers* with required protected Preview approval, paired Worker SHA readback, then test signed role-level functionality. Explicit `DEPLOY_PREVIEW` and `INSTALL_PREVIEW_BRIDGE` are required by current workflow; no substitution or secret extraction.

### Round 2 — Approved supplementary profiles and safe matching (4 steps)
5. [ ] Inventory actual account-first and personnel profile fields with source IDs, role-specific consent, jurisdictional data ownership, expiration/version and retention. Recorded device/class data is NOT a qualification or availability certificate.
6. [B] Approve minimal, schema-migrated fields for teachers (certification, availability, class/session limits, absence) and learners (explicit time/level preferences), plus operational pool safety constraints; pre-approve access and storage.
7. [ ] Authorize manager/teacher scoped reads and validated provenance/coverage flags; reject stale/unknown records, test denied-role and cross-class access.
8. [ ] Deterministic hard veto constraints and explainable matching score for eligible candidates, with fairness/staleness/boundary tests.

### Round 3 — Durable teacher video coaching inbox (4 steps)
9. [B] Admit video-analysis event identity/algorithm revision, purpose/retention/audit contract; media-free class-scoped per-teacher inbox migration in isolated Preview only after policy clearance.
10. [ ] Idempotent event handling by (source event ID, revision, authorized teacher); no duplicate notifications, no raw video, no speculative grades.
11. [ ] UI unread/view/review/assignment/acknowledgement plus secure polling or approved event-stream fallback; 180-second visible refresh alone is not push.
12. [ ] E2E latest and older analyses, poor video, learner class transfer, teacher reassignment, blocked/expired users, concurrent action, replay and failed sync.

### Round 4 — Manager proposal lifecycle and constrained allocation (4 steps)
13. [ ] Versioned proposal source snapshot, rationale, evidence IDs, scoped review/decline/approve status. Nothing auto applies.
14. [ ] Global capacity-aware planner covering classrooms/pools/teacher/assistant load, availability, scheduling, travel and safety; no booking claim based on local projected seats.
15. [ ] Server-side approve with expected-version CAS, idempotency and class/timetable/entitlement revalidation inside transaction; post-apply readback and compensation.
16. [ ] Multi-actor stress, batch conflict handling, exact audit trail, rollback rehearsal, accessibility and understandable rejection reasons.

### Round 5 — Controlled Knowledge Base and optional generative AI (4 steps)
17. [B] Owner-approved/versioned swim curriculum and safe exercise knowledge with accurate citations, reviewer and ACL provenance.
18. [ ] Deterministic retrieval and source-cited lesson hints, never infer clinical or safety claims from untrusted video scores.
19. [B] Optional LLM only if owner separately approves provider, remote transfer, residency/retention, budget cap and fallback. Default: provider OFF and zero spend.
20. [ ] Golden evaluation set for hallucination/privacy/class leakage, prompt-injection defenses, confidence/citation handling and human sign-off before teacher sends material.

### Round 6 — Independent acceptance, governance and release (4 steps)
21. [ ] E2E real Cloudflare Preview for learner → teacher → manager, phone/tablet/desktop sizes, contrast computed at 320/390/768/1024/1440, mobile/light/dark, responsiveness, failure injection and performance.
22. [B] Independent Reviewer A and B evidence/readbacks at exact SHA and Constitution 1.3.0; no reviewer claim without actual result.
23. [B] Human owner acceptance of approved Preview, privacy/quality/security release checklist, dependency review and exact source SHA.
24. [B] Controlled dependency-order merge (#185, #186, #188), recalculate QA on each final main SHA, explicitly authorized Cloudflare Production publish, post-deploy readback and rollback evidence. No Vercel.

## Current source checkpoint (after ongoing Round 1 work)
- Previously verified V42 baseline SHA: `71d5e590afd330e02c0707cc86c2812019127653`, 1117/1117 automated tests passed; no Preview V42 deployment.
- Newly added teacher result coverage guard computes `possiblyTruncated` from 200 learner / 3000 assessment / 12000 event / 200 reply / 1500 assignment query caps. A visible dashboard message discloses uncertainty rather than stating historical review completeness. **This source update is not labeled PASS until the latest commit runs exact QA.**
- Source inventory checked: `app/device-auth.server.ts`, `app/account-core.server.ts`, `app/account-runtime.server.ts`, `app/training-types.ts`, `app/training-management.server.ts`, `app/training-schema.ts`; no verified specialization or time-availability fields in inspected manager snapshot. Do not claim exhaustive external profile discovery.
- Existing Preview workflow `.github/workflows/deploy-boi-ech-preview.yml` requires **two exact confirmations**, protected environment `boi-ech-preview`, isolated D1/Worker identity checks and pinned Application Management source. No Preview dispatch or Production modification occurred in this round.

**Next Action:** complete exact SHA source QA for Round 1 Step 2; then obtain D1 concurrency evidence and authorized isolated Preview gate. Work on Round 2 source inventory may proceed concurrently without writing new personal data.
