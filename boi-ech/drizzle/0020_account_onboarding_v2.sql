-- Issue #108: staged onboarding; never overwrite legacy statuses or permissions.
CREATE TABLE IF NOT EXISTS account_onboarding (
 account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
 stage TEXT NOT NULL CHECK(stage IN ('requested','profile_required','profile_review','changes_requested','active','suspended','legacy_hold')),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 first_review_by TEXT,
 first_review_at TEXT,
 second_review_by TEXT,
 second_review_at TEXT,
 last_review_note TEXT,
 profile_submitted_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
-- Existing canonical accounts are not implicitly reapproved when V2 is enabled.
INSERT OR IGNORE INTO account_onboarding(account_id,stage)
 SELECT account_id,'legacy_hold' FROM accounts;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_onboarding_new AFTER INSERT ON accounts
WHEN NEW.login IS NOT NULL
BEGIN
 INSERT INTO account_onboarding(account_id,stage) VALUES(NEW.account_id,'requested');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_onboarding_legacy AFTER INSERT ON accounts
WHEN NEW.login IS NULL
BEGIN
 INSERT INTO account_onboarding(account_id,stage) VALUES(NEW.account_id,'legacy_hold');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_onboarding_stage_transition BEFORE UPDATE OF stage ON account_onboarding
WHEN NOT (
 (OLD.stage='requested' AND NEW.stage='profile_required')
 OR (OLD.stage='profile_required' AND NEW.stage='profile_review')
 OR (OLD.stage='changes_requested' AND NEW.stage='profile_review')
 OR (OLD.stage='profile_review' AND NEW.stage IN ('active','changes_requested'))
 OR (OLD.stage='active' AND NEW.stage='suspended')
 OR (OLD.stage='suspended' AND NEW.stage='active')
 -- Legacy reconciliation requires a separate signed authority workflow,
 -- not an automatic production migration.
 OR (OLD.stage='legacy_hold' AND NEW.stage='profile_review')
)
BEGIN SELECT RAISE(ABORT,'ONBOARDING_INVALID_TRANSITION'); END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_onboarding_stage_idx ON account_onboarding(stage,updated_at);
--> statement-breakpoint
-- Consent for each linked device. Existing device records stay intact;
-- V2 authorization will fail closed until the user or Owner validates them.
ALTER TABLE account_devices ADD COLUMN approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_devices_approved_idx ON account_devices(account_id,approved,revoked);
