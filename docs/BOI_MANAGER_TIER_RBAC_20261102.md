# Blueprint OS 1.3.0 — Bơi Ếch manager-tier review (candidate)

## Clarified authority

- App-Manager **Owner** decides which registered, active Bơi Ếch `manager` account is approved and granted/revoked `management_enabled`. Merely selecting `manager` on registration is **not** a grant.
- A signed, active `manager` device may approve and subsequently block its own assigned **learner** and **teacher** devices in Bơi Ếch.
- The manager tier has **one shared** default allowance: **50 concurrently active learners + 5 concurrently active teachers across every manager combined**. It is NOT 50/5 per manager.
- The shared allowance is changed only by the Owner via `/api/control/management-access` `set-tier-limits` (values stored at `scope='manager-tier'`, with independently checked D1 readback). The account approval / grant operation does not overwrite the shared allowance.
- One target can belong to only one manager. Assignment insert and status update are transactional; D1 triggers enforce active manager grant, eligible registered pending target and shared capacity; reactivation must also pass the capacity gate.
- Already approved/paid/blocked existing accounts are not reassigned. Legacy free-auto approval is disabled by migration. No user approvals, grants or quotas are silently fabricated in a candidate.
- Manager approvals use actual signed one-use P-256 challenges; browser claims of a manager role never authorize writes. Legacy admin-email approval of learner/teacher is denied.
- No manager may approve a `manager` or overwrite a paid/blocked record. Revocation of `management_enabled` prevents new approvals and block decisions; Owner can still manage manager rights.
- Manager approval uses the currently configured default free-access duration for newly approved learners/teachers, not an invented constant. Payment verification or more permissive access changes are outside manager scope.

## Preview / test mode

Open `/xem-thu-can-bo-quan-ly` in the Bơi Ếch site and explicitly enable **Xem thử cấp Cán bộ quản lý**.

- It renders static, clearly labeled fake records for manager approval, course scheduling, resources, classes, teacher and learner tabs.
- It never obtains a device proof, calls the management API or touches D1. Approve/block buttons are disabled; scheduling form save is an in-memory no-op that returns `false`.
- Preview is not an account grant or a Production QA PASS. Real mutations always require server-verified P-256 identity and the active manager grant.
- Read-only preview is distinct from a staging environment: there is no synchronization with a real account or device.

## Release/governance

Draft candidate only; no Actions, merge, human approval impersonation, ratify or publish. Migrations and live ownership-dependent behavior remain unverified until a permitted isolated release gate. Do not replay previously passing MFA/Universal Contract pilots. Do not treat source checks as authenticated D1 readback.
