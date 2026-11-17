-- Optional external LLM is OFF by default and requires explicit Owner
-- provider/data-transfer policy, a server-only key and daily token budget.
-- This quota accounts for conservative reservations, not provider billing.
-- No prompts or AI responses/PII are persisted here.
CREATE TABLE IF NOT EXISTS training_ai_llm_daily_quota (
  utc_day TEXT PRIMARY KEY,
  reserved_tokens INTEGER NOT NULL DEFAULT 0 CHECK(reserved_tokens>=0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK(request_count>=0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
