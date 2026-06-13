CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY,
  name text,
  created_at timestamp
);

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY,
  filename text,
  original_name text,
  mimetype text,
  file_data blob,
  folder_id uuid,
  created_at timestamp,
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files (folder_id);
