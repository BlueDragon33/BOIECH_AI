# BOIECH_AI V44 — Four Owner-approved advanced AI modules
**Scope approval:** 17 Nov 2026, in Bơi Ếch AI conversation. Owner approved the **four last AI features** from status table: supplementary professional profiles, deliberate application of approved allocation, approved swimming knowledge, and optional generative AI.

**Caution:** approval of implementation scope is NOT a blanket consent to collect individual data, third-party API transfer, paid inference, independent reviewer sign-off, real Cloudflare Preview deploy or Production release. Blueprint OS 1.3.0; Draft V43 PR #191 stack; Cloudflare only.

## 1. Person-level consent and class safety
- Signed teacher/learner UI under the professional/learner profile: voluntary declaration, P-256 signed consent, optimistic D1 revision, explicit withdrawal. Never auto-submit or infer a certification from a device profile.
- Manager verifies submitted cert/time windows with an evidence reference and max 90-day validity; separate manager-authenticated class/basin certification, course windows, learner-to-trainer ratio, safety flag. Manager only sees roster-scoped records.
- Data protection stays fail-closed via `BOI_ECH_AI_PROFILE_ADMISSION=enabled` on an **explicitly policy-approved Cloudflare Preview**; **default OFF**. This variable is not to be set by a migration/CI run. Admission requires each person's actual consent plus manager verification. Don't store ID scans, phone numbers or videos.
- Revoked, expired, changed source revision or missing certified class/teacher/learner hard-vetoes AI apply. Source-limit flags block decisions.

## 2. Human approved allocation -> actual canonical assignment
- Review -> approve only records decisions, no class mutation. A **separate "Áp dụng phân công đã duyệt"** button requires a human confirmation.
- `/api/training-ai-proposals` action `apply` verifies exact approved revision + immutable source fingerprint (including profile seals), current teacher/learner certified availability, active class, CAS person membership and teacher-class load. Calls existing `trainingCommand` with the exact approved proposal as an **additional SQLite guard** in the same write.
- Same D1 `batch()` contains the original `device_access.class_name` assignment, training command receipt/audit, teacher-class metadata and new `training_ai_proposal_applications` receipt. Unique proposal ID prevents applying twice; command ID permits safe replay with exact actor+revision.
- Return `applied:true` only after exact row readback. On uncertain postwrite readback, show a clear failure/unknown state instead of encouraging a different command ID.
- The existing signed manual assignment remains available even when AI profile policy is OFF; no broad autonomous allocation.

## 3. Provenanced swimming knowledge
- Retrieval only materializes actual `course_content_versions` at status `published` with reviewer and dates; reject unreviewed drafts, static fallback and malformed published payload.
- `/api/training-ai-coach` signed teacher/authorized manager endpoint supports `search` and `draft`; cited passages have exact curriculum version, lesson and section.
- Source link returns to the current app; `citationLabel` identifies version/section. Do not misrepresent that landing link as a direct quoted passage.
- No original video, personal profiles, exam grades, names, class roster or device IDs sent to a generative service.

## 4. Optional LLM + cost/privacy gates
- API supports **OpenAI Responses API** behind all required server variables:
  `BOI_ECH_AI_LLM_ENABLED=enabled`, `BOI_ECH_AI_LLM_REMOTE_TRANSFER=approved`, `BOI_ECH_AI_LLM_PROVIDER=openai`, server-only `BOI_ECH_AI_LLM_API_KEY`, `BOI_ECH_AI_LLM_MODEL`, explicit integer `BOI_ECH_AI_LLM_DAILY_TOKEN_LIMIT` (>= 2048, <= 200000) and optional `BOI_ECH_AI_LLM_MAX_OUTPUT_TOKENS` (128–512).
- **Default OFF/zero spend** even after source merge. Never write keys to GitHub Issues/PR comments. Actual remote/provider usage requires a further explicit Owner provider, budget, retention/data residency and transfer decision.
- Atomic D1 daily budget reserve 2048 tokens per request, conservative to avoid running over daily ceiling; reservation is **not** a provider invoice. Fail closed when limit exhausted.
- Query 8–320 characters excludes common PII/secrets. Only cited published-course excerpts plus a short technical question may leave Worker after remote-transfer authorization. Remote request disables provider storage (`store:false`) and bounds output/time.
- Draft validator rejects missing/fake [KBn] citations and external URLs. Result always `sent:false, requiresTeacherApproval:true`; no autonomous messages, assignments or edits.
- Without an approved model/provider or with quota exceeded, UI displays **approved-retrieval-only**, never pretends a local rules result is generated LLM output.

## Remaining distinct gates before release
1. Full exact-HEAD automated QA + migration 0046–0047 rehearsal, React UI and SQL regressions (source state only).
2. Isolated, authenticated Cloudflare Preview E2E with correct two-Worker source revisions, D1 migrations and signed roles. Exercise dual-manager last-seat race, approved proposal apply/withdrawal races, deep-link and mobile/light/dark WCAG and accidental provider egress.
3. Actual independent Reviewer A/B technical evidence or documented canonical constitutional owner-approved alternative. Request comments do not count as signed verdict.
4. Owner acceptance of **running Preview**; explicit dependency-order merge and Cloudflare Production publication by a separate authorized release action.

**DO NOT:** infer full product acceptance from source CI, deploy through Vercel, bypass secrets/Preview environment, or flip the provider/data-collection flag for the Owner without a recorded policy.
