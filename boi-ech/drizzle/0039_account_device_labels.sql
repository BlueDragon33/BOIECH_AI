-- Cosmetic device fingerprint-free labels; update only from authenticated session.
ALTER TABLE account_devices ADD COLUMN display_label TEXT;
