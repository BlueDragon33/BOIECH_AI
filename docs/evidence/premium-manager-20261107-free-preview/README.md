# Free-tier Preview connection — 2026-11-07

**App-Management has a real updated isolated HTTPS Preview. Bơi ếch manager acceptance and Production publication remain BLOCKED.**

The Owner approved the two prepared credentials, then explicitly required that everything remain free. No paid subscription, R2 activation, hosted Actions, schema migration, role grant, merge, or Production deployment was performed.

## Exact inputs

- Bơi ếch source/evidence checkpoint: `7f1d6c0090c46781c03ec375754239852554db2f`. This follow-up changes documentation/evidence only; executable subtree remains `4b28907e8c901e6dc72c232dabcff1ad8b35fb3f`.
- App-Management deployed candidate: **`b2e36758d8dab5c953e71b3aa1f36490b55d770f`**, executable subtree `c8e702ad4fd1faf06e8caf853dc6ce8b4cac7b3d`.
- Existing full source QA, on these same executable inputs: Bơi ếch **564/564**, App-Management **848/848**, guarded Node **22.16.0**. They were not rerun for this evidence-only follow-up. [Raw logs and independent source reviews](https://github.com/BlueDragon33/Application-Management/blob/b2e36758d8dab5c953e71b3aa1f36490b55d770f/docs/evidence/boiech-preview-ui-20261107/README.md).

## Actual new evidence

| Check | Observed result |
| --- | --- |
| Authenticated Cloudflare plan UI | **Free / $0 / Current plan**; screenshot `cloudflare-free-plan.jpg` |
| Publication token | Created; active; Individual Workers Editor for exactly the four approved Workers |
| Lifecycle token | Created; active; only Account API Tokens Write on the exact account |
| Existing single-Worker Preview token | Active; still scoped only to `boi-ech-preview` |
| All three provider metadata reads | HTTP **200**; exact permission/resource policy assertions passed |
| All three token expirations | **2026-12-07T20:59:59Z**, the approved 30-day preset |
| Cloudflare prepare / build / generated artifact / dry-run | Each **exit 0**, guarded Node **22.16.0**; gzip upload **676.03 KiB** |
| Actual App-Management Preview | Active version **`4a5e5b1f-200d-402d-88aa-28e63eb7171a`**, **100%**, deployment **`f2fb7105-39f3-4993-ae34-28a199659e0f`** |
| Worker settings readback | Exact candidate revision `b2e36758…`; isolated Preview D1 retained; existing secret names retained |
| Anonymous live requests | **4/4 HTTP 401**: deployment metadata, new UI, new API, private connection bundle |
| Browser | Actual HTTPS Preview login gate displayed; no secret put into the URL |
| Existing Production Workers | Settings readback unchanged for `application-management` and `boi-ech` |

The publication key is **not** the UI's single-Worker deployment key. The lifecycle credential is account-level token-management authority at Cloudflare; the application restricts its use to the exact Bơi Preview token. Secret values are protected outside git and are absent from this evidence.

### CLI nonzero result was reconciled, not relabeled PASS

`wrangler deploy --keep-vars` uploaded the Worker and assets, then exited **1** because its post-upload GET of account-level `/workers/subdomain` was denied (Cloudflare code `10000`). The approved Individual Workers Editor token does not include that account-level read. No broader credential was requested or minted.

Separate per-Worker API reads returned **200**, reporting the new revision, a new deployment at **100%**, and the existing enabled workers.dev subdomain. HTTPS requests and the browser reached its authentication gate. These establish an active Preview deployment despite the CLI's post-upload failure; they do **not** establish authenticated UI or database acceptance. See `cloudflare-runtime-readback.json` and the compressed build/deployment logs; email addresses are redacted from those logs.

## Independent evidence review

The separate reviewer found no Critical/Important issue concerning false PASS claims, manager/admin confusion, credential scope or FREE compliance. A Minor privacy finding identified the account email in the compressed CLI log; email addresses were subsequently redacted and the manifest regenerated. The review inspected the saved evidence, not Cloudflare directly. Token screenshots show the policy-review page of existing tokens; actual active status is supported by the API readback, not by those screenshots alone.

## Preview URLs and remaining blockers

- Updated App-Management Preview: <https://application-management-preview.boiech-ai.workers.dev/apps/boi-ech/cloudflare-preview>.
- Bơi Preview: <https://boi-ech-preview.boiech-ai.workers.dev> — still the **Hello World bootstrap**, not the manager candidate.
- App-Management Preview retains its existing application access secret, whose value is unavailable in the runtime, and its existing **placeholder Owner configuration**. Neither was reset or replaced with a forged identity. Real Owner/manager login, encrypted-vault connection, expiry editing and manager acceptance remain **BLOCKED**.
- Bơi isolated D1 provisioning remains blocked by the **10/10 database quota**. No database was deleted, borrowed, or modified to evade isolation.
- Required Bơi R2 storage remains inactive. Activating a usage-billed subscription conflicts with the Owner's free-only instruction. Its artifact requirement was not weakened.
- The real manager's requested initial 30-day flow is not claimed complete; no Production manager expiry/grant was changed. Production UI remains unchanged.

## One Next Action

Prepare an approved **free isolated Preview environment** with an available Bơi D1 database, permitted storage and real authorized identities, then complete the signed desktop/mobile acceptance before presenting an exact-SHA Production release.

`SHA256SUMS` covers every evidence file except itself. Screenshots show no full token values or account email.
