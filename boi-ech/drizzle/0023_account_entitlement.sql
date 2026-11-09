-- #108/#379: independent account-level entitlement, never mutate payment or device expiry.
-- V2 feature flags remain OFF until isolated migration, QA and release acceptance.
CREATE TABLE IF NOT EXISTS account_duration_policies (
 role TEXT PRIMARY KEY NOT NULL CHECK(role IN ('manager','teacher','learner')),
 default_days INTEGER NOT NULL CHECK(default_days BETWEEN 1 AND 365),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT OR IGNORE INTO account_duration_policies(role,default_days) VALUES
 ('manager',30),('teacher',30),('learner',30);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_entitlements (
 account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
 state TEXT NOT NULL CHECK(state IN ('active','suspended')),
 activated_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
 changed_by TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_entitlements_expiry_idx
 ON account_entitlements(state,expires_at);
--> statement-breakpoint
-- Deliberately NO legacy backfill: accounts in legacy_hold must be reconciled explicitly.
-- Do not map device_access.access_expires_at to account_entitlements.
