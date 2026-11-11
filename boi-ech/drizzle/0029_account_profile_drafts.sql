-- Owner V9: protected, persistent registration profile prepared BEFORE human review.
-- Account and approved identity remain canonical; trial-generated data NEVER belongs here.
-- Additive only; no changes to legacy rows or existing migrations 0000–0028.
CREATE TABLE IF NOT EXISTS account_profile_drafts (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
  profile_json TEXT NOT NULL CHECK(json_valid(profile_json) AND length(profile_json) BETWEEN 2 AND 2048),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_profile_drafts_updated_idx
  ON account_profile_drafts(updated_at);
