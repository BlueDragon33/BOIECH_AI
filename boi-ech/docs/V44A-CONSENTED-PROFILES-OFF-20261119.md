# V44-A — consented supplemental profile intake (DISABLED by default)
**Source main:** `461ab42d71f7f157880bd4aa83676b249ca7b3d0`. Developed on a separate Draft branch; no database or cloud action executed.

Data fields: coded certificates and expiry (no photo/original), availability/absence windows, declared level, class pool-safety verification, no health data or video/images. User signs own device submission with explicit consent checkbox in later UI. Manager verifies a source reference and bounded 90-day expiry. Withdraw removes payload via CAS. All reads scoped to the current roster and protected roles.

Migration 0045 creates two **empty tables** after current main migration 0042. No seed/legacy profile mapping. Server feature policy `BOI_ECH_AI_PROFILE_ADMISSION=enabled` is **OFF when unset** and returns HTTP 403 `AI_PROFILE_ADMISSION_DISABLED` before D1 is requested; no paid provider. There is no UI enabled or production authority in this slice. This is not a release approval to activate collection of personal data.

Every mutation requires signed teacher/learner/manager authorization, expected revision, D1 batch audit, explicit consent and active verified source. Test offline CAS race/revoke, wrong role, duplicate submissions and disabled OFF without DB. MUST obtain data owner consent/retention policy, DPIA as applicable, expiration/purge behavior, signed role Preview with remote Cloudflare D1 concurrency and Owner protected release authorization before deploying migration or enabling profile admission.

Next V44-B: wire opt-in UI to exactly signed own device; manage verified profile evidence in V42 shortlists, atomically guard class safety at write time, test consent revocation/concurrency in Cloudflare Preview. Do not reuse old stacked PR #191/#193/#196 wholesale.
