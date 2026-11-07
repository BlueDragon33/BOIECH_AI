# Account-first V2 Issue #108 — updated source-only checkpoint

**2026-11-07. SOURCE-ONLY / NOT ACCEPTED / WORK HANDOFF PREPARED.** This file supersedes earlier initial-capacity-only observations but does not imply new runtime QA evidence.

## Current implemented source

- Account-first V2 only activates when BOTH `BOI_ECH_ACCOUNT_FIRST` and `BOI_ECH_ACCOUNT_V2` are set to `true`. Production retains them OFF until approved.
- Registration/authorization: 5–10–200 role quota; 3 unique active device keys; requested → first review → profile → second review → active; separate manager and Owner authority, pending devices cannot access protected modules. API includes signed owner/manager first-review, profile correction and trusted-device confirmation.
- Device self-service: current trusted device can approve/revoke; separate limited lost-device recovery and one-use recovery-code rotation for unavailable original devices. **Proof of private-key possession for the new device must still be independently reviewed**.
- Sync: explicit per-device and per-scope consent, allowlisted progress/preferences payloads, revision CAS, event retry ACK, race guard and account-bound HTTP request; per-account local IndexedDB queue retains un-ACKed events and 409 conflicts; no media/video/credential auto sync. **Existing learning-progress write/read clients not yet migrated to the new verified-sync queue**; a full bridge is a release blocker.
- Legacy: previous route for manager/device single-stage approval blocked in V2; older admin/teacher approval guards remain. Must still inspect ALL legacy signed endpoints for alternate rights/data paths.
- Migrations: additive 0019 account caps, 0020 staged review/device consent, 0021 restricted sync and 0022 conditional 50/5→200/10 default shared approvals. Existing accounts remain `legacy_hold` and need explicit reconciliation; no data is dropped automatically. Real migration path/journal must be reviewed.
- UI: minimal registration then profile, manager two-stage approval, device confirmation + recovery, sync consent and pending/conflict status.

## Tests/evidence honestly checked

- Existing locally executed SQLite source tests: 6/6 PASS for capacity/3-device/CAS/audit.
- Additional **schema-equivalent** local Node 22 SQLite harness: 3/3 PASS for onboarding stage guards, sync event guard on unapproved/revoked device, and default manager 200/10 conditional migration. **Not live D1, not full end-to-end tests.**
- New `tests/account-v2-onboarding-sync.test.mjs` is source checked in but **not executed** in this chat. Entire `npm test`, typecheck, lint, build, Workers Free CPU, browser/Preview/legacy snapshot, role replay, cost, independent reviewer and Production acceptance NOT RUN.
- No GitHub-hosted Actions, merge, Draft PR, release, Cloudflare D1 changes, Production mutation or paid services in this task.
- Source branch is **not declared 90–95% complete**: percent cannot be substantiated without integrated QA/Preview and live old-data migration.

## Task owner Work

[Work mode handoff with exact steps, blockers and release gates](../../handoffs/BOIECH_ACCOUNT_FIRST_V2_WORK_HANDOFF_20261107.md)

**ONE NEXT ACTION:** In authorized Work environment, check out exact branch HEAD and execute offline full QA + security and sync bridge integration; correct failures before isolated Cloudflare FREE Preview. If Preview/Owner permissions unavailable, preserve flags OFF and Production untouched, report the blocker and single follow-up.
