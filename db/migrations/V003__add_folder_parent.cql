ALTER TABLE folders ADD parent_id uuid;

CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders (parent_id);
