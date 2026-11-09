# Account-first P0 — source reviewer handoff

Latest QA follow-up: [independent findings, corrected source and publication blockers](BOIECH_ACCOUNT_FIRST_QA_RELEASE_ATTEMPT_20261104.md). The earlier source pins/results below are historical; they are not acceptance of the corrected source.
Blueprint OS 1.3.0. SOURCE-ONLY ENGINEERING CANDIDATE. **REVIEW BLOCKED; CI PENDING; global D1 10/10 BLOCKED.** No release approval is implied by local checks.

## Source and authority

- BOIECH base `f76e2d146636827952026ca206597a4416291110`, branch `candidate/account-first-p0-20261104`.
- App-Manager base `4671ee60945229e0f35fc7faec662b1cea9a98bd`, branch `candidate/boi-account-permissions-p0-20261104`.
- Both original candidate refs were independently re-read unchanged before publication of these source branches. No merge/rebase/main changes. Workflow triggers were inspected: no source-branch push triggers apply; no PR is opened because the repositories run hosted workflows on PR events. Commits carry `[skip ci]` as an additional safeguard.
- No Actions dispatch, production/cloud database access, paid provider call, deploy, approval, ratification or publishing. A read-only engineering review is not Reviewer A/B authority acceptance.

## Implementation map

| Area | Files / behavior |
|---|---|
| Owning identity | `boi-ech/app/account-core.server.ts`, `drizzle/0018_account_first.sql`: accounts, credentials, bindings, expiring/rotating/revocable sessions, scopes, persistent rate limits, append-only audit |
| Authentication | Standard Node/OpenSSL scrypt N=32768,r=8,p=3 with random salt; HTTPS submission, HttpOnly/Secure/Strict host cookie; one-use offline recovery code, reset generation invalidates all previous sessions |
| Legacy data | One immutable account-to-storage-anchor mapping; retain original unique identity/phone indexes and all legacy rows/foreign keys; original P-256 possession required for claim, never phone/name matching |
| Three roles | New registrations always pending. Owner account endpoint approves managers; approved managers approve learners/teachers. One canonical person row means devices/logins never consume extra quota slots |
| Quota / policy | Existing shared 50/5 defaults and configured limits remain authoritative. Last-slot admission is serialized in SQL; existing access-day policy is read from owning D1 rather than hard-coded |
| Existing modules | `device-auth.server.ts` adapts cookie session to canonical anchor; course, certificates, payment proof and video keep original storage keys. Pending/blocked/expired accounts cannot use protected APIs |
| Privacy | `registrants.read.all` is separate from operational scope, Owner CAS/revision only, expiry/revocation checks per request, purpose/query limits, explicit field whitelist and per-target access audit |
| Central integration | `boi-account-permissions.server.ts`, view, `operations` branch: verified Owner only, signed existing bridge, read → CAS command → independent raw source read. No password, verifier, recovery or learner profile dump is stored centrally |
| Browser | `account-gate.tsx`, bounded forms, registration roles, per-account course/offline namespaces, per-account video DB, original database preserved. A live document reloads before switching account identity; delayed promises cannot be redirected to another person's namespace |
| Compatibility gates | In account mode, legacy broad overview reads and email-admin registration controls fail closed; Central must use the new account endpoint. Legacy Owner payment writes remain available with the existing owning-app checks; operational manager grants use the new account contract. OFF mode preserves the old path |
| Demo | `/xem-thu-can-bo-quan-ly` bypasses login UI and retains literal read-only fixtures |

## Migration rehearsal

`node scripts/account-migration.mjs --database LOCAL_OFFLINE_SNAPSHOT.sqlite` opens its source read-only, uses SQLite backup into a disposable clone, applies the actual additive DDL, runs the production migration report/backfill twice, fingerprints every legacy table, closes/reopens the clone and checks the mapping again. It has no production/apply/network mode.

Observed rehearsal: synthetic approved/pending/blocked people mapped 3/3; 24 legacy tables unchanged; idempotent mapping and reopened readback. This is **isolated SQLite**, not live Cloudflare D1 or a production restore test. The source snapshot remains untouched; discarding the clone rehearses rollback only for this local exercise.

