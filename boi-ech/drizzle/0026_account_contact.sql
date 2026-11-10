-- R1: unverified account contact is NOT MFA, an account proof, or a device grant.
-- Additive to existing boi-ech D1; don't edit already deployed 0017–0025 or backfill legacy rows.
CREATE TABLE IF NOT EXISTS account_contacts (
 account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('email','phone')),
 value TEXT NOT NULL CHECK(length(value) BETWEEN 7 AND 254),
 verified INTEGER NOT NULL DEFAULT 0 CHECK(verified=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_contacts_kind_idx ON account_contacts(kind);
