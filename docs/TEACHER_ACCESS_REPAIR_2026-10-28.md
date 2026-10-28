# Teacher access investigation and repair

Owner report: teacher workspace still cannot be entered on Cloudflare.
The existing managed access and Constitution 1.3 release boundaries remain.

## Evidence

Read-only production diagnostic `40719198478`, commit `7ab40b8`, returned only
aggregate counts: four teacher profiles, two approved, two pending, none blocked,
one expired, none missing registration or assigned class. Expiry overlaps status;
these are not five distinct profiles. Automatic classification was on, 30 days,
limit 25. No private profile records or keys were read into public logs.

The browser available for inspection has an unregistered identity, so the owner's
specific teacher profile and authenticated live workspace cannot be inferred.
Pending/expired rights are preserved; this repair does not approve or renew them.

Actual TeacherRoleShell lifecycle regressions reproduced these faults:

- A failed overview request immediately retried because its loading transition
  rebuilt the effect and only successful identities were remembered.
- Each loading transition removed/recreated portal hosts, disrupting workspace UI.
- Credential/signing/HTTP work had no deadline; stale identity responses could win.
- An owned-portal filter matched the active flag on body and hid identity changes.

The fix separates stable DOM hosts from request state, bounds the entire load to
15 seconds with cancellation, deduplicates active refreshes, retains actionable
errors for explicit retry, and ignores stale responses. Device changes reset
workspace context and key the dashboard so an old learner drawer/action draft
cannot survive into another teacher's session. Disposal and role changes cancel
work; backend signature, role, class, approval and expiry checks stay in force.

## Validation and release

Eight lifecycle tests execute actual component/effect code with controlled hooks,
DOM records, network completions and timers; one of them also executes
the actual dashboard drawer/draft state across identity changes. Four initial
load lifecycle tests and the drawer/draft key test failed before their fixes.
Three integration tests run actual client signing, P-256 server verification,
full Drizzle schema and SQLite queries: approved teacher/class isolation works,
pending/expired teachers and approved learners remain denied.

Full build/tests, lint, typecheck, release audit, Constitution CI and independent
review precede the existing protected manual Cloudflare deployment. Exact release
and verification evidence are recorded in the repair PR. A green release is not
claimed as an authenticated live test of the owner's teacher account. That needs
the specific device/status and an available authorized session. Physical iOS
acceptance also remains unverified.
