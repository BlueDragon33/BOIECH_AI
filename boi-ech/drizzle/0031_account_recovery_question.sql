-- V9: optional for legacy accounts; setup via modern registration or owner-session profile.
-- Never store or display plaintext answer. Existing one-time recovery codes remain valid.
CREATE TABLE IF NOT EXISTS account_recovery_questions (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
  question_id TEXT NOT NULL DEFAULT 'childhood_name_v1'
    CHECK(question_id='childhood_name_v1'),
  answer_verifier TEXT NOT NULL CHECK(
    answer_verifier LIKE 'scrypt$32768$8$3$%'
    AND length(answer_verifier)=121
  ),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
