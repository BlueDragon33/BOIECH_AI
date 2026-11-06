# Approved HTTPS Preview unblock — follow-up evidence

**Source guards and independent code review: completed. Live HTTPS acceptance: BLOCKED by missing runtime authentication/configuration. Overall release: not approved.**

## Identity and scope

- Starting remote/local candidate: `93f295dd1d1127b2fae1bc73ab1e1f8c2362e56d`, clean checkout; main still `b511255063a7637167f6d7ac5f8fd86f013f74b9`.
- Verified local code commit: `49b8336b16d759febe690d1fd58211217f6984f3`.
- Verified application/test tree: `4b28907e8c901e6dc72c232dabcff1ad8b35fb3f`. Evidence-only updates leave executable inputs unchanged.
- Owner explicitly approved the two Preview guards and the isolated manager acceptance environment. ZERO-SPEND and the Production/merge/schema/authorization boundaries remain in force.

## Fixed guards

1. Manual workflow now requires the `confirm` string input. The first step rejects every value except `DEPLOY_PREVIEW`, before checkout or publishing work. Input enters the quoted shell check through `BOI_ECH_PREVIEW_CONFIRMATION`; no GitHub expression is interpolated into executable shell text.
2. After building with the existing isolated Preview configuration, `npm run cloudflare:artifact:check` must succeed before `npx wrangler deploy`. A nonzero result stops the job.

No workflow was run. These are source/configuration repairs under the newly approved scope.

## Executed checks — Node 22.16.0

| Check | Result | Evidence |
| --- | --- | --- |
| New workflow shell regressions before repair | 4 expected failures | `https-guards-red.txt` |
| New workflow shell regressions after repair | **4/4 passed** | `https-guards-green.txt` |
| Full `npm test`, including verified build | **564/564 passed**, 0 skipped, exit 0 | `https-full.txt` |
| `npx --no-install tsc --noEmit --incremental false` | Exit 0 | `https-typecheck.txt` |
| `npm run lint` | Exit 0, 0 errors / 3 existing warnings | `https-lint.txt` |
| `npm run validate:cloudflare-preview` | Exit 0; the previous missing-guard failure is resolved | `https-preview-validator.txt` |
| `npm run validate:release` | Exit 0 | `https-release.txt` |
| `npm run validate:artifact` | Exit 0 | `https-artifact.txt` |
| Independent focused manager + guard run | **41/41 passed** | Reviewer report below |

The new tests parse the real workflow with the already locked `js-yaml` dependency and execute its actual shell steps. Controlled command shims prove that an artifact-check failure prevents publishing, and that the successful order is build → artifact check → publish. They never call Cloudflare or GitHub Actions.

The Preview validator is a local source/configuration gate. Its successful output is **not** proof of a live deployed Preview or real D1/R2 bindings. Generated Cloudflare Preview acceptance still needs configured isolated infrastructure.

## Independent review completed

A separate reviewer read the complete premium console range from PR #107 (`8dca369bd3352e0e1c18c39ef3d365fbaeee156c`) through `49b8336b16d759febe690d1fd58211217f6984f3`, including the workflow guards, queue fix, signed client/server authorization, and earlier browser evidence. It independently executed all 41 focused tests without editing the checkout or writing to remote services.

Verdict: **no outstanding Critical or Important code findings**. The earlier writable review queue finding is fixed. Source is ready for the next acceptance gate; overall release is **not PASS**.

One deferred Minor finding: `manager-command-center.tsx` displays only hours/minutes in overview session rows, despite windows spanning up to 31 days. Repeated daily slots can be ambiguous and overnight intervals can look reversed. Full Schedule and room details show complete dates and provide a workaround. Date/day display in the overview is recommended; no layout change was added in this narrow guard repair.

Review limits: authenticated HTTPS manager/admin behavior and infrastructure readiness require a live environment; physical-device/WCAG acceptance was not independently executed. Existing detail-sheet lexicographic sorting is unchanged and normal server writes are canonical UTC ISO, so no reachable regression was established. The map remains a logical hierarchy, as specified, without claims about measured floor geometry.

## Actual environment blocker

- The available Wrangler 4.92.0 CLI was invoked normally with `whoami`; it returned **“You are not authenticated.”** No interactive login or deployment was initiated.
- Runtime variables for the Cloudflare token/account, isolated Preview D1 identity and Preview origin are absent. Production D1 guard identity is already represented in repository deployment source and can be resolved from that source when preparing the isolated configuration.
- No Cloudflare connector was found by plugin discovery. The managed environment-status tool and its policy snapshot file are not exposed here; no readiness was inferred.
- Read-only inspection of historical Preview runs found that successful run `41193172343` on `ops/training-release-readiness-20261031` was a **loopback local-preview acceptance job**, not evidence of an authenticated public HTTPS deployment of this candidate. No previous run was started or rerun.
- No current isolated HTTPS URL or approved manager browser identity was provided or discovered in the selected checkout. No HTTPS acceptance result is claimed, and no earlier fixture URL is relabeled as an authenticated Preview.

This describes the current execution session, not the configuration of the Owner's account or GitHub Environment. Secrets stored inside GitHub Actions are not available to this local ZERO-SPEND session and were not extracted.

Application source, package/lockfile, schema/migrations, manager/admin authorization, Blueprint adoption and Production workflow are unchanged from `93f295dd…`. No hosted Actions, new PR, merge, Production publication or remote schema/grant mutation was initiated.

## One Next Action

Configure a Cloudflare Preview connection in this execution environment. Once authenticated, resolve the account and existing isolated Preview resources, obtain the approved manager session, and perform signed HTTPS acceptance before requesting exact-SHA release approval. Authorization for this work package has already been granted; the missing item is usable access/configuration, not another approval of the same scope.
