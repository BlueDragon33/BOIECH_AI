-- R5: optional, self-declared complementary contact for the SAME V2 account.
-- Primary signup contact stays unchanged, no OTP/identity proof or device trust upgrade.
ALTER TABLE account_contacts ADD COLUMN secondary_kind TEXT
 CHECK(secondary_kind IS NULL OR secondary_kind IN ('email','phone'));
--> statement-breakpoint
ALTER TABLE account_contacts ADD COLUMN secondary_value TEXT
 CHECK(secondary_value IS NULL OR length(secondary_value) BETWEEN 7 AND 254);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_contacts_secondary_guard
 BEFORE UPDATE OF secondary_kind,secondary_value ON account_contacts
 WHEN NOT (
  (NEW.secondary_kind IS NULL AND NEW.secondary_value IS NULL)
  OR (NEW.secondary_kind IS NOT NULL AND NEW.secondary_kind<>NEW.kind
   AND NEW.secondary_value IS NOT NULL
   AND length(trim(NEW.secondary_value)) BETWEEN 7 AND 254)
 )
BEGIN SELECT RAISE(ABORT,'ACCOUNT_SECONDARY_CONTACT_INVALID'); END;
--> statement-breakpoint
