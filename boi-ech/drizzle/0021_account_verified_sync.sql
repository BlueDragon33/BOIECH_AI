-- Account-first V2 confirmed sync. No media, password, device key or private profile replication.
CREATE TABLE IF NOT EXISTS account_sync_grants (
 account_id TEXT NOT NULL, device_id TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN ('learning-progress','study-preferences')),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 confirmed_at TEXT,
 PRIMARY KEY(account_id,device_id,scope),
 FOREIGN KEY(account_id,device_id) REFERENCES account_devices(account_id,device_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_sync_records (
 account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
 scope TEXT NOT NULL CHECK(scope IN ('learning-progress','study-preferences')),
 record_key TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 content_json TEXT NOT NULL CHECK(json_valid(content_json)),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(account_id,scope,record_key)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_sync_events (
 account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
 event_id TEXT NOT NULL,
 device_id TEXT NOT NULL,
 scope TEXT NOT NULL,
 record_key TEXT NOT NULL,
 expected_revision INTEGER NOT NULL CHECK(expected_revision>=0),
 committed_revision INTEGER NOT NULL CHECK(committed_revision>=1),
 payload_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(account_id,event_id),
 FOREIGN KEY(account_id,device_id) REFERENCES account_devices(account_id,device_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_sync_events_account_idx ON account_sync_events(account_id,scope,created_at);
--> statement-breakpoint
-- Even if a service forgets a permission check, a revoked/pending device cannot write a sync event.
CREATE TRIGGER IF NOT EXISTS account_sync_event_guard BEFORE INSERT ON account_sync_events
WHEN NOT EXISTS(
 SELECT 1 FROM account_devices d JOIN account_sync_grants g
   ON g.account_id=d.account_id AND g.device_id=d.device_id
 WHERE d.account_id=NEW.account_id AND d.device_id=NEW.device_id AND d.revoked=0 AND d.approved=1
   AND g.scope=NEW.scope AND g.enabled=1
)
BEGIN SELECT RAISE(ABORT,'SYNC_DEVICE_NOT_AUTHORIZED'); END;
--> statement-breakpoint
