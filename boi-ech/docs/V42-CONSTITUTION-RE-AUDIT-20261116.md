# V42 independent re-audit — Blueprint OS 1.3.0
Date: 2026-11-16. Branch: `feat/manager-teacher-coaching-allocation-v42-20261116`.
Primary review: Draft PR #188; test-only PR #189 targets main and must **not** merge.
Canonical upstream: Draft #185 → #186 → #188. Source changes are **not** Production or Preview verification.

## Evidence-driven findings

| ID | Priority | Findings from exact source | Action in V42 branch | Remaining independent proof |
| --- | --- | --- | --- | --- |
| V42-P0-01 | P0 correctness | Manager proposed learners using stale available seats, while server `assign-person` checked only active class/CAS, not real seat count. Multi-manager actions could overfill a class. | Added **atomic, signed UPDATE capacity predicate** on learner moves, counting current approved, registered, non-expired learner memberships under the same entitlement logic as `trainingBoard`. Existing-class/no-class assignments are not charged an extra slot. Simulated first-choice proposals no longer exceed current spare seats. | D1 concurrency/race rehearsal with two signed managers, final readback and rollback checks. |
| V42-P1-02 | P1 honesty | A teacher without any target class sessions was ranked as if collision absence were evidence of availability. | Mark candidate `no-class-sessions`, lower priority, explicit no-timetable disclosure. Instructors with sessions show actual count of loaded sessions; class and session load are used for ordering. | Confirm official time availability, leave, qualifications and travel constraints from approved supplementary profiles. |
| V42-P1-03 | P1 consistency | A teacher's review of a particular video could be hidden by later feedback because the teacher overview exposed only the newest action of any type. | Extract review independently from class-scoped signed activity events, match **exact analysisAt**, expose `latestVideoReview`; coaching queue and video evidence detail prefer it. | High-volume event-limit test and secure server-side review-index if history exceeds query cap. |
| V42-P1-04 | P1 planning | Ranked learner options repeatedly referenced the same remaining class seat for many learners. | Simulate a primary first-choice allocation against projected remaining capacity. Additional alternatives visibly remain non-reservations; server remains final authority. | Correct-time and equipment/qualification-aware global planner, bulk approve conflict management, fairness tests. |
| V42-P1-05 | P1 navigation | Allocation proposal was not immediately actionable in the manager's existing approval flow. | Proposal button opens the existing manager confirmation sheet with class preselected. All actual `assign-person` commands still require a separate save and signed backend CAS. | 320–1440px keyboard/screen reader/contrast and real Cloudflare Preview test. |

## Not yet implemented — source/permission gates

- **Teacher durable coaching inbox**: video-analysis event -> per-class scoped notification, idempotency, read/unread/review, priority changes, deduplication, reassignment handling. V42 refreshes the teacher page while visible every 180 seconds; it is **not** server push and **not** notification while offline.
- **Teacher workload accounting**: current class count and loaded-session count available, but workload outside the requested date window, official availability, instructor capacity and verified certificates are not. Distinguish observed/unknown.
- **Learner profile matching**: verified availability window, suitable level and explicit preferences are not mapped to the authorized `TrainingBoard`. Do not infer from name, demographics or video without approval.
- **Safety and capacity**: published class capacities are configuration fields, not per-pool/lane or in-water safety certification. Class teacher-count is not a proof of safe teacher-to-learner ratio.
- **Decision lifecycle**: missing server-side suggested/reviewed/approved/applied audit, idempotent status machine, atomic multi-assignment reservation/rollback, conflict-free global optimizer. Do not auto-apply decisions.
- **Knowledge Base and generative AI**: not connected to approved source ACL, provider credentials, privacy retention, cost policy and evaluation set. Current system is honest deterministic rules-only; no claim it is generative.

## Required remaining acceptance gates

1. Confirm **exact full SHA** with typecheck, lint, application verified build, complete regression, Constitution/CONTENT-FIRST, paired read-only QA. Report failures; do not fake PASS.
2. D1 active vs expired entitlement capacity count parity; two-manager concurrency; canceled classes and pending profiles; zero-capacity/full-class; teacher assistant overlap and unexpected missing sessions.
3. Signed teacher/manager/learner negative-role tests, class reassignment isolation; old video review followed by later feedback; history >12k limit; client auth changes/reload/blocked identity.
4. Cloudflare **Preview only after permitted approval**, verify live build/revision, 320/390/768/1024/1440 visual contrast, focus accessibility, real user interactions. Production remains untouched.
5. Obtain data owner and policy approvals for any new profile fields, event notification and remote model spend; human Owner approval for release and upstream dependency merges.

**Release decision: BLOCKED** until exact evidence and approved Preview runtime testing. Passing automated source tests is necessary but not sufficient.
