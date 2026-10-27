# Video navigation repair — 27 October 2026

Status: CODED / FOCUSED-TESTED. Full product acceptance, live AI performance,
constitutional compliance, merge and deployment are NOT established.

## Exact starting state

- GitHub BOIECH_AI/main: `636ad79262993feaba9ecfd94814b262198c6bc9`.
- Existing Site source: `4f43d67cf1c9ff324e662e42d7a2577112379c09`.
- Existing Site: `appgprj_6a748e2b7ac48191bccf06eada38f2af`, public, version 39.
- Existing URL: https://boi-ech.dinhnam3391.chatgpt.site
- All pre-existing files changed by this repair matched GitHub's starting blobs.
  Eight other files already differed between Site and GitHub; they were preserved.

## Confirmed defects and bounded repair

The main frame seek did not respond to cancellation, retained its seek listener
after timeout, and waited for an event even at the current timestamp. Regression
tests reproduced all three failures before repair. Playback restoration could
resume a canceled video; its regression also failed before repair.

All three inference paths now share cancellable frame seeking and exclusive
per-video run ownership. Leaving, changing the source or unmounting cancels work,
aborts model downloads, and releases models and temporary object URLs. Late
initialization is disposed. Each frame yields to browser input. Timestamp actions
and playback restoration obey the same cancellation boundary. The existing home
link preserves learner/teacher destinations and cancels before navigation.

This remains cooperative cancellation: an individual synchronous MediaPipe call
cannot be interrupted midway. Real-device latency after heavy inference and model
initialization still requires browser acceptance. No claim that the user's full
production hang has been reproduced or eliminated is made.

No account authorization, course progress schema, scoring thresholds, original
video upload behavior, production bindings or audience was changed.

## Verification

- Related video/camera/trust/evidence tests: **122 passed, 0 failed**.
- Includes six executed loader cancellation cases covering all three actual
  loader functions before and during initialization, without network or telemetry.
- Independent read-only review: no remaining Critical, Important or Minor findings
  after the timestamp-action correction. This is engineering review, not human
  acceptance or constitutional approval.
- Build succeeded in both the Site source layout and the canonical GitHub layout.
- Typecheck baseline: 48 diagnostics; candidate: 45, with no newly introduced
  diagnostic messages. The three removed errors concerned old disposer types.
  Typecheck as a whole is still FAIL.
- Full canonical-layout suite remains FAIL on two unchanged contracts:
  `supports installable offline learning without offline answer submission` and
  `L11 CI invokes the readiness audit before release-like builds`. The Site-only
  export additionally lacks parent GitHub workflow fixtures and has a different
  pre-existing R2 binding expectation. No checks were skipped or weakened to pass.
- Browser navigation from the consent screen reached the existing home route.
  Post-video navigation, authenticated learner sync and iPhone/iPad performance
  remain UNVERIFIED.

## Constitution and release boundaries

Hub `control/universal-constitution-version.json` at
`cd01fb3c2178393628ce968af209db082227d2c4` identifies policy **1.3.0**.
BOIECH_AI's adoption record still declares **1.2.0**. No 1.4.0 publication was
verified. Adoption metadata was not relabeled to simulate compliance.

Actual MediaPipe browser testing was blocked by automatic approval review because
accepting its consent would authorize telemetry to Google. That consent was not
bypassed. Approval for that specific test is required before attempting it again.

Keep this candidate in Draft. No merge, production promotion, database migration,
device approval or constitutional ratification has been performed. Resume from
this candidate and the recorded baselines; do not restart the repository audit.
