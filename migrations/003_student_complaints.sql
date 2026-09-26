ALTER TABLE complaints ADD COLUMN target_type TEXT NOT NULL DEFAULT 'student';
ALTER TABLE complaints ADD COLUMN target_name TEXT;
ALTER TABLE complaints ADD COLUMN target_id TEXT;