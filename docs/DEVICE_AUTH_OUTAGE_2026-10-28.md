# Cloudflare device authentication repair

Owner request: diagnose and fix interruptions, retain Constitution 1.3 boundaries,
and use Cloudflare as the eventual single official deployment. Legacy Sites data
and the separate management migration remain untouched by this repair.

## Evidence and cause

Read-only production diagnostic run `40651175349` (commit `d92a1c3`) confirmed
current device columns and identity/phone unique indexes. The Cloudflare policy
was enabled, 30 days, limit 25; 14 browser identities existed, including one using
the shared development identity. No personal records were printed.

The device route defaulted to standalone on remote origins, regardless of policy.
Its profile update assigned `DEV-LOCAL` and `0000000000` to every blank device.
Actual route/auth code with SQLite and P-256 keys reproduces second-device HTTP
500 and unintended changes to blocked/paid/expired states. A separate reproduced
failure cached a rejected D1 schema promise indefinitely.

## Repair and verification plan

1. Confine standalone handling to local hosts, respecting explicit managed mode.
2. Carry managed mode into the generated Worker artifact and assert it at release.
3. Give local samples unique identifiers; preserve real production access states.
4. Retry schema initialization after a temporary D1 failure.
   Additional-account markers initialize new rows only; neither registration nor
   later signed profile saves reset an owner's existing access classification.
5. Retire the weaker main-push publisher; retain one confirmed production path.
6. Run runtime regressions, full build/tests, lint, typecheck, release audit,
   Constitution checks, and independent review before release.
7. Publish the reviewed branch through the existing protected manual workflow.
8. Verify two fresh browser identities with real registration, challenge,
   signatures, presence, and stable repeat registration on Cloudflare. These
   checks leave two unsubmitted pending identities, without fabricated learner
   profiles or approvals. Verify the browser registration screen as well.

No schema migration or existing device correction is introduced. Do not delete or
silently reclassify the historical shared sample; that requires a separate review
of the device's actual ownership. Auto-approval is verified in SQLite using signed
registration and quota limits; live checks do not invent learner registrations.

## Release state

Production repair is **UNVERIFIED** until the protected release and live device
checks pass. Current validation, exact release commit, and Worker version are
recorded in pull request #102 after those checks. A production failure requires inspecting
the failed step and preserving the existing D1 data, not weakening release gates.
