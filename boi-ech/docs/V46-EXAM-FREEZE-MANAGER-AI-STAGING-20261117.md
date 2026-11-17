# BOIECH_AI V46 — Exam freeze and manager AI staging (17 Nov 2026)

**Owner superseding instruction:** The exam is on 18 Nov 2026. Prior conditional merge/Production authorization is **paused** until an explicit post-exam Owner decision. The existing production release is not an AI validation environment.

## Enforced scope

- **DO NOT merge** Draft PRs #185, #186, #188, #191, #193, #196, #197 or this V46 PR.
- **DO NOT dispatch** Cloudflare Production/Preview writes, rotate secrets, run remote D1 mutations/migrations, change DNS/routes, activate profile admission, enable LLM/provider egress or incur spend during this freeze.
- **DO NOT attach** new AI features to the official learner/teacher experience. The V46 code is an unmerged, read-only manager candidate.
- Keep active BOIECH_AI and Application-Management Production unchanged. Never use Vercel; Cloudflare-only and ZERO-SPEND remain mandatory.
- Local/CI **read-only source verification** is allowed. Never convert local tests, CI source checks, or screenshots into a signed role/D1 runtime PASS or an independent A/B review.
- Do not delete original stacked branches, PRs, migration records or valid evidence to make the repository look clean.

## Exact candidate and topology

- Stable production/main baseline recorded in Issue #195: `6b034a0df5e10dda0fbb47b18164f293e9d50caf`.
- Current V45 staged head (PR #197): `964de2b4e8b8db0be7297c739b73410fefc4d1a6`.
- V46 manager snapshot hardening starts from this V45 head, **not** stable main; it cannot be selectively released as manager-only without a separate minimal main-based extraction and full cross-app audit.
- Current PR chain is stacked: #185 → #186 → #188 → #191 → #193 → #196 → #197 → V46.
- As checked on 17 Nov, comparing main to V45 gives `ahead_by=190`, `behind_by=0` and 81 changed files. This checks graph divergence, not D1 semantics, role authorization, independent review or runtime conflicts.

## V46 preparatory improvement

A client-side manager AI snapshot gate rejects stale (older than five minutes), incomplete, invalid or future-dated snapshots before review/apply, and checks the snapshot again after obtaining signed proof. Its helper is pure and read-only.

The browser check is **defense in depth only**; authorization, proposal fingerprint, profile/safety CAS, single audit and D1 readback MUST remain enforced by the server. This candidate does not change server D1 code.

The existing deterministic Manager AI evidence analyzer is additionally hardened, without adding a competing detection engine:
- Blocked, expired or unregistered teachers in current scheduled data are no longer treated as operationally eligible.
- Malformed non-cancelled session timestamps now yield a source-cited quality warning instead of being silently excluded from conflict detection.
- Regression tests verify both cases, cancellation exclusions and read-only behavior. These warnings flag review work; they do not autonomously modify classes, sessions or personnel.

## Release boundary and conflict-cleanliness checklist

1. Keep every PR Draft and account for its own base/head SHA; no unreviewed retarget or hidden squash.
2. Validate V46 with Node 22 tests, lint, TypeScript and build on its exact SHA. Preserve evidence; an unrun test is NOT_RUN.
3. Review imports and source entrypoints before any manager-only extraction. No learner/teacher UI, video engine, admission-profile writes, LLM, migrations or unrelated Application-Management runtime changes may hitchhike.
4. To consider an **admin/manager-only** release after a separate explicit Owner decision, create a fresh main-based candidate containing only the minimal proven manager feature slice. Audit its cross-Worker integration, signed roles, dark/light/mobile UI, D1 contracts, rollback and performance; independent A/B remains required.
5. Source-level Git mergeability is not proof of safe runtime: block if remote concurrent D1 acceptance, role isolation, data policy or exact-SHA A/B evidence is absent.
6. On resumption after the exam, ask the Owner to choose either continued staging or a separately gated manager-only release. No automatic release triggered by elapsed time.

## Development backlog (still unmerged)

- Manager AI: explicit data freshness and evidence completeness, explainable assignment alternatives, workload/room conflict matrices, deterministic QA for partial windows and clock skew.
- User-facing AI: reference-anchored video feedback and labelled swimming clip evaluation; never claim empirical accuracy from synthetic fixtures.
- Security: signed role E2E, two-manager remote D1 race, withdrawal/apply race, deny-by-default data policy and provider egress; store no secrets in issues.
- Quality: accessible keyboard/mobile/dark-mode contrast, no fake compliance, rollback manifest and measured regression/reopen rates.

**Status:** DEVELOPMENT ONLY / NO MERGE / NO PUBLISH / NO DATA OR SPEND TOGGLES.

## ZERO-SPEND provider hardening (new V46 draft delta)

The optional paid provider adapter now requires a **third, explicit server-only cost permission**: `BOI_ECH_AI_COST_MODE=OWNER_APPROVED_PAID_MODE`. With this unset (the default), even legacy `LLM_ENABLED` and `REMOTE_TRANSFER` toggles cannot cause paid egress. This turn does **not** set that variable, enable any paid provider, acquire API keys or make outbound requests.

The original data-policy and model-provider gates remain required. An exact-source regression asserts the new gate is present. Paid model use remains OFF under the Owner's current ZERO-SPEND instruction.

The Owner subsequently allowed only **selective safe release candidates** to be assessed. A separate main-targeted manager-only candidate is [PR #199](https://github.com/BlueDragon33/BOIECH_AI/pull/199), which is not part of this V46 branch. It passed exact-SHA source CI; authenticated role, Preview and independent A/B gates still BLOCK release. No broad release of V42–V46 is authorized.
