import { db } from "@/database";

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    credential_id TEXT UNIQUE NOT NULL,
    public_key BLOB NOT NULL,
    counter INTEGER DEFAULT 0,
    font TEXT DEFAULT 'caveat',
    login DATETIME,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: add font column if missing
try {
  db.exec(`ALTER TABLE users ADD COLUMN font TEXT DEFAULT 'caveat'`);
} catch (_) {
  // column already exists
}

db.exec(`
  CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner TEXT NOT NULL REFERENCES users(username),
    background TEXT DEFAULT 'grid',
    created DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    username TEXT NOT NULL REFERENCES users(username),
    invited_by TEXT NOT NULL,
    UNIQUE(board_id, username)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    description TEXT DEFAULT '',
    x INTEGER DEFAULT 100,
    y INTEGER DEFAULT 100,
    z INTEGER DEFAULT 1,
    color TEXT DEFAULT 'yellow',
    created_by TEXT NOT NULL,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_members_board ON members(board_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_members_user ON members(username)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_board ON notes(board_id)`);

// Migration: add background column if missing
try {
  db.exec(`ALTER TABLE boards ADD COLUMN background TEXT DEFAULT 'grid'`);
} catch (_) {}

// Migration: add description column if missing
try {
  db.exec(`ALTER TABLE notes ADD COLUMN description TEXT DEFAULT ''`);
} catch (_) {
  // column already exists
}
