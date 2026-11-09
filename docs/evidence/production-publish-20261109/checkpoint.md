# Existing Boi Ech Production publication — 2026-11-09

Owner explicitly requested immediate merge and publication after correcting the database target to existing `boi-ech-db`. Existing Workers, D1s, credentials and login policy are retained. No new D1, paid service, deletion or Bauman reuse is part of this release.

App PR381 merged as 64e18347de92e3caafd3fb409cd7db46806cfd6d, with a tree matching tested candidate070fc3. Node22 suite865/865 passed. Live readiness run42547771113 passed: no blockers or pending migrations, Google/account login ready, rollback DB bookmark and Worker version recorded.

Boi source has634/634 Node22 tests including3 new production packaging tests. Relevant workflow/release checks16/16 passed. Production package now fetches existing live variables, preserves encrypted secrets and managed login, builds/verifies the exact boi-ech / boi-ech-db artifact before remote migrations, captures Time Travel/Worker rollback points, then verifies live revision. Local generated production artifact verification passes; its input is a sanitized packaging fixture, not live provider acceptance.

Current Production migration ledger includes training0017 but not manager-approval0017 or account0018–0023. These pending migrations are additive and retain legacy records. The Account-first V2 flags remain OFF: source publication is not activation or a claim that two-round/MFA/three-device/offline/payment business acceptance passed.

App Production publication run42548348866 succeeded at revision64e18347de92e3caafd3fb409cd7db46806cfd6d. Exact protected revision, login, D1/assets, shared Boi readback and cleanup of its short-lived test session passed. No new permanent credential or subscription was installed.

Final release review identified Wrangler deployments JSON being oldest-first. Actual workflow regression reproduced the wrong rollback target (RED), then selecting maximum created_on corrected it (GREEN). The real workflow command is exercised by the test. Live Boi metadata had only plain_text vars, so no JSON vars require preservation. V2 activation is not part of this publication.

Final post-fix Node22 full suite635/635 passed;4 production packaging/workflow tests passed.

Boi remote deployment results will be recorded after its job completes. No refund or account-usage change can be issued by this assistant.

## Browser-verified asset routing correction

Initial Boi release d42c9d9 passed API/device checks but the real browser failed to import /assets/index-BF7Rs-nl.js, confirmed as Not Found. The Boi router has no static asset forwarding; run_worker_first=true incorrectly sent public JS/CSS into it. Production packaging now restores assets-first routing (false) and validates it. A regression test observed RED then GREEN, and the release job now checks actual public JS/CSS status and MIME after deploy, in addition to API/device checks. Authentication/D1/secrets are unchanged.


## Final successful publication — 2026-11-09, Europe/Moscow

- Boi Production source: 01fcfed06727d50536a656af78292692387e508f; Worker version 8ddcd088-ca5c-48f2-a046-9231c74b8354. Successful run: https://github.com/BlueDragon33/BOIECH_AI/actions/runs/42549859680 . Hosted Node22 suite636/636; exact Worker/D1/revision readback, real JS/CSS status+MIME, Universal Contract and two live signed-device lifecycle checks passed. These are two protocol probes, not three physical-device business acceptance.
- Browser readback after the asset fix: https://boi-ech.boiech-ai.workers.dev/ rendered the real Cán bộ quản lý workspace, current timestamp, existing30 personnel/12 waiting learners/1room/1building. The previous authentication loader resolved. Separate read-only manager demo also hydrated; demo data is explicitly simulated and is not real D1 acceptance.
- App Production source:64e18347de92e3caafd3fb409cd7db46806cfd6d; Worker version08be32d0-2951-4216-a074-9e9e98c0dd2c. Successful run: https://github.com/BlueDragon33/Application-Management/actions/runs/42548348866 . Hosted Node22 suite865/865, protected exact revision/login/D1/assets and Central Boi device reads passed.
- PR381, PR110 and corrective PR111 are merged. Existing boi-ech -> boi-ech-db and application-management -> application-management-production-db are retained, encrypted credentials are retained, no new D1 or R2 subscription was created. No old user/learning data was deleted.
- Account-first V2 remains OFF; legacy managed login remains active. Two-round onboarding,30-day account policy, MFA/CAS,3 actual devices/offline/conflict/recovery and payment-proof acceptance must not be represented as completed by this publication. Duration UI may show unavailable until that separate activation/acceptance is completed.

Owner publication authority was the explicit latest merge/publish instruction in this session. No token refund or usage-account modification was performed or promised.
