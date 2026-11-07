# Premium Manager Console — Production release, 2026-11-07

**Both existing Production Workers now run the two requested revisions. Isolated Preview acceptance is still incomplete and is not relabeled PASS.**

The Owner repeatedly requested publication. After the earlier automatic rejection, the Owner's latest message repeated the proposed immediate exact-SHA release with **FREE**, unchanged schema/permissions and acceptance of incomplete Preview UI acceptance. This release follows that direction; it does not claim the outstanding Preview gates passed.

## Deployed identities

| Application | Exact source revision | Active Cloudflare version | Traffic |
| --- | --- | --- | --- |
| Bơi ếch | `6f1f9006a02693cb6923ed3f27ddfa6b6abd5e45` | `c507269f-9e92-4335-875f-01aca2a32298` | **100%** |
| App-Management | `b2e36758d8dab5c953e71b3aa1f36490b55d770f` | `268c3b94-a88a-4217-84ce-135664991c61` | **100%** |

- Bơi ếch: <https://boi-ech.boiech-ai.workers.dev/>.
- App-Management: <https://application-management.boiech-ai.workers.dev/apps/boi-ech/cloudflare-preview>.

The two builds use their **existing Production databases**, not the missing Bơi isolated Preview database. Neither build adds R2 or an Images binding, and no paid service was activated. Existing Bơi managed access, App-Management Owner policy, client origins, access mode and Worker secrets were preserved. No remote migration, schema change, existing role/expiry edit, merge, or hosted Actions dispatch occurred.

## Verification actually performed

| Gate | Actual result |
| --- | --- |
| Bơi guarded Node 22.16.0 release audit, TypeScript, lint, Production-bound build | Each exit **0**; lint has the same 3 existing warnings |
| Complete Bơi serialized regressions | **564/564**, fail/skipped/cancelled **0**, exit **0** |
| Bơi final Production artifact/dry-run | Correct Worker, existing D1 UUID, managed gate and exact revision; exit **0** |
| App-Management Production prepare, TypeScript, build, generated artifact guard, dry-run | Each exit **0**; preserves actual Production configuration |
| Earlier App-Management full source QA on the same executable input | **848/848**, Node 22.16.0; not rerun for this metadata-only release step |
| Per-Worker Cloudflare API readback | Both exact revisions active at **100%**; enabled workers.dev origins; existing bindings/secrets retained |
| Bơi live Universal Management Contract | HTTP **200**; generic device mutation remains disabled |
| Two fresh device identities on live Bơi | Registration, challenge, P-256 signature, presence, repeated registration passed; both remain **pending/unassigned/unregistered**, with **zero approvals** |
| Existing real manager browser | Existing key signed in after reload; new premium console and real overview data displayed |
| Production class form | Opened over HTTPS and cancelled; no class saved |
| Production mobile viewport | Width **375**, document/client width **359/359**, no horizontal overflow; viewport reset afterward |
| Authenticated App-Management `/__deployment` | Exact new revision; database/assets/Production auth/Google auth/Owner policy all ready |
| New App-Management connection page | Accessible under the existing Owner session; normal Authenticator step-up enforced before credential storage |

See `production-readback.json`, authenticated runtime metadata, screenshots and compressed logs. Email addresses and complete Owner-policy log lines (including provider-truncated addresses) are redacted; no token values or signing keys are included. `settings-snapshots-sanitized.json` retains the actual selected before/after settings with Owner addresses redacted. Secret values are opaque to the API; their names/types are retained, and no secret rotation command was executed. [Earlier complete source QA and independent code reviews](https://github.com/BlueDragon33/Application-Management/blob/b2e36758d8dab5c953e71b3aa1f36490b55d770f/docs/evidence/boiech-preview-ui-20261107/README.md).

A separate evidence review found no Critical/Important issue involving false PASS, manager/admin confusion or FREE/schema claims. Its Minor privacy finding identified a truncated second Owner address in two logs; the entire Owner-policy lines were then redacted and the manifest regenerated. The reviewer inspected saved evidence, not the provider API or billing directly.

### Nonzero CLI results and network retry

Both `wrangler deploy --keep-vars` calls uploaded and activated their artifacts, then exited **1** on account-level metadata lookup (`/workers/subdomain`, followed by `/memberships` during diagnostics). The approved Individual Workers Editor key cannot perform those account-wide reads. Those exits are **not** described as CLI PASS. Separate authorized per-Worker API reads plus actual HTTPS/browser results establish the active deployments.

The first Node 22 live-device verifier could not resolve the destination directly (`EAI_AGAIN`). The unchanged verifier then passed using the already installed Undici `EnvHttpProxyAgent`, the inherited proxy and normal TLS verification. Both failure and successful retry logs are retained. Two pending device records were created by this standard smoke check; no learner registration, approval, role assignment, expiry change or cleanup deletion was fabricated.

## Remaining limits and handoff

- Cloudflare Vault connection is waiting at **Owner Authenticator**. The lifecycle key has not yet been saved; the single-Worker Preview key has not yet been submitted. No MFA bypass, seed retrieval or credential rotation was attempted. Do not call the connection complete.
- There are no active classes/sessions in the observed Production overview. Multiple-class scheduling, real conflict writes and coach/learner assignment mutations were not fabricated on Production; their fixture regressions remain separate evidence.
- Manager review remains read-only where backend admin authority is required. No manager/admin privilege escalation was performed.
- Existing absent R2 payment-proof capability and the isolated Preview D1/R2 blockers remain unchanged. No Preview guard was weakened to obtain this Production release.
- Rollback versions are recorded in the sanitized readback. No rollback was needed.

## One Next Action

Enter the Owner's Authenticator code in the open App-Management dialog to authorize the pending lifecycle credential save; the Preview deployment credential can then be connected through the same verified UI.

`SHA256SUMS` covers all evidence files except itself. Production source revisions remain the exact values above even if a subsequent evidence-only commit updates this branch.
