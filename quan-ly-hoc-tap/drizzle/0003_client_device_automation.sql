CREATE TABLE IF NOT EXISTS client_device_automation (
  application_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'off' CHECK (mode IN ('off', 'approve', 'remove')),
  remove_after_hours INTEGER NOT NULL DEFAULT 168 CHECK (remove_after_hours >= 1 AND remove_after_hours <= 8760),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS client_device_automation_mode_idx
  ON client_device_automation(mode);
