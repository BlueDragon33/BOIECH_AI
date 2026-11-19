# V48 · Evidence-Aware Intelligence for Learner, Teacher & Manager
**Date:** 2026-11-19  
**Source PR:** https://github.com/BlueDragon33/BOIECH_AI/pull/211  
**Baseline:** Production main `aa35634cbcd85902568f0039c9490d774a723ee5`  
**Mode:** Cloudflare-only · ZERO-SPEND · source-cited deterministic reasoning · no automatic decisions.

## The three genuinely different intelligence upgrades

### 1 · Learner: know when mastery is unknown
- Based only on signed `/api/ai/mentor` bootstrap, not on other learners, hidden school grades, biometric data, health or video.
- Show **unknown**, not fabricated 0%, if no valid attempt/score.
- A real zero with positive attempt count remains **0**. A provisional result is NOT mastery certification.
- Detect future-dated or >24h old learner bootstrap and pause stale plans.
- Show only valid 1–30-minute plan items for currently unlocked lessons and sections; total <=60min, <=3 unique items.
- The next checkpoint asks the learner to provide comparable quiz/teacher-observed evidence; no automatic unlock/write.

### 2 · Teacher: prioritize fairly without confusing confidence for accuracy
- Existing role-scoped teacher overview is the only source. Current class workspace selection remains mandatory.
- Pure queue ranks human review of low-quality AI capture ahead of confident unverified recommendations; separates post-intervention negative/mixed observations from video error speculation.
- Tie priority is round-robin across unique learners: one learner cannot monopolize the first visible tasks.
- Displays **shown / eligible**, withheld/invalid items, source truncation and restrictions. Human review is still required for every action.
- Does not call the teacher action API autonomously. Teacher drafts remain the old signed/human workflow.

### 3 · Manager: accountable next-action synthesis, not fantasy optimization
- Existing signed board is analyzed by V41; V48 only groups these already-cited findings by actual management destination.
- Prioritizes high-severity groups using visible findings, explains count and exact evidence references.
- Marks snapshot **invalid** for bad/future time, **stale** after five minutes, **partial** for bounded/truncated sources, **scoped** otherwise.
- Shows next human review action with a link to existing management screen. Does not simulate an unseen complete optimizer, approve, or mutate D1.

## Negative evidence and performance
- Stateless no-storage modules `learner-evidence-readiness-v48.ts`, `teacher-evidence-triage-v48.ts`, `manager-action-brief-v48.ts`.
- Teacher source scanned at most 500 authorized learners with 30 suggestions each, only 18 shown by default; real partial-source warning.
- Manager source scans at most 100 displayed findings; UI derives at most four groups; no external model inference.
- Human-visible time sources update from a 60-second timer in React effects, never by impure clock calls during render.
- Dedicated Node tests cover missing/real-zero evidence, false freshness, locked lesson, incomplete manager board, rank fairness, source rejection, and no provider calls.

## Gates before release
1. Exact HEAD Node/TypeScript/lint/build, Universal Constitution and paired App/BOI read-only QA all PASS.
2. Cloudflare Preview with exact code SHA and BOI/App pinned pair; authenticated learner/teacher/manager positive + negative E2E (no write side effects from V48).
3. Mobile responsive/keyboard contrast and stale offline reentry checks with real roles.
4. Owner merge authority and independent review or explicitly recorded waiver; protected Production deploy with exact revision readback. **Do not self-certify independent review**.
5. Keep independent [PR #210](https://github.com/BlueDragon33/BOIECH_AI/pull/210) D1 0043/0045 and consent profile feature gated; V48 must not auto-promote its migrations.

**No Production or Preview D1 writes, no paid API and no Vercel** are performed by this PR. All results are advisory and cannot replace trained swimming-instructor evaluation or pool safety protocols.
