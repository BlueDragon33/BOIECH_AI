-- One-time Owner learner/teacher roster reset manifest.
-- Additive-only migration: never purges accounts automatically on publish.
CREATE TABLE IF NOT EXISTS account_one_time_roster_resets (
 id TEXT PRIMARY KEY NOT NULL CHECK(id='2026-11-13-learner-teacher-reset'),
 protected_thien_son TEXT NOT NULL,
 protected_dong_nghi TEXT NOT NULL,
 cutoff_at TEXT NOT NULL,
 backup_bookmark_hash TEXT NOT NULL,
 started_by TEXT NOT NULL,
 started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 state TEXT NOT NULL DEFAULT 'running' CHECK(state IN ('running','completed','retention_review')),
 removed INTEGER NOT NULL DEFAULT 0 CHECK(removed>=0),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 finished_at TEXT
);
