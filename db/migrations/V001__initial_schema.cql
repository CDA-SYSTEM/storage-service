CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY,
  filename text,
  original_name text,
  mimetype text,
  file_data blob,
  created_at timestamp,
  deleted_at timestamp
);
