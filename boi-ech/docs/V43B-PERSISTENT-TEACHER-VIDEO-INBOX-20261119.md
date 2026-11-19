# V43-B — Durable per-teacher media-free inbox, disabled for Production until gate

Base current main SHA 461ab42d71f7f157880bd4aa83676b249ca7b3d0; isolated Draft PR. Migration 0043 empty schema only, no remote D1 write in this development turn.

- Atomic signed video analysis event + per-teacher inbox receipt fanout + activity. Receipt stores only teacher_device_id, video_event_id, unread/seen and revision; no video bytes, images, personal profile or score.
- Signed class-scoped teacher list/seen endpoint. SQL enforces CURRENT approved teacher and learner, registration, account entitlements, real class assignment on every read and acknowledgement.
- Seen uses revision compare-and-swap; catch-up handles later class assignment while preserving prior receipt state; replay client ID cannot duplicate records.
- Teacher manual action cannot review unsaved/mismatched video; retries must match exact signed actor/action/JSON payload, never fake success.
- No background push, no paid provider, no automatic grading or teacher action. Existing V42-B teacher UI will be wired separately.
- Hard gates: TypeScript/Node/lint/build, Constitution, paired QA, isolated Cloudflare Preview migration and D1 concurrency/negative authorization, legacy session migration regression, human access/retention review, Owner-controlled Production release. NOT approved for merge or live schema migration just from source CI.
