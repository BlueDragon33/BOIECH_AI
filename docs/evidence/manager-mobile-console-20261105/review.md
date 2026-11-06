# Bounded technical review and author follow-up

Date: 2026-11-06. Initial reviewed commit: 5791e9b1fd887b72ca0c6256ccc98226ac6f7304. Review was read-only, independent of the implementation context and limited to this manager UI change. It is not release approval or product acceptance.

## Findings addressed

- Important: availability included unassigned/inactive-class people. Reproduced by a failing rendered-component interaction test; filter now requires readiness and no booking.
- Important: saving unchanged assignments could remove inactive/unknown class names. Reproduced by a failing interaction test; the form now shows existing memberships, requires explicit replacement confirmation and guards submission. The existing expectedClassName CAS input is retained.
- Presentation: validity stage was coupled to approval. A failing status-model test now pins expiration independently of approval.
- Setup: an existing building with zero active classes led to a misleading healthy-class message. A failing navigation test now requires class setup.
- Touch target: restored the back action to at least 44px.
- CSS cascade: form submit hover retains the primary background and inverse text pairing in both themes. This is a source-level correction; computed rendering/contrast remains unverified.

Author verification after fixes: focused tests 24/24; npm test 541/541 including build and artifact validation; TypeScript and changed-source ESLint exit 0. No second independent review or ratification is claimed.

The reviewer found no source defect in interval union/clipping, visible capacity overflow, detail lookup by current board ID, failed form-draft retention, expected resource versions or the unchanged privilege/signed-client boundary.

## Unverified coverage

Browser policy rejected navigation to the self-contained preview's data URL. No alternate browser/protocol workaround was attempted. Actual 320px/large-text layout, native modal keyboard focus, composited contrast and live target-runtime acceptance remain UNVERIFIED. The separate preview uses synthetic records and blocks network connections; it is not live QA.
