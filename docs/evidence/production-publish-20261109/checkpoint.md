# Existing Boi Ech Production publication — 2026-11-09

Owner explicitly requested immediate merge and publication after correcting the database target to existing `boi-ech-db`. Existing Workers, D1s, credentials and login policy are retained. No new D1, paid service, deletion or Bauman reuse is part of this release.

App PR381 merged as 64e18347de92e3caafd3fb409cd7db46806cfd6d, with a tree matching tested candidate070fc3. Node22 suite865/865 passed. Live readiness run42547771113 passed: no blockers or pending migrations, Google/account login ready, rollback DB bookmark and Worker version recorded.

Boi source has634/634 Node22 tests including3 new production packaging tests. Relevant workflow/release checks16/16 passed. Production package now fetches existing live variables, preserves encrypted secrets and managed login, builds/verifies the exact boi-ech / boi-ech-db artifact before remote migrations, captures Time Travel/Worker rollback points, then verifies live revision. Local generated production artifact verification passes; its input is a sanitized packaging fixture, not live provider acceptance.

Current Production migration ledger includes training0017 but not manager-approval0017 or account0018–0023. These pending migrations are additive and retain legacy records. The Account-first V2 flags remain OFF: source publication is not activation or a claim that two-round/MFA/three-device/offline/payment business acceptance passed.

App Production publication run42548348866 succeeded at revision64e18347de92e3caafd3fb409cd7db46806cfd6d. Exact protected revision, login, D1/assets, shared Boi readback and cleanup of its short-lived test session passed. No new permanent credential or subscription was installed.

Final release review identified Wrangler deployments JSON being oldest-first. Actual workflow regression reproduced the wrong rollback target (RED), then selecting maximum created_on corrected it (GREEN). The real workflow command is exercised by the test. Live Boi metadata had only plain_text vars, so no JSON vars require preservation. V2 activation is not part of this publication.

Final post-fix Node22 full suite635/635 passed;4 production packaging/workflow tests passed.

Boi remote deployment results will be recorded after its job completes. No refund or account-usage change can be issued by this assistant.
