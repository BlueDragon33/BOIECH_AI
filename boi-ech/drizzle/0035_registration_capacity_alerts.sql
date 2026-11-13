-- Aggregated Owner-only rejection signals, no login/password/device identifiers.
CREATE TABLE IF NOT EXISTS account_capacity_alerts(
 person_role TEXT PRIMARY KEY NOT NULL CHECK(person_role IN ('manager','teacher','learner')),
 rejected_attempts INTEGER NOT NULL DEFAULT 0 CHECK(rejected_attempts>=0),
 last_rejected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
