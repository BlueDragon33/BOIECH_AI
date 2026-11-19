# V43-A — Giáo trình có duyệt và tra cứu có căn cứ (không trả phí)

Scope: stacked after V42-B PR #203 and current-source main; development only, not a release command.

## Data / authority contract
- Browser teacher role obtains existing signed proof, POST to /api/teacher/approved-knowledge when teacher manually requests.
- Server allows only signed, active teacher with assigned class; origin is one of the fixed Cloudflare Workers URLs or local test host. No learner/private video data is read or returned.
- One bounded D1 SELECT of latest course_content_versions with status published and human reviewed_by/reviewed_at/published_at, parseCourseDocument. No approved version => "unavailable" with zero hits, not fabricated training advice.
- Pure V43 retrieval filters correct teacher role, curriculum, lesson 01-08, approved revision, unexpired short retrieval lease, HTTPS same-app citation and query terms. Up to 3 passages with source version and subsection, not a generative answer.
- UI displays exact source excerpts and asks the teacher to verify technique, safety and context. Does not auto-assign a drill or send messages.
- ZERO-SPEND (no paid model/network egress), Cloudflare-only, no new D1 migration, no account mode or class assignment mutation.

## QA / release gates
1. Source TypeScript/lint/build, pure negative tests and signed-route contract.
2. Constitution, paired read-only QA.
3. Protected Preview signed teacher/learner negative-role tests with actual approved D1 curriculum; missing published data must show unavailable, not hallucinated content.
4. Human UX for 320/390/768/1024/1440 and accessibility; no screenshot/data export.
5. Reviewer A/B independently NOT_RUN unless actually verified; owner waiver is not reviewer PASS. Production publish only through later approved main-based release path.

**Dependency:** V42-B source helper for the same role shell. Not included: V43 persistent video inbox, consented personal profiles, manager proposal state, or D1 migration. These remain separate high-impact deliverables.
