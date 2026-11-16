# Manager AI V41 — implementation ledger and P0 vertical slice

Repository: \`BlueDragon33/BOIECH_AI\` · Owner-approved scope: manager-side AI command center, eventual 8 domains / 30 capabilities · Constitution: **Blueprint OS 1.3.0**.

## 1. Purpose and ownership

Cán bộ quản lý needs evidence-based early detection, clear explanations, realistic alternatives and a **human approval boundary**. This is **one module inside the existing manager app and Cloudflare Workers/D1**, not a new deployment or a parallel control plane. Application-Management continues to own account/control policy; BOIECH_AI owns the training data and authorized reads/writes.

**P0 first implementation** is deliberately a source-backed, fully deterministic analysis engine. Its disclosure reads **“chưa kết nối mô hình AI tạo sinh”**. It is NOT described as LLM, deep learning, predictive ML, realtime autonomous agent, or full 30-capability completion.

## 2. Data and trust boundary

Input: the authenticated manager \`TrainingBoard\` already returned by \`/api/training-management\` after existing signed proof and account permission checks. No new data endpoint, new credential, cross-app scope, paid API, external browser traffic or persistent AI store.

The engine sees \`resources\`, \`people\`, \`sessions\`, \`teacherClassTerms\`, the verified observation timestamp and the selected time window. It may make read-only observations about the authorized dataset; it does not mutate the input, issue fetch calls, log private content, or claim an unknown capability is configured.

Output findings contain stable source record IDs, exact field names, snapshot timestamp, priority, an actionable recommendation, limitations and the target manager subsystem. These references are evidence, not citations to secret logs or authority to alter data. The UI never includes private tokens, DOB, medical information, raw video or passwords. Candidates are not called qualified without proof of competency.

Hard safety invariants:
- Only current valid teacher account status can be considered an *account-eligible* candidate. Subject expertise, actual shift/availability and credentials remain unverified.
- “Không có cảnh báo” is not “không có rủi ro”.
- Scheduled-session overlap is a bounded detection of **examples**; do not claim exhaustive conflict count.
- A \`plannedEndAt\` past due is not automatic termination. Unknown date remains unknown.
- Simulation estimates **class allocation load only**; never promises a clash-free schedule without a proposed time.
- No automatic staff transfers, timetable changes, user status changes, reply sends or suggested-message sends.

## 3. Shipped-on-branch P0 vertical slice

| Component | Actual implementation | Scope |
| --- | --- | --- |
| Entry | AI Điều hành in desktop rail, visible header shortcut, manager overview AI insight entry | Existing app only; five-item mobile dock unchanged |
| Risk engine | Over-capacity classes, understaffed classes, eligible-but-unassigned teachers, invalid schedule references, overlapping sessions, overdue class-term review | Exact current board |
| Explanations | Evidence fields and timestamps + limitations + priority + next action | Bounded to source |
| Guided Q&A | Supported Vietnamese intent matching over **computed findings** and citations | Does not infer unknown facts; no generative model |
| What-if | Choose an active class + active account-eligible teacher and compare current/projected allocation load | Read-only; cannot approve or commit |
| Context | Compact analysis cues in Nhân sự, Lớp học, Lịch dạy and Phòng học | Navigation only |
| UI | Responsive desktop/tablet/mobile, visible focus and reduced motion | Content-first; no fabricated cards |

## 4. Roadmap, decisions and truthful statuses

### V41.0-P0 — first usable vertical slice (this PR)
Risk/evidence computation for personnel, class capacity, basic scheduling and data quality; guided questions and read-only workload simulation. Acceptance: exact SHA lint/typecheck/unit and regression, Constitution, paired read-only QA, then real manager Cloudflare Preview session + accessibility check. **Do not merge/publish automatically.**

### V41.0-P1 — operational evidence expansion (future, NOT in this PR)
Batch conflict grouping and accurate exhaustive conflict counts, skills/certifications and actual assignment eligibility, room capacity and travel constraints, change-proposal persistence and explicit Owner-controlled approvals. No new table or entitlement in P0.

### V41.1 — teacher/learner messaging and training quality (future)
Bounded aggregates of learner progress, video evaluation provenance and permissioned request inbox. Privacy scope review required; no raw conversation/video transferred to a model without explicit approval.

### V41.2 — Decision Simulator (future)
Compare multiple class/teacher/room/time alternatives; enforce scheduling hard constraints and show a conflict matrix; immutable review drafts, human approval and rollback validation via existing signed manager operations.

### V41.3 — Forecasting / Knowledge Base / continuously measured quality (future)
Approved source corpus with citations, model evaluation against deterministic baselines, optional generation provider adapter with explicit budget/token/retention rules, AI adoption/overrides metrics and outcome validation. If no approved provider, keep **rules-only** visible; no false “AI reasoning model enabled”.

## 5. Constitution 1.3.0 gates and evidence

1. Architecture/change inventory: single repo, existing API, \`manager-ai-evidence-v41.ts\` (pure logic) and \`manager-ai-workspace-v41.tsx\` (render-only). No new server authority.
2. Static/unit: typed \`TrainingBoard\` and stable identities; no client mutation, network, model billing, fake data or expanded scope.
3. Security: verified manager role remains enforced before \`TrainingBoard\` can be read; no raw PII used for model prompts; no online status invented.
4. UX: 320/390/768/1024/1440 layouts, WCAG AA computed foreground/background states, keyboard focus, light/dark contrast, assistive labels.
5. Source gate: exact-head Validation CI, Constitution, paired read-only QA. Fix actual failures; do not relax thresholds.
6. Runtime gate: Cloudflare Preview deployment on isolated existing Workers, confirm both Worker revisions and D1 isolation, open a real authorized manager account, test evidence and navigation vs actual training data.
7. Human review and release: keep Draft until QA evidence and Owner explicit approval for merge; Production requires a separate exact-SHA deployment workflow and revision readback.

## 6. Measurement

P0 quality metrics: valid evidence reference coverage (target 100% of findings), exact same snapshot deterministic output, unverified-generative-answer count (target zero), absent source ⇒ explicit uncertainty, unauthorized mutations (target zero), stale/invalid snapshots flagged for review, no regression in account authorization. Track false positives/false negatives from manager review in later approved stages. Never fake PASS, coverage or usage.


---

## 7. Follow-on implementation on stacked branch (V41.0-P1 / V41.1 / V41.2 / V41.3)

**Status: source code candidate only.** Built on the exact P0 PR #185 SHA \`fdb74ad2df5eb4b314aa40724df3d66f631b0091\`. Not a merge or Production deployment.

| Stage | Actual new feature | Explicit non-feature / missing proof |
| --- | --- | --- |
| V41.0-P1 | Count **all conflicting pairs** within the authorized loaded scheduling window; correctly detect any teacher/assistant, class or room intersection; show source-cap warning when near 1,000 records. Candidate teacher review sorted by account status, existing class workload and observed time conflicts | No credential/competency assessment, no official availability, no complete system-wide claim outside window |
| V41.1 | Bounded management-only **learner account and session-quality aggregates**: active roster, unassigned/unmatched classes, session status and invalid intervals | No learner video or raw chat, no individual technique score, actual attendance, or personalized risk without a permissioned source |
| V41.2 | Read-only **existing-session time/room alternatives**. Compare overlaps against room, class and both teacher roles; reject time outside observed board, inactive rooms and cancelled sessions; flag capacity uncertainty | No automatic rebooking, no persisted proposal, no button that calls a privileged mutation API, no claimed total safety approval |
| V41.3 | Explicit **evidence structural audit**: referenced source IDs + timestamps, missing/duplicate findings, display/source truncation, quality gating | Not an accuracy metric, no LLM, no accepted internal knowledge base or paid model provider; no inferred FP/FN without human labels |

### Further stages intentionally NOT enabled

- **Real technique / video analytics for manager:** blocked pending a separately reviewed, least-privilege aggregate endpoint and provenance metadata; instructor/learner content must not be reused merely because it exists elsewhere.
- **Message intelligence:** blocked pending explicit policy, privacy review, necessity and manager scope; no broad inbox read.
- **Automatic staffing/timetable decisions:** blocked pending authenticated server-side CAS transaction, independent policy review, human decision record and rollback evidence.
- **Forecasting/ML or generic AI conversation:** blocked pending approved model, retained evaluation set, budget/timeouts, consent and sensitive-data controls.
- **Internal Knowledge Base:** blocked pending a verified allowlist of approved versioned documents with access metadata; no synthesized regulations.
- **Review feedback telemetry:** in this source candidate only deterministic structural completeness is measured. No false compliance, no invented adoption or outcome success.

### Source & live runtime acceptance

1. Exact stacked PR HEAD tests for all-pairs overlaps, cancelled sessions, assistant/teacher, active/inactive accounts, long/empty windows, unauthorized operations, readonly what-if, source identifiers and traceable uncertainty.
2. Source CI (lint, TypeScript, full regression, Constitution, Paired read-only QA) **must PASS on exact HEAD**; do not use inherited P0 PASS as substitute.
3. Same-worker Cloudflare Preview with branch HEAD, login as authorized manager and deny non-manager; responsive 320/390/768/1024/1440, light/dark computed contrast, keyboard controls.
4. Test manually against a known live schedule: verify counts and "within loaded window" disclaimer; never present a "safe/free" result as booking approval.
5. Remain **stacked Draft** on \`feat/manager-ai-v41-p0-evidence-20261116\` until P0 approval/merge and separate Owner permission. No main/Production deployment.
