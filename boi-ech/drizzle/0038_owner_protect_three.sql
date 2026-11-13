-- Additional explicit protected account after Owner corrected the retention scope.
-- Existing two-person runs cannot be resumed; NULL quynh always fails closed.
ALTER TABLE account_one_time_roster_resets ADD COLUMN protected_quynh TEXT;
