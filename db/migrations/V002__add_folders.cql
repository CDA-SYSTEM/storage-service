CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY,
  name text,
  created_at timestamp
);

ALTER TABLE files ADD folder_id uuid;

CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files (folder_id);
