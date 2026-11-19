# V45-A — Local-only video phase evidence, no model calls
Main source base: `461ab42d71f7f157880bd4aa83676b249ca7b3d0`. Ground truth / phase analyzer rebuilt in isolated Draft PR from earlier V45, without importing old manager/teacher/D1 drafts.

- Original video, phase sampling and manually annotated frame labels remain in the local browser, never uploaded to server.
- Add per-phase precision, recall, F1, macro F1 and abstention percentage only when there are labeled ground-truth frames. An unlabeled phase has null F1, not invented accuracy.
- Measure transition timing error only across adjacent, labeled frame samples, and disclose sampling resolution.
- Explicit evaluation/calibration modes cannot reuse annotated labels silently; changing mode clears current labels, and calibration-only threshold proposal is never automatic production tuning.
- Pagination allows every sampled frame to be manually reviewed in batches of 60 instead of sampling one frame from each larger chunk; local data is destroyed on new analysis.
- Tests cover mismatches, missing labels, false positives, unrecognized frames, transition gap boundaries, sparse labels. Synthetic results are NOT validation against real swimming clip corpus.
- ZERO-SPEND: no external LLM/paid service. MediaPipe local browser module behavior remains as previously published. No remote D1/API/schema changes.
- Release gates: Node tests/TypeScript/lint/build, Constitution, paired App QA, protected Preview real browser/camera and accessibility check, Owner approval. Real F1 score must never be claimed without independent labeled clip validation.
