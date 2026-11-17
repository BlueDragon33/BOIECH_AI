-- V43 manager AI review receipts only, NOT autonomous allocation.
-- Immutable source fingerprint + decision audit, no learner videos or PII copy.
CREATE TABLE IF NOT EXISTS training_ai_proposals (
  proposal_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('teacher','learner')),
  person_id TEXT NOT NULL REFERENCES device_access(device_id),
  class_id TEXT NOT NULL REFERENCES training_resources(id),
  source_fingerprint TEXT NOT NULL CHECK(length(source_fingerprint)=64),
  state TEXT NOT NULL CHECK(state IN ('reviewed','approved','rejected')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
  actor_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS training_ai_proposals_person
 ON training_ai_proposals(person_id,class_id,state);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS training_ai_proposal_commands (
  command_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES training_ai_proposals(proposal_id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('review','approve','reject')),
  request_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS training_ai_proposal_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id TEXT NOT NULL REFERENCES training_ai_proposals(proposal_id),
  command_id TEXT NOT NULL UNIQUE REFERENCES training_ai_proposal_commands(command_id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
