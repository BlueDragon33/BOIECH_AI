# Isolated HTTPS Preview acceptance — approved work package

Owner approved the Preview unblock package after candidate `93f295dd1d1127b2fae1bc73ab1e1f8c2362e56d`. The fresh remote and clean local checkout matched that revision.

Scope: repair the two existing Preview workflow guards; establish a genuinely isolated HTTPS manager acceptance environment when configured; finish independent review. ZERO-SPEND remains in force. No hosted Actions, Production, schema changes, permission bypass, new app/repository or merge.

## Execution and evidence checklist

- [x] Reproduce missing confirmation and artifact guards with executable workflow-step regressions under Node 22.16.0 (4 failures before the repair).
- [x] Add required `DEPLOY_PREVIEW` input and a rejecting first-step guard, using an environment variable rather than interpolating user input into shell code.
- [x] Run the existing generated-artifact validator after the Preview build and before the publisher.
- [x] Verify focused regressions, full Node 22 build/tests, TypeScript, lint, release and Preview validators.
- [x] Obtain an independent final code review and handle material findings.
- [x] Verify configured deployment access and an approved manager identity before live Preview acceptance; report missing infrastructure explicitly.
- [ ] Synchronize a reviewable candidate with a checked remote-HEAD lease, preserving the existing branch and all release gates.

## Environment observations

The new managed-environment runtime documentation was read. Its environment-status tool and `/etc/codex/network-policy.json` are not exposed in this executor, so no credential readiness is inferred from them. Normal CLI/runtime variables for Cloudflare token/account, Preview and Production D1 IDs, Preview origin and outbound-identity manifest are absent. Plugin discovery for Cloudflare returned no matches. No token values or secret files were read, and GitHub secrets were not probed.

These are current access limitations, not evidence that the Owner's Cloudflare account or GitHub Environment is unconfigured. GitHub-hosted deployment remains forbidden; no workflow was dispatched.

## Result

Both guard repairs and independent code review are complete. Node 22 full build/regressions: 564/564; independent focused run: 41/41. Wrangler reports unauthenticated; real HTTPS/manager acceptance remains BLOCKED by missing runtime configuration. Current evidence: `docs/evidence/premium-manager-20261106/HTTPS_PREVIEW_FOLLOWUP.md`.
