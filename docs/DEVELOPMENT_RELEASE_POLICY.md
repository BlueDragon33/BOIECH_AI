# Shared Development / Release Policy

## Current owner direction: managed Cloudflare production

The owner requested one official Cloudflare deployment and reliable managed
device approval on 2026-10-28. For Bơi ếch this supersedes the development defaults
below: remote origins always use signed device identity and the existing approval
policy. Production builds carry `BOI_ECH_ACCESS_MODE=managed` in the generated
Worker artifact. Do not revert production to standalone after this repair.

`deploy-cloudflare.yml` is the single production publishing workflow. It requires
`DEPLOY_PRODUCTION`, release checks, the verified production D1 binding, and live
device authentication smoke checks. The former main-push development publisher
is retired; pushing or merging code does not itself authorize publication.

Standalone execution remains available for local hosts with standalone mode.
Local sample identities must be unique per browser key. No existing learner,
payment, block, expiry, or automation settings are reset by this repair.

## BOIECH_AI direct-to-Production release profile — Owner decision 2026-11-21

**Applies only to `BlueDragon33/BOIECH_AI`.** This is a project-specific
operational release route under published Blueprint OS Constitution 1.3.0,
**not** a new Universal Constitutional amendment, compliance waiver or
permission to publish other applications. The owner operates and accepts this
Production instance and explicitly does not require a separate Preview phase
for routine BOIECH_AI releases.

- **Normal release path:** bounded fix → focused and whole-system CI → exact
  SHA/approval check → protected `deploy-cloudflare.yml` directly to the
  existing Cloudflare Production Worker → exact live revision/asset/auth
  readback → real account/role/UX verification on Production → Owner acceptance.
- **Preview is optional**, not an automatic prerequisite, for BOIECH_AI.
  Explicitly use an isolated Preview only when requested by Owner or when a
  change demonstrably needs safe testing outside Production (for example
  untested destructive/irreversible D1 migration, new trust root, permission
  scheme or unbounded data repair). When necessary, **BLOCK** rather than
  claiming a destructive change is safe solely because Preview was skipped.
- **Before dispatch:** require an approved exact SHA, passing applicable
  tests/build/Constitution checks, scrutinized D1 migration plan, previous
  Worker revision and available D1 rollback bookmark. New production SQL,
  unknown binding changes or failing checks remain blocked.
- **Protected authority:** one manual `DEPLOY_PRODUCTION` dispatch per
  publication; never silently deploy on commit, PR merge, CI or chatbot
  acknowledgement. Preserve Account-first V2, single-review policy, signed
  P-256 devices, role/class data scopes, consent and existing user data.
- **After dispatch:** Production workflow must pass artifact/revision, assets,
  API contract and authorization boundary readback. Owner tests real
  Học viên/Giảng viên/Cán bộ tasks in Production; post-deploy UX acceptance is
  **UNVERIFIED until actually performed**, not inferred from CI.
- **Failure:** stop rollout, retain or restore prior verified Worker/D1 state
  using evidence-based recovery; no blind reset, truncation, deletion,
  revocation or clearing browser signing keys. Document the exact failure and
  one next safe correction.
- **Cost/provider:** ZERO-SPEND, Cloudflare-only, reuse existing Production
  deployment/database and keep Application-Management and BOIECH_AI sources
  isolated. No Vercel and no unauthorized PR #210 migrations.

This supersedes any **BOIECH_AI-specific** wording that suggests a mandatory
Preview promotion. It does not supersede Universal Constitution R3/R5/R9/R20
or the separate security, data recovery and Production authority gates.

## Historical Development Live Mode defaults

This repository is in the shared BlueDragon33 Development Live Mode.

- `main` is the live development source when a live host is configured.
- Use the dedicated lightweight **Live Development Deploy** path; do not require Preview promotion.
- Access defaults to **standalone/local-first**.
- Application Management is optional coordination/launch/sync infrastructure, not a mandatory gate for opening the app.
- Device approval, remote-admin authorization and central control are optional during active development.
- The app must remain usable as a local web-app whenever its own runtime supports local execution.
- Internet should mainly be needed for publishing, optional access-right lookup, synchronization and remote features.
- Missing central-management connectivity must not prevent the core app from opening in standalone development mode.
- Heavy CI, browser suites, integration gates and protected Production promotion remain manual during active development.
- Never treat a skipped optional sync/management bridge as a failed local app.

## Application Management access switch

When this app participates in Application Management:

- **Approval/Managed ON**: use device/access approval and central management.
- **Approval/Managed OFF**: enter directly in standalone local-first mode.
- Development defaults to OFF unless explicitly switched on by the user.

## Release Mode

Release Mode starts only when the owner explicitly requests a stable/production release.

At release time:

1. Freeze the release revision.
2. Switch access mode back to managed/secure where required.
3. Restore or manually run the heavy release gates.
4. Validate database/schema migrations and remote contracts that are part of the release.
5. Verify the exact release artifact.
6. Deploy using the protected Release/Production workflow.
7. Run post-deploy smoke/read-back checks.
8. Record the release revision/version.
9. Retain the owner-selected managed Cloudflare production mode for Bơi ếch.

The Release workflow must remain available even while Development Live Mode is the default.
