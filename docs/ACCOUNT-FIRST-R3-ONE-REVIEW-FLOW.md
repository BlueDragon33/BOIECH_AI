# BOIECH_AI × Application-Management — R3 Single Review, Profile Completion Activation

Date: 2026-11-10
Status: **OWNER REQUIREMENT RECORDED; NOT IMPLEMENTED, NOT ACCEPTED**
Base: BOI UI source branch `feat/account-auth-ux-split-20261110` at `6cb177032b1eefca1e0a5d2552f90a041b022941`
Paired source on readback: BOI Draft PR #114 `73f8890592d2a506b0553eb3a7f5d446ab0a82b9`; APP Draft PR #386 `bd9120e6bc0c7e26f96b6a4daa5380b72992405f`.
Effective policy: Blueprint OS 1.3.0 ACTIVE. Supersedes earlier two-human-review product requirement only; does not automatically waive constitution, security, capacity, deployment or Production gates.

## One authorized human review: canonical lifecycle
1. **Register**: username, password, one contact type (email OR phone; icon/toggle) and chosen role. Store contact as self-declared/unverified. Registration creates a login session and requested/pending account; does NOT grant business access or consume active seat. Manager is not publicly self-enrollable: must use one-use Owner invitation from Application-Management.
2. **Await approval**: account can only inspect its request state, sign out, recover safely. Learner/teacher review is by an active and appropriately permissioned Bơi Ếch manager; manager review is by authenticated stepped-up App-Management Owner. Audit actor, target, decision, revision and scope. Only ONE human approval decision.
3. **After approval**: transition `requested -> profile_required` with durable `first_review_by` and revision/CAS; allow login to the *restricted mandatory-profile screen only*. Required fields marked *; preserve partial input safely without claiming complete. The reviewer has not yet granted unrestricted app access.
4. **Profile submission**: validate all required fields server-side; perform an **atomic conditional D1 transition to ACTIVE**. In the same transaction enforce approved first-review provenance, no revocation, correct role, current manager scope, manager-assignment constraint, quota and unique identity; update device_access approved/free, manager grants if role=manager, onboarding ACTIVE and entitlement with the role's current default duration. On failure roll back all states and show an actionable error; do not silently open app.
5. **Access**: only when `status='approved' AND stage='active' AND entitlement.active AND trusted_device`, enter the main app. Initial term default 30 days starts on **successful profile completion/activation**, not merely approval or registration. Only App-Management Owner changes term via existing audited UI.
6. **Subsequent login**: if profile COMPLETE/ACTIVE, go straight to app and never reopen mandatory profile just because of login. If pending or profile_required, show exact state and no business data.

**No second approval**: remove second-approval CTA and commands only AFTER new server route and migration/contract are verified on isolated candidate. Never repurpose old `approve-manager` or `review` APIs into an unsafe bypass. Account approval remains separate from approval of new device.

## Registered contact and new-device policy
- Registration asks for **either** email or phone, not a combined ambiguous input. No OTP and no provider setup at registration, FREE-only.
- Contact is **unverified**, not an independent authentication factor. On new device, after correct password, optionally prompt the same registered contact for consistency but **matching that string alone must NOT approve/trust the device**.
- New-device trust needs an existing trusted P-256 device authorizing it, or existing strong one-use recovery proof; optional email/SMS OTP only if a genuinely FREE sending provider and verified sender are configured. Do not mark contact_verified after mere echo. Limit 3 devices with enforced D1 quota; recovery when all slots occupied remains available using strong one-use proof; manage approved devices inside authenticated Personal Profile.
- Do not create Gmail OAuth/project, new D1/R2 or paid email service solely to collect a contact field.

## Old records and data purge
Owner requests a *fresh registration wave* and clean old applicant queue. Do **not** issue destructive SQL, truncate Production D1 or delete historic learning/certificates, identity proof, audit, sessions or old account state under this instruction.
First produce scoped inventory (table names, row counts, FK links, status, storage location), deterministic dry run, backup/restore checks, exact allow-list and Owner approval for the **specific destructive deletion**. Prefer archive/retire and exclusion of old intake from new pending queue when practical. Legacy proof-sensitive records remain fail-closed. Do not fake automatic migration.

## Source impact / work packages
- BOI `boi-ech/app/account-v2-workflow.server.ts`: record one-review approval and implement conditional atomic profile-completion activation, including manager role and first reviewer authority.
- BOI `boi-ech/app/account-core.server.ts`, `account-entitlement.server.ts`: migrate entitlement grant origin and manager assignment/permission paths, preserving V1 behavior and 0025 guard.
- BOI additive migration **0026 or next journal-approved number only**: if necessary, update legal transition guards and introduce contact provenance. Never edit already deployed 0017–0025.
- BOI `boi-ech/app/account-gate.tsx`, `registration-roles.tsx`: contact icon choice and truthful 3-state UI (pending, restricted profile, active); remove obsolete second-review messaging; keep invitation hash safety and profile device controls.
- APP `app/apps/boi-ech/account-expiry-panel.tsx`, `app/api/apps/boi-ech/account-entitlements/route.ts`: Owner only one approval for manager; no second-review CTA; maintain MFA 30 minutes, CAS, audit/readback, authority separation.
- In both systems, authenticate server-side roles. UI labels are not access control. Never call `profile complete` success before verified D1 readback.

## Required negative/acceptance tests (NOT_RUN)
- Register email-only and phone-only; reject invalid/duplicate contacts per policy; no mail/SMS external side effect; pending cannot access app.
- Owner manager approval and manager learner/teacher approval exactly once; forbidden reviewer, expired/revoked manager, owner spoof, stale expectedRevision and concurrent double-approval fail 401/403/409.
- Unapproved profile submission, missing * field, malformed input, duplicate personCode/phone, exhausted capacity or manager quota must NOT activate or consume a seat/entitlement, and must produce no approval-success audit.
- Correct profile completion after authorized review atomically creates status=approved, stage=active, entitlement term and assignment/capability; 30-day clock starts at activation, no second human decision; restart and login preserve form completion.
- Manager must not get management role before authenticated Owner review + valid completed profile. Lecturer/learner must not inherit owner privileges.
- New-device login + correct contact knowledge alone cannot trust device; trusted-device approval/recovery proof remains required; 3-device cap and locked-out recovery covered.
- V1/non-V2 rollback, migrated `legacy_hold`, 0025 SQL guard and all historical tests compared explicitly. Any superseded legacy expectations must be proposed/reviewed, not silently edited.
- Node22 locked dependencies/test/tsc/lint/build, independent Reviewer A/B, read-only Cloudflare D1 inventory/migration ledger/UUID/FREE quota, protected Preview owner QA all mandatory before L3.

### Gate snapshot
SOURCE REQUIREMENT APPROVED (this document) / CODE & MIGRATIONS FOR R3 **NOT_RUN** / INDEPENDENT REVIEW **BLOCKED** / PREVIEW **BLOCKED** / PRODUCTION **UNCHANGED**. No deletion, merge or secrets mutation authorized.
