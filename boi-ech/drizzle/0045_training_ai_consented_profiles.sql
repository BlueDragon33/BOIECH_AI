-- V43 consented supplementary matching data: EMPTY until an explicit runtime admission policy is enabled.
-- Only coded skills/time windows; no raw document, medical data, contact, biometric or original media.
CREATE TABLE IF NOT EXISTS training_ai_profile_submissions (
 device_id TEXT PRIMARY KEY NOT NULL REFERENCES device_access(device_id),
 role TEXT NOT NULL CHECK(role IN ('teacher','learner')),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND length(payload_json) BETWEEN 2 AND 4096),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','verified','withdrawn')),
 consent_at TEXT,
 submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 verified_revision INTEGER,
 verified_by TEXT,
 verification_reference TEXT,
 verified_at TEXT,
 valid_until TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(state!='verified' OR (consent_at IS NOT NULL AND verified_revision=revision AND
   verified_by IS NOT NULL AND verification_reference IS NOT NULL AND verified_at IS NOT NULL AND valid_until IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS training_ai_profile_state_idx
 ON training_ai_profile_submissions(state,role,updated_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS training_ai_class_safety_attestations (
 class_id TEXT PRIMARY KEY REFERENCES training_resources(id),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND length(payload_json) BETWEEN 2 AND 2048),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 verification_reference TEXT NOT NULL,
 verified_by TEXT NOT NULL,
 verified_at TEXT NOT NULL,
 valid_until TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
