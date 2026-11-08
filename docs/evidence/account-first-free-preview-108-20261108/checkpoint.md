# Issue #108 — FREE Account-first Preview unblock, 2026-11-08

## Outcome

One source blocker removed: Account-first Preview no longer requires an R2 subscription. This is **source/local verification only**. Remote Preview, full payment acceptance, merge and Production release remain **BLOCKED**.

Base: `98cf809d711f0969c8ba0fd07516dad3b6252d62`, existing Draft PR #110. Local implementation snapshot reviewed: `d8bc7db050b3eca98366dacdfdf07d40a1b8f0fa`. The final source also corrects the mandatory pre-deploy BOI Preview origin wording. No product changes after the verified implementation. Read the actual remote candidate SHA from PR #110; local commit metadata is not a remote publication receipt.

## Decisions and source changes

- Omit R2 from the Account-first Preview template. Preparation, scaffold validation and generated artifact verification reject R2 injection, including other binding names and malformed R2 declarations.
- Preserve dedicated D1, production-ID comparison, distinct mandatory HTTPS origins, V2 flags, Owner-secret preflight, manual dispatch and Production gates.
- Existing payment-proof routes remain unchanged and fail closed when `BUCKET` is absent. `paymentStorageReady=false` must stay truthful; payment upload/read is not accepted by this Preview.
- No new service, subscription or alternative hosting provider.

## Verification actually run

Node **22.13.0**, clean isolated checkout of exact base, `npm ci --no-audit --no-fund` completed.

| Check | Result |
| --- | --- |
| Existing Preview preflight/release tests before code change | 4/4 PASS |
| New tests before implementation | 4 expected failures / 1 existing guard PASS; reproduced mandatory R2 and acceptance of injected Preview bucket |
| New + existing focused tests after implementation | 9/9 PASS |
| Full `npm test` (includes verified build) | **624/624 PASS**, 0 failed, 0 skipped |
| `npx --no-install tsc --noEmit` | Exit 0 |
| `npm run lint` | Exit 0; 0 errors, 5 pre-existing unused-variable warnings in unchanged files |
| `validate-cloudflare-preview.mjs` | Exit 0 |
| `validate-release-readiness.mjs` | Exit 0 |
| Real local Preview prepare/build/generated-artifact check | Exit 0; Worker `boi-ech-preview`, D1 name `boi-ech-preview-db`, no R2 |

The Preview build used synthetic nonproduction D1 UUIDs and the existing Preview origins. Revision label was `local-free-108-20261108`, not a claim of a remote deployed SHA. No remote SQL/migrations or deployment was run.

One separate AI code review checked the implementation diff and independently ran the new focused tests **5/5 PASS**. No Critical/Important findings. It identified a retained minor bootstrap wording issue in `CLOUDFLARE_PREVIEW.md`; corrected as documentation only. This review is not an independent human release approval. Cloud/credentials, full suite, acceptance and cleanup were outside the reviewer's independent verification.

## GitHub configuration completed and read back after reload

Both existing Preview Environments now have:

- `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN=https://application-management-preview.boiech-ai.workers.dev`
- `BOI_ECH_PREVIEW_ORIGIN=https://boi-ech-preview.boiech-ai.workers.dev`
- Required reviewer: `BlueDragon33`.
- Administrator bypass disabled.

No reviewer account was newly granted repository access. Prevent-self-review remains unchecked so the sole Owner can perform human approval; this does not replace independent human acceptance. Branch restriction remains the pre-existing `No restriction`.

No secret value was read, generated, entered or changed. No workflow was dispatched or enabled; App Preview remains DORMANT.

## Authorized old-user cleanup: read-only findings

Owner clarified that “old invalid accounts” means Bơi Ếch users, not Cloudflare databases. Read-only SQL against existing `boi-ech-db` found:

- The Production schema still has the legacy device tables; no Account-first `accounts` table yet.
- **88 device records**, not 88 independently identified user accounts.
- 38 approved devices: 14 learner, 11 teacher, 8 manager, 5 with legacy unset role.
- 50 pending devices: 2 learner, 3 teacher, **45 unregistered/unset-role**.
- Among those 45: 0 with learning events, 0 certificates, 0 payment-review records, 0 migrated legacy keys, and **0 last seen more than 30 days ago**.

The last group is a cleanup candidate group, not proof of invalidity: recent browser visits create device registrations. No device, account, progress, certificate or audit record was deleted. Do not label the five approved legacy records invalid solely because their role is unset. The current cleanup API also enforces manager-only Owner control before its destructive path; no direct-SQL bypass was attempted.

## Remaining deployment/release blockers

1. Dedicated `boi-ech-preview-db` is still absent. Account is Workers Free at **10/10 D1**, and every current D1 has a Worker binding. Deleting user/device rows cannot free a database slot. No DB is approved for retirement/reuse.
2. Both Preview Workers still lack the shared `CONTROL_SERVICE_SECRET`; BOI Preview lacks D1/bindings. BOI GitHub environment still needs exact Preview/Production D1 identity secrets; App Preview still needs the confirmed Owner email policy and bridge secret. Existing encrypted secret values were not validated by reading them.
3. App Preview deployment remains deliberately `if: false`. Human authorization is required before changing that gate and performing exact-SHA deployment.
4. Remote migration from legacy snapshot with backup/readback, signed Owner/MFA/CAS/expiry, three actual devices, offline/consent/ACK/conflict/revocation, FREE CPU/KDF, independent human review and exact-SHA release approval are not accepted.
5. Full payment-proof storage acceptance remains separate and blocked without a separately authorized storage plan; no R2 subscription was activated.

## Next Action

Resolve one dedicated FREE D1 slot by an Owner-specified nonproduction retirement decision, with dependency checks, backup and verified restore before any irreversible action. Do not choose or delete another project's database without specific approval. Then complete the protected Preview bridge setup and actual acceptance; keep Production unchanged until the release gates pass.

## Follow-up: current base reconciliation and retirement preparation

- The PR metadata exposed an old base SHA. Direct branch-ref inspection and `git ls-remote` confirmed the actual target HEAD is `e229fa82983511aed42b54450597d01a19b856fe`.
- Merging that target into the mobile candidate produced one conflict in `prepare-cloudflare-preview.mjs`. The resolution retains the reviewed no-R2 guard, mandatory V2 flags/origins and private config output.
- Before this documentation addition, the resolved Git tree was **identical** to `4dafd540ab45d90307a1dc9addf6eed594deb9aa` (tree `b4b03a1bcc2c9823575f6a24f2803daa454444cd`). A fresh focused Node22 run passed **9/9**. The earlier 624-test/full-build evidence applies to the identical product files; it was not rerun for a metadata-only merge.
- Owner's subsequent deletion instruction was interpreted in the immediately preceding scope: retirement of the named Bauman Preview environment, not deletion of Production databases or all Bơi Ếch users.
- Both public URL switches on `bauman-control-preview` are now disabled. Worker code and encrypted secrets are retained for recovery.
- A private logical SQL backup of `bauman-control-preview-db` was saved durably and restored to clean local SQLite: **10 user tables, 6 rows**, integrity OK, no foreign-key violations, every row count and SQLite sequence matched. SQL SHA-256: `b3ac3b1930179b13902a523d0d50dca49a60de2bc11de8f38d09e56f2e3ebb6b`. This is not a remote D1 restore test.
- The database itself has not been deleted. Cloudflare's confirmation dialog labels deletion permanent; the browser operation is staged for specific action-time confirmation. D1 capacity and bridge secrets therefore remain blocked. No Production merge/deployment, subscription or hosted Actions was performed.
