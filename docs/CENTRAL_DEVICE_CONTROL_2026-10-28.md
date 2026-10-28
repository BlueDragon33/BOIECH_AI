# Central device command consistency

App Management's shared review surface now sends expected status, payment state and access group to the owning Boi control API. Supplied snapshots must be complete and current. Legacy callers may omit the optional snapshot; existing actor authentication remains required.

All owning device updates use a SQL compare-and-swap against the status, payment, access group, proof key and expiry read by the handler. Competing Free/Paid decisions cannot both overwrite the same snapshot. A rejected payment review changes only if its preceding device CAS succeeded, and a losing CAS neither deletes proof storage nor writes a success audit.

Block/unblock preserve paid classification and original expiry. Unblock returns an unclassified device to pending. It does not renew an expired teacher. Existing roles, signing keys, quotas, data and migrations remain unchanged.

Verification: actual control route, all existing migrations and SQLite exercised stale snapshots, a payment mutation between read/write, expired paid unblock preservation, and concurrent Free/Paid classification. Four new regression tests passed; full `npm test` built successfully and passed 507 tests; strict TypeScript check passed.

No deployment, merge or migration is implied by these local results. Management publication holds remain in its owning repository.
