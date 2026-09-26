ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'Approved';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_salt TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

CREATE TABLE IF NOT EXISTS campus_sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campus_sessions_token_idx ON campus_sessions(token_hash);
CREATE INDEX IF NOT EXISTS campus_sessions_profile_idx ON campus_sessions(profile_id);

CREATE INDEX IF NOT EXISTS profiles_status_idx ON profiles(account_status);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);