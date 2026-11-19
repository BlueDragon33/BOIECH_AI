# V45-B — Honest video before/after comparison in Teacher Analytics

Base exact current Production source main `461ab42d71f7f157880bd4aa83676b249ca7b3d0`, independent of legacy stacked V42–V47.

Goal: remove misleading 0 scores and invalid before/after improvements.

- Missing, empty or out-of-range video scores and confidence remain **null** (unknown) rather than 0.
- Compare video deltas only when both measurements are usable AND same lesson number, vision engine version and camera view; different conditions return null with explicit explanation.
- Show the reason in the teacher analytics panel and retain genuine numeric zero score as valid observation.
- No claim of causal impact, rehabilitation or AI accuracy from mere correlations.
- Historical corrupted JSON tolerated; evidence window ends at next intervention to avoid confusing interventions.
- Does not add API, D1 migrations, external provider calls, consent storage or paid costs.
- Tests cover historic missing field false +82 improvement, unchanged vs changed engine, camera angle, lesson, confidence, low capture, score zero, corrupted JSON, intervention sequencing.
- Gate: exact SHA CI/lint/TS/build, Constitution, paired App read-only, Preview signed teacher UI and real follow-up readback, Owner approval before production.
