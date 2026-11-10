-- Manager R4: professional profile fields separate from legacy student identifiers.
-- No backfill, no defaults for existing accounts, no production mutation without explicit deploy.
CREATE TABLE IF NOT EXISTS account_manager_profiles (
 account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
 faculty_unit TEXT NOT NULL CHECK(length(trim(faculty_unit)) BETWEEN 2 AND 120),
 job_title TEXT NOT NULL CHECK(length(trim(job_title)) BETWEEN 2 AND 120),
 job_position TEXT NOT NULL CHECK(length(trim(job_position)) BETWEEN 2 AND 120),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
