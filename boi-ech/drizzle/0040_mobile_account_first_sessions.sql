-- Owner-approved account-first portable mobile/tablet policy. 2026-11-14.
-- Browser keys remain session credentials, NOT physical-device identifiers.
-- This attribute is an HTTP user-agent classification, not hardware attestation.
-- Never remove MFA/Owner checks, revocation, onboarding, entitlements or audit.
ALTER TABLE account_devices ADD COLUMN client_class TEXT NOT NULL DEFAULT 'desktop'
 CHECK(client_class IN ('desktop','phone','tablet'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_devices_class_by_account
 ON account_devices(account_id,client_class,revoked);
--> statement-breakpoint
-- Install the replacement desktop-cap guard BEFORE retiring the old guard.
-- Failure midway stays fail-closed: old guard still protects the same accounts.
CREATE TRIGGER account_device_desktop_cap_v2_insert BEFORE INSERT ON account_devices
WHEN NEW.revoked=0 AND NEW.client_class='desktop' AND NOT EXISTS (
 SELECT 1 FROM account_devices d WHERE d.account_id=NEW.account_id AND d.device_id=NEW.device_id
)
BEGIN
 SELECT CASE WHEN (
  SELECT COUNT(*) FROM account_devices WHERE account_id=NEW.account_id
   AND client_class='desktop' AND revoked=0
 ) >= 3 THEN RAISE(ABORT,'ACCOUNT_DEVICE_LIMIT_REACHED') END;
END;
--> statement-breakpoint
CREATE TRIGGER account_device_desktop_cap_v2_reactivate BEFORE UPDATE OF revoked ON account_devices
WHEN OLD.revoked=1 AND NEW.revoked=0 AND NEW.client_class='desktop'
BEGIN
 SELECT CASE WHEN (
  SELECT COUNT(*) FROM account_devices WHERE account_id=NEW.account_id
   AND client_class='desktop' AND revoked=0
 ) >= 3 THEN RAISE(ABORT,'ACCOUNT_DEVICE_LIMIT_REACHED') END;
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS account_device_cap_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS account_device_cap_reactivate;
