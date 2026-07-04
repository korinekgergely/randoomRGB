CREATE TABLE IF NOT EXISTS colors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hex TEXT NOT NULL UNIQUE,
  color_date TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  color_id INTEGER NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
  client_key TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(color_id, client_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_color_name
  ON likes(color_id, name COLLATE NOCASE)
  WHERE name IS NOT NULL AND trim(name) != '';
