# Integrated ZERO-SPEND release candidate — 2026-11-19

MAIN BASE 461ab42d71f7f157880bd4aa83676b249ca7b3d0. Verified source inputs: {"202":"a6514e419ad5db8d65bbced615d46ff0eb34b81a","203":"62aa2eda053d6ec105a199a431d5eb72e4bba4a7","204":"18181c1e4e1ba0c9d90fbbabdf58d9ebeddb96d4","205":"8060bbcca43615489dd428f45b3fdcd3135978fa","206":"86a6a2e74519d8a12aabb4eecb9ef4beacceae74"}.

Main-based combined tree of PRs #202 (manager V42/V46), #203 (teacher video), #204 (signed approved curriculum V43A), #205 (locally labeled phase V45), #206 (comparable teacher progress V45B). V43A teacher-role-shell comes from #204 atop #203, not an old V42 shell. No D1 schema migration, paid model activation, remote write or auto assignment in this branch.

Source CI must be run at **combined HEAD**; individual green PRs are insufficient. Security gates: protected Cloudflare Preview exact BOI+App with authenticated positive and negative roles, mobile/a11y and real labeled video checks, Owner production gate. Independent A/B reviews are NOT_RUN unless evidence, or Owner waiver recorded but never fake PASS. Existing Production workflow *always* attempts pending remote D1 migrations even on source-only commits. Do not invoke without migration ledger and rollback preflight. No current deployment is implied by this release candidate.
