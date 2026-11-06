# Manager mobile console

Owner requests a simpler App-Manager-like console, organized like a smartphone, with useful status bars and deeper management of classes, rooms and students. Continue the established autonomous implementation method. This design records implementation choices, not a new release approval.

## Approach

Keep the existing Boi application, signed training client, registry, commands and D1 contract. Add a mobile app launcher, five-item bottom navigation, settings, readable status bars and detail sheets. This is the selected implementation approach because it reuses the working manager grant and allocation safeguards. A separate app would duplicate identities; a CSS-only recolor would leave the workflow problems unresolved.

## Behavior

- Home gives direct access to schedule, people, classes, rooms, buildings and settings. Bottom navigation keeps home, schedule, classes, people and settings within thumb reach. Rooms and buildings remain directly accessible from home and settings.
- Every class shows eligible learners/capacity, missing or excess learners, assigned/required teachers and missing teachers. Never hide an over-capacity count behind a capped graphic.
- Every room shows its actual occupied minutes and total free minutes in the selected interval, merging overlapping intervals and ignoring cancelled sessions. These minutes do not guarantee one continuous free slot. Room capacity is shown separately in seats.
- Every person shows registration, approval, validity and class-assignment stages. Blocked, incomplete, pending, expired and inactive-class states take precedence over availability. This is registration/allocation status, not invented learning progress.
- Resource and person detail sheets expose related classes, rooms, people and sessions, with existing edit/assignment commands. They read the current board by ID. Forms preserve drafts after failures and continue using original expected versions, canonical class names and idempotent command handling.
- Settings provide display theme and comfortable text size, stored only as local display preferences, plus shortcuts for resource setup and Owner access management. No grant, payment or account permission is added.
- Show the exact selected time window, timezone and last observed time. Never claim live or saved state before source readback.
- Responsive down to 320px; touch targets at least 44px; status text accompanies color; dialogs use native focus containment and Escape/close handling; reduced-motion and dark appearance remain readable.

## Constraints

No new dependency, database, deployment, migration, flag change, API expansion or broader directory fields. No real personal data in fixtures or public evidence. Preserve account-first candidates and flag OFF. The new branch starts at verified BOIECH main b511255063a7637167f6d7ac5f8fd86f013f74b9; it must not pull account-first code into the live manager UI. Backup credential readiness is a separate blocked task.

## Acceptance

Test actual status calculations at capacity boundaries and partial/overlapping bookings; test rendered accessible values and real command payloads; run the changed source through type, build, lint and regression checks. Render mobile UI in an authorized browser if reachable. Report rendering or target-runtime gaps explicitly. Prepare a reviewable candidate; no self-approval, merge or Production publish.
