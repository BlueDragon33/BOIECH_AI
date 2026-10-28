# Video analysis return freeze

## Scope and reproduced cause

Owner report: on the Cloudflare video analysis page, “Quay lại Bơi ếch AI”
freezes the browser after MediaPipe consent. Reproduced on the production build
from `3783754`: after the analyzer mounted, clicking Back changed the URL to `/`
in 142 ms but DOM snapshot capture timed out and the document stopped responding.
Returning before mounting the analyzer did not reproduce that freeze.

`PreflightEnforcementPanel` observes the analysis subtree and recreates its portal
when `host.isConnected` is false. During React navigation the subtree can detach
before passive cleanup. In that state every replacement host is also disconnected,
so its insertion triggers another observer microtask indefinitely. Cleanup never
gets its turn. The actual effect reproduces this with a bounded observer queue.

## Repair and acceptance

- Do not modify or create portals in a detached analysis root.
- Use native same-origin document navigation for the return link. Existing
  learner/teacher layout shells initialize once per document and must remount.
  Keep the validated teacher tab and encoded class query.
- Cancel active analysis on return and on `pagehide`, including browser Back and
  back-forward cache entry. Keep consent, keys, progress, and learner data.
- Regression tests must first reproduce the detached-root loop, early departure,
  normal connected portal repair, native return, teacher context, and pagehide.
- Run the full release audit, lint, typecheck, build, tests, Constitution CI, and
  independent review. Publish through the existing confirmed Cloudflare workflow.
- Verify the actual live return after analyzer mounting, repeated return visits,
  and teacher query preservation. Record the release and browser evidence in the
  repair PR; do not infer iOS-specific acceptance from desktop browser tests.

This is a focused repair of navigation lifecycle. It does not alter device
approval, scoring, model versions, migration state, or external dependencies.
