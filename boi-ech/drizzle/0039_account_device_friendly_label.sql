-- Store only a minimal device category and browser, never raw user-agent.
ALTER TABLE account_devices ADD COLUMN device_label TEXT;
