-- Human-triggered AI allocation applications are audited in the same D1 batch
-- as the canonical assign-person command and its capacity/CAS gates.
-- No autonomous scheduling; only IDs, verified proposal fingerprint/revision.
CREATE TABLE IF NOT EXISTS training_ai_proposal_applications (
  command_id TEXT PRIMARY KEY REFERENCES training_commands(command_id),
  proposal_id TEXT NOT NULL UNIQUE REFERENCES training_ai_proposals(proposal_id),
  actor_id TEXT NOT NULL REFERENCES device_access(device_id),
  approved_revision INTEGER NOT NULL CHECK(approved_revision>=1),
  source_fingerprint TEXT NOT NULL CHECK(length(source_fingerprint)=64),
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS training_ai_proposal_applications_actor
 ON training_ai_proposal_applications(actor_id,applied_at DESC);
--> statement-breakpoint
