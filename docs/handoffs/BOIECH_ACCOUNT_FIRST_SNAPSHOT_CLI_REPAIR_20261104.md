# Account-first — offline snapshot rehearsal correction

Blueprint OS 1.3.0. **REVIEW BLOCKED · CI PENDING · global D1 10/10 BLOCKED · account flag OFF.**

Base pair was read back unchanged from GitHub before editing: BOIECH `040898b77b7ede9541e5f0c616656a5aa3ef20a4`, App-Manager `9ccedcdc9d47d0848516f30450a721e60789a879`. The containing commit is the new owning source/evidence anchor. This correction does not authorize release or attest the earlier application security findings.

## Corrected behavior

The offline `account-migration.mjs` assumed every legacy table had `rowid`. The captured D1 schema includes a `WITHOUT ROWID` table, so the actual CLI would fail before backfill. It also narrowed SQLite int64 values through JavaScript numbers and could report success despite existing foreign-key violations.

Fingerprinting now uses the original SQLite type and raw TEXT bytes before Node decoding, exact int64/BLOB representations and distinct nonfinite/signed-zero REAL values. Sorted row multisets retain duplicate multiplicity without relying on physical row order. An engineering reviewer reproduced three further false-success collisions during this correction; each was independently reproduced with the real CLI and corrected before the final review.

Integrity and foreign keys are checked before migration, after backfill and after reopening. The original file is opened read-only; SQLite backup creates a disposable local clone; all writes remain confined to that clone. No network/apply/Production mode was added.

The utility still rehearses `0018_account_first.sql` on its input's existing schema. Manager-tier migration `0017` remains a separately reviewed prerequisite/stage, as in the earlier live-schema rehearsal; this fix does not attest the entire pending migration sequence or modify that SQL's intentional policy transition.

## Actual verification

- Node `v24.22.1`; verified build and artifact: exit 0. The combined npm test invocation exited 0 but its captured log contained only build output; full Node verification was therefore run explicitly and recorded separately.
- Complete Node suite: **582/582**, zero failures, skipped or cancelled; 111 test files.
- Eight real CLI regressions cover WITHOUT ROWID, int64/BLOB, type mutation, nonfinite REAL mutation, undecodable TEXT bytes, signed-zero mutation, duplicate-row removal and existing FK violation. Each fixture's source file is checked byte-for-byte after execution, including refused cases.
- Typecheck exit 0; changed-file lint 0 errors/0 warnings; syntax and diff checks exit 0.
- The actual corrected CLI also completed against the earlier schema-derived synthetic snapshot: 3 mapped people, 27 legacy tables preserved, idempotency, reopened readback, integrity/FK checks; input SHA-256 unchanged. This is synthetic row data, not a real data backup.
- Final separate-context read-only engineering review found no remaining Critical/Important issues in the two changed utility/test files. This is not independent account/security/browser/runtime/release acceptance.

[Exact evidence and logs](../evidence/account-migration-cli-20261104/verification.json).

## Existing deployment path and remaining authority

The repository's existing manual production workflow calls Wrangler with credentials supplied by the GitHub `boi-ech-production` environment. It runs on a GitHub-hosted runner and applies remote D1 migrations before deploying. It was not invoked: the Owner's ZERO-SPEND/no-hosted-Actions restriction remains applicable. App-Manager's Deploy & Ops credential vault currently supports Vercel/Neon, not an alternative Cloudflare executor; no provider credential was read or repurposed.

The local Wrangler check still reports not authenticated. No token/cookie extraction, new credential creation, SQL data export, remote migration, deployment, merge, ratification or self-approval occurred. Source-side work does not manufacture access to the existing deployment credential.

Next authorized execution requires the existing Cloudflare credential to be available to an approved executor without hosted Actions. Then obtain the real private backup, verify restore/migration preservation on its clone and complete the remaining target-runtime/browser and independent acceptance gates before release. Do not substitute local synthetic PASS for those gates.

Fallback: retain both candidate branches and the running deployment, with the account-first flag OFF.
