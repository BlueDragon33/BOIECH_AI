# BOIECH_AI V42–V47 | Integrated Completion & Release Ledger
**Date:** 2026-11-19  
**Constitution:** check actual ACTIVE version in Software-Blueprint-Hub before any release; do not fake ratification.  
**Repository:** BlueDragon33/BOIECH_AI  
**Stable production source:** `aa35634cbcd85902568f0039c9490d774a723ee5` deployed by [run 44565097568](https://github.com/BlueDragon33/BOIECH_AI/actions/runs/44565097568) SUCCESS.  
**Development release candidate:** [PR #210](https://github.com/BlueDragon33/BOIECH_AI/pull/210), branch `feat/v43-v47-secure-integration-main-20261119`, never confuse its exact changing HEAD with stable Production.

## Six-version capability matrix
| Version | Production verified source | Remaining in PR #210 and gates |
|---|---|---|
| V42 Manager, Teacher | Explainable manager/learner shortlists with human review; signed atomic class-capacity guard; teacher video triage and manual exercise draft | V44 verified certification, availability and pool safety correlated as **read-only** evidence, no automatic class assignment |
| V43-A Knowledge | Signed teacher-only retrieval of HUMAN-published curriculum, source version and citation, no generative hallucinations | V43-B media-free `teacher_video_inbox` receipts with current class/entitlement SQL scope; explicit UI polling/seen CAS with learner code + lesson, no original video egress |
| V44 Consent / profile | No personal supplementary profile collection active on Production | Signed teacher and learner opt-in, own-list, CAS submit/withdraw, manager source-reference verification and class safety; **OFF until separately data-owner activated**; migration 0045 creates empty tables |
| V45 Video quality | Local browser phase metrics (per-class F1 only with labels), abstentions, boundary timing, score null preservation and same-lesson/view/engine comparisons | Requires independently reviewed labeled real-video corpus, consent, heterogeneous cameras/light and expert disagreement metrics. No invented field accuracy |
| V46 Snapshot and spend | 5-min snapshot guard, partial/future/invalid source refused for manager review. No paid model/provider enabled | signed post-authorization readback, remote concurrency and data-quality negative tests; enforce ZERO-SPEND, prohibit any implicit paid provider activation |
| V47 Evidence integrity | Negative-evidence completeness warnings, source refs, bounded schedules and missing-source honesty already in V41 release | `evaluate-local-video-corpus-v47.mjs` allows local anonymized labeled evaluation with strict schema; always `NOT_VERIFIED` for independent validation until independent expert signs off |

## Controls and ownership
- Cloudflare Workers, D1, R2 only. **No Vercel, paid model/API, new slug, automatic AI grading or class assignment, source videos or medical/profile originals on server.**
- `BOI_ECH_AI_PROFILE_ADMISSION` must remain unset / disabled in Production until Owner approves purpose, personal-data retention/deletion, authorized verification role, opt-in/withdrawal UX and a signed Cloudflare Preview migration and race test.
- V43-B endpoint requires signed active teacher, assigned classes, live learner/teacher entitlement inside SQL, CAS and client event dedupe; reading a message does **not** mean expert video review.
- V44 manager source review is never an automated approval. `assessInstructorForClass` may return `eligible` only for adequate, not expired, separately verified inputs. User action stays with managers, and server does not auto-apply.
- Current V42 manager shortlists should not be advertised as global optimizer; there is no full workload, certification and pool attendance dataset for all classes.
- V45 synthetic unit tests show implementation correctness, not clinical/biomechanical accuracy. Camera hardware and water safety validation are separate.

## Evidence-Driven Release DAG (must follow)
1. **SOURCE CI:** integrated exact HEAD: Node tests, strict TypeScript, lint, build, local D1 migration rehearsal, Constitution, paired BOI+App read-only QA. Any failure => stop, fix in PR.
2. **MIGRATION INVENTORY:** verify live Preview `_migrations` before writes and D1 snapshot/rollback; migrations **0043 and 0045** create empty tables only. No automatic promotion of earlier stacked 0044/0046.
3. **PROTECTED CLOUDFLARE PREVIEW:** deploy EXACT PR #210 BOI + pinned App pair only after Owner approves protected Preview writes / bridge rotation; confirm D1 schema, exact BOI/App Worker revision, GET public JS/CSS.
4. **SIGNED E2E:** active, expired, blocked, unregistered teacher/learner/manager; different teacher/class; own-list non-transfer; consent withdraw vs verify race; double manager seen CAS; duplicate video event; migration rollback; 3 devices and mobile keyboard/a11y. Need actual authenticated testers, not just mocked source.
5. **PRIVACY/QUALITY:** User controls personal data policy; obtain external trained rater clips with documented consent and label agreement. Never fake approval.
6. **OWNER PRODUCTION GATE:** only after all non-waivable gates pass and manual Owner approval, squash merge expected SHA, post-merge CI, protected Cloudflare Production workflow, live exact revision and assets, rollback proof, role readback. Reviewer A/B NOT_RUN is NOT PASS; any approved Owner waiver must be explicitly recorded and cannot override signed auth/security E2E.

**Release state at authoring:** Production stays stable; PR #210 is code DEVELOPMENT only; no Cloudflare remote migrations or paid inference performed by this execution. Do not say V42–V47 "fully deployed" while the above gates are outstanding.

## Next safe action
Finish combined CI, fix source regressions, then obtain Owner approval for isolated protected Preview D1 migrations on exact PR #210 SHA and authenticated role tests. If no Preview credentials/role data, label `BLOCKED_ROLE_E2E` and do not merge/publish sensitive migrations.
