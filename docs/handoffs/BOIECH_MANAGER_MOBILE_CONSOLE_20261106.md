# Boi manager mobile console — review handoff

Base: BOIECH_AI main b511255063a7637167f6d7ac5f8fd86f013f74b9. Branch: feat/manager-mobile-console-20261105. Resolve the candidate from the branch/PR head and verify its tree before release.

The manager console now uses a phone-oriented home launcher, bottom navigation, class/room/person status bars, current-record detail sheets and local display settings. Existing signed training commands, canonical assignments, optimistic versions and readback remain in place. No API, schema, dependency, permission or deployment configuration was added.

Class bars expose actual learner capacity/overflow and teacher shortage. Room bars use clipped, merged non-cancelled booking intervals; free minutes are totals, not a promise of one continuous slot. Person stages separate registration, approval, expiration and active-class assignment. Existing inactive class names cannot be silently removed by saving the assignment form; explicit replacement confirmation is required.

Validation: focused 24/24; npm test 541/541; TypeScript, changed-source ESLint, build and artifact validation exit 0. The initial independent technical review identified two important and four smaller issues; author fixes and regression evidence are recorded in docs/evidence/manager-mobile-console-20261105/review.md. This does not constitute release approval.

The private, generated UI preview uses the production components with synthetic data and a network-disabled CSP. Browser URL policy blocked automated rendering; mobile layout, native dialog focus, composited contrast and live target-runtime acceptance remain UNVERIFIED. Do not mark product QA PASS or deploy from these local checks alone.

Preserve the running application and existing manager grant. Account-first candidates 8c2b4710cb4c2802affe7d433ab0450d030a944a and 49a3f85fc42e564460732110974fd951ad8d117e remain unchanged, flag OFF, REVIEW BLOCKED, CI PENDING and global D1 10/10 BLOCKED. No migrations 0017/0018, backup/restore, broad directory grant or Production operation occurred in this UI task. The backup secret gate is separate and must not block source implementation or be reported as a lost Cloudflare connection.

Next release step: inspect the candidate in an authorized preview/runtime, have Owner review the phone UI, and obtain the required release decision for the exact UI SHA. No self-approval, merge or ratification.
