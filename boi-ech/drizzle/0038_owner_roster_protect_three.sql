-- Extend one-time Owner reset without rewriting its immutable historical audit.
-- The third protected identity is mandatory for every future batch, including
-- an in-progress manifest created by an older implementation.
ALTER TABLE account_one_time_roster_resets ADD COLUMN protected_quynh TEXT;
