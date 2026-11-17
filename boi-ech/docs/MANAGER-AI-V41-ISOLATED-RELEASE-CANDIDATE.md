# Manager AI V41 — isolated ZERO-SPEND release candidate

**Candidate role:** Quản trị Bơi Ếch / Cán bộ quản lý ONLY. This branch starts from the exact HEAD of #186 `4c7023880dbb3eaf30dbbd9f6b6ee7c6eb915697`, which itself is stacked over #185, then adds two read-only evidence-quality fixes and regression tests. It targets stable `main` directly, not the V42–V46 AI stack.

## Allowed functionality
- Existing manager evidence-only dashboard: staff, class capacity, schedule conflicts, room/space status, cited Q&A and what-if simulation.
- No new API route, no D1 schema/migration, no writable AI endpoint, no payment, no LLM/provider call or model key.
- No learner/teacher AI panel, video inference, consent-profile storage, auto-allocation or provider egress.
- Two safety refinements: identify invalid non-cancelled session timestamps; require actually eligible teacher accounts for the active schedule check.

## Conditional release checklist — fail closed
- [ ] Exact HEAD Node 22 validation: TypeScript, lint, build, tests (capture PASS URL).
- [ ] Constitution 1.3.0 and paired App read-only QA, exact BOI/App revision contract (capture PASS URL).
- [ ] Review all changed files against stable main, verify only manager-safe functions; no secrets, payments or D1 migrations.
- [ ] Protected Cloudflare Preview for **this exact candidate** with no unapproved production/remote writes; read back BOI/App deployed revisions and isolation.
- [ ] Signed manager real UI and role isolation negative tests; exercise dashboard, filters, Q&A, what-if, invalid timestamps and ineligible personnel; test mobile 320/390/768/1024/1440 and keyboard WCAG.
- [ ] Real independent Reviewer A and B, with exact HEAD, file:line findings/negative reproductions. Do not equate generic paired QA with independent A/B.
- [ ] Owner review of Preview and affirmative manager-only release authorization; user's latest request permits considering selective release, not skipping constitutional gates.
- [ ] Verify latest main SHA under lease, protected Cloudflare-only workflow and rollback; merge only if all mandatory gates PASS.
- [ ] Read back live Production SHA/config, anonymous + signed manager functionality and rollback plan.

## Safety
Previous 18 Nov exam freeze remains in effect for broad AI V42–V46 and student/teacher flows. The latest Owner instruction reopens ONLY selective safe-to-publish pieces; no automatic transfer to the official AI core. NEVER merge old stacked V42–V46 as a shortcut. ZERO-SPEND, Cloudflare-only, no Vercel.

If any gate cannot be completed, preserve this candidate **Draft / BLOCKED** with evidence and leave Production unchanged. Absence of reviewer reports or signed runtime checks is not a PASS.
