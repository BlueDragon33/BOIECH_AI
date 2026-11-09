# Account-first P0 implementation ledger

Spec: `docs/handoffs/BOIECH_ACCOUNT_FIRST_WORK_P0_20261104.md`.
Bases: BOIECH `f76e2d146636827952026ca206597a4416291110`; Central `4671ee60945229e0f35fc7faec662b1cea9a98bd`.
Authority: source-only, ZERO-SPEND, no Actions, PR events, deploy, merge or production writes. REVIEW BLOCKED; CI PENDING; global D1 10/10 BLOCKED.

## Design and dependency map

Keep the existing `device_access` row as a **storage anchor**, not a login credential. One `accounts.account_id` maps to one anchor, while any number of P-256 device bindings and expiring HttpOnly sessions map to that account. Existing progress, attempts, certificates, payments, schedules and manager assignments keep their foreign keys. Login never inserts a second person row. Existing unique person/phone indexes remain intact.

Alternatives considered: duplicating a person per browser breaks quotas and schedules; rewriting all foreign keys now increases migration risk. Additive account-to-anchor mapping preserves data and is the implementation choice for this candidate. Deterministic backfill is explicit and conflict-gated, never an automatic request-time migration. Existing key possession is required to claim a legacy account; matching a phone/name is insufficient. New accounts are pending regardless of legacy auto-approval settings.

Passwords use Node's standard `scrypt` (N=32768,r=8,p=3), random salts, bounded input, constant-time verification, no added dependencies. Recovery uses a random one-use offline recovery code, rotated on use; no email provider or paid service. Runtime KDF/CPU compatibility remains a separate admission check. Cookies are host-only, Secure, HttpOnly, SameSite=Strict. Sessions have absolute/idle expiry, CAS rotation, account/device revocation and server-side origin checks.

Owner control uses the existing authenticated bridge, separate account endpoint, account revision CAS, append-only audit and independent raw readback. Operational manager approval is separate from `registrants.read.all`. Lists whitelist fields and audit every disclosed account and purpose. Shared quotas retain 50/5 defaults and count canonical assigned accounts, never bindings.

## Plan

- [x] 1. Add DDL, deterministic dry-run/backfill, password/session/recovery core and behavioral SQLite tests; verify RED then GREEN.
- [x] 2. Add default-off runtime adapter and bounded account UI; preserve legacy modules and isolate local data across account changes.
- [x] 3. Add Owner account permissions contract, expiry/CAS/audit/readback, minimal Central integration and denial tests.
- [ ] 4. Run local tests/type/build/security, fix real regressions, record truthful evidence and reviewer handoff.

Review focus: legacy claim collisions; pending/blocked person vs revoked browser; concurrent last-slot approvals; expired/revoked broad-reader permission; password/session/recovery material in output, audit or browser storage.

## Execution notes

- User explicitly requested uninterrupted implementation; use the supplied acceptance contract without another design approval round.
- Both candidate refs matched the supplied HEADs at intake. `main` is not the implementation base. No rebase/merge.
- Baseline full Node suites contain existing failing tests; preserve logs and classify failures before making completion claims.

- Task 1: implemented and tested additive schema, deterministic mapping, standard KDF, sessions/recovery and isolated migration rehearsal.
- Task 2: implemented default-off adapter and account UI; per-account local namespaces with immutable document scope preserve legacy data. Browser acceptance remains NOT_RUN.
- Task 3: implemented owning scope and minimal authenticated Owner consumer, CAS/audit/raw readback. No implicit registrants.read.all grant.
- Task 4: local checks recorded in the evidence manifest; Central baseline regressions and target-runtime/browser/live-D1 admission remain BLOCKED. No claim of complete acceptance.
- Ruling: keep storage foreign keys anchored at the original canonical row rather than rewriting all learning/payment/scheduling tables — limits data-migration scope; exact-snapshot compatibility is still a release gate.
- Ruling: force a document reload when an authenticated account changes, rather than swapping the global database under in-flight promises — prevents cross-account offline writes, with one reload as the UX cost.
- Ruling: preserve the divergent Central base and report its 14 known failures instead of importing unrelated main changes — minimal scope and no unauthorized merge; consumer admission remains blocked.

## Consumer follow-up — 2026-11-04

The earlier Central baseline ruling above is historical. Source `b50878d2878bf51444d033064ce9d9cb4e56a3e0` resolves the stale test contracts and owned lint errors, restores existing inline MFA selectively, and fixes reviewed lifecycle regressions without a merge/rebase. Local type/build, final 833/833 Node and in-process cross-repo SQLite integration pass; full lint is 0 errors / 38 warnings. BOIECH application source is unchanged at `fbf70057a232e3c1f6115311afc0385e80e6dbb6`. See `BOIECH_ACCOUNT_FIRST_P0_CONSUMER_ADMISSION_20261104.md` for immutable evidence and remaining acceptance gates. REVIEW BLOCKED; CI PENDING; global D1 10/10 BLOCKED; flag OFF.
