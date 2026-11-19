# V42-B — Giảng viên ưu tiên video kỹ thuật có căn cứ

**Base:** `BlueDragon33/BOIECH_AI` main `461ab42d71f7f157880bd4aa83676b249ca7b3d0`, no dependency on old V42 stacked Draft #188.

- Scope: authenticated class-scoped teacher overview; last **media-free analysis summaries only**. Video original stays local. No new endpoint, D1 migration, external model, paid fee or auto-send.
- User journey: teacher sees confidence/capture before technical judgment, severe error priority even when overall score high, review history keyed to exact `analyzedAt`, manual button **Soạn bài luyện gợi ý** opening existing signed teacher action modal. The draft is not sent until teacher manually submits.
- On query limit (200 learners / 3,000 assessments / 12,000 events / 200 replies / 1,500 assignments), UI explicitly says historical coverage may be incomplete.
- Limits: only most recently loaded analysis per learner; never claims every video reviewed or proven swimming improvement. Any mentor must still visually inspect footage, body biomechanics, lesson context and safety.
- Test: bad capture blocks exercise; critical errors not hidden by overall average; later feedback cannot erase exact video review; no data or model side effects.
- Release: exact SHA CI + Constitution + paired read-only QA, then protected Cloudflare Preview signed teacher/learner negative-role UX. Owner-controlled merge/publish, no automatic Production change.

**Next:** V43 separate consented, idempotent video-inbox migration and server-scoped knowledge retrieval; must rehearse remote D1 concurrency before release.