Before any real backfill: obtain an authorized snapshot, review conflicts and incomplete legacy registrations, confirm credentials are never exported to Central, rehearse on that isolated snapshot, attest mappings and account quotas independently. Incomplete/anonymous registrations require an explicit completion/claim policy; matching identifiers must not silently merge people. Original-key loss is not solved by guessing a matching phone/name.

## Engineering findings and corrections

- Multipart proof upload: preserve exact Origin check while keeping JSON content-type enforcement specific to JSON account endpoints.
- Expired scopes / revoked sessions: final training SQL now checks the owning account scope, expiry, credential generation, live binding/session and assignment scope; a preflight check alone is insufficient. A behavioral SQLite test executes the actual extracted production guard.
- Pending paid manager: account approval refuses paid/payment-in-progress state and uses a conditional write/audit guard; no silent free classification.
- Effective vs configured broad permission: effective state also requires active operational management and account status; revoking inactive/expired privileges still verifies raw persisted state.
- Recovery secret: bound to the originating account, cleared on logout/401/account change, never put into browser persistence.
- Local isolation: original legacy DB is retained, account databases are distinct; account change forces a new document. Namespace stores/signing credential are installed before a direct video route mounts. Real browser race admission is still pending.
- Existing access-day policy is honored for new manager and learner/teacher approvals; no implicit unlimited manager lifetime.
- Type errors in unreachable legacy role branches were corrected without expanding authority. Training fixtures now explicitly establish approved test people and use current Owner CAS/approval contracts; capacity deferral remains tested. Source-pattern tests were updated for the already-present UTC presence rule and new database namespace.

## Evidence and blockers

See `docs/evidence/account-first-p0-20261104/verification.json`, changed-file digest manifest, Node output and local migration report. The commit containing this file is the immutable evidence anchor; this document does not self-attest CI.

- BOIECH typecheck/build/lint and complete Node suite must be read from the final evidence file, not earlier chat counts.
- Consumer follow-up: Central source is now `b50878d2878bf51444d033064ce9d9cb4e56a3e0`. Its former 14 failures were stale source-pattern requirements; current contracts are verified without restoring old authority bypasses. Complete `npm test` (type/build/Node) passed 832/832; final full Node after one additional server-gate test passed 833/833. Full lint: 0 errors / 38 warnings. Actual in-process cross-repo signed-ticket/CAS/readback/audit/revoke and multidevice account tests pass on local SQLite with synthetic bindings. See [consumer follow-up](BOIECH_ACCOUNT_FIRST_P0_CONSUMER_ADMISSION_20261104.md); this is not live D1 or browser acceptance. BOIECH application bytes remain pinned at `fbf70057a232e3c1f6115311afc0385e80e6dbb6`, so its existing 567/567 evidence is retained without rerunning an unchanged suite.
- Bundled local workerd executes the actual scrypt implementation under compatibility date **2026-05-22**. The installed binary does not support the target 2026-08-26 date. Exact target-runtime/CPU-budget/zero-spend admission is **NOT_RUN**; never lower password KDF parameters to hide a platform limit.
- Real browser/Safari/iPhone checks, account-switch delayed-request scenarios, direct video login, multipart payment completion, real legacy-snapshot migration, independent live D1 readback/rollback and authority review are **NOT_RUN/BLOCKED**.

## Admission and fallback

`BOI_ECH_ACCOUNT_FIRST` remains absent/OFF by default. Enabling additionally requires a validated `BOI_ECH_ACCOUNT_ORIGIN`, additive migration/backfill admission and the complete acceptance matrix. Do not enable through a UI preference or deploy this branch as a substitute for review. Existing Worker slug, production configuration and data remain unchanged.

**One next action:** independent reviewers assess the exact source pair and evidence for the remaining authorized browser, target-runtime, real-snapshot and D1 acceptance gates. **Fallback:** retain candidate branches and keep the flag OFF; no production migration or authority bypass.
