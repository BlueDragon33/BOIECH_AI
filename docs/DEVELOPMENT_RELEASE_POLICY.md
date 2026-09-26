# Standalone Development / Release Policy

This repository follows the shared BlueDragon33 development policy.

## Default now: Standalone Development Mode

During active development, optimize for speed and independence.

- Each application is treated as an independent web-app.
- The default development path is local-first: the UI should start and remain usable without waiting for the central manager, remote device approval, or a live control plane.
- Internet is primarily an optional enhancement for access rights, synchronization, remote contracts, cloud data, and publishing.
- A missing remote manager, contract, device approval service, or preview credential must not prevent the app shell from opening.
- `main` is the development-live branch. Where a live hosting target already exists, pushes to `main` should publish the current development build automatically with a lightweight workflow.
- Heavy release validation remains manual during active development.
- Stale publish runs should be cancelled in favor of the newest `main` revision.
- Local and live modes must share the same user-facing app architecture; local is not a second legacy UI.
- Application Management is a convenience/control center, not a runtime dependency for opening the other apps.
- Access/device approval can be switched back on when a task actually needs remote rights.

## Application Management access switch

In Standalone Development Mode the central access/approval gate is OFF by default so the management dashboard opens directly and uses local/static/cached data first.

Turning the gate ON re-enables online access/device verification for actions that actually mutate permissions, devices, or remote administration.

## Release Mode

Release Mode begins only when the owner explicitly requests a stable release/production handoff.

Before a release:

1. Freeze the intended revision.
2. Switch access policy from `standalone` to `managed` where the app supports it.
3. Run the repository's full lint/typecheck/unit/contract/browser/E2E/integration/database/security gates appropriate to the app.
4. Resolve release-blocking failures.
5. Verify migrations and the exact artifact.
6. Verify Preview if the release process uses one.
7. Deploy the protected Production path.
8. Perform exact-revision post-deploy read-back/smoke checks.
9. Record version/commit.
10. Return to Standalone Development Mode after release unless the owner requests otherwise.

## Important

Do not silently restore heavy automatic release gates during ordinary feature work.
Do not delete release safeguards; keep them available for explicit Release Mode.
Do not make Application Management or another central service a mandatory dependency for local app startup.
